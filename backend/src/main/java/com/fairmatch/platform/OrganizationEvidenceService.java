package com.fairmatch.platform;

import com.fairmatch.audit.AuditService;
import com.fairmatch.common.*;
import java.time.Instant;
import java.util.*;
import java.security.MessageDigest;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class OrganizationEvidenceService {
    private final MongoTemplate mongo;private final PrivateBusinessFiles files;private final AuditService audit;private final TransactionTemplate tx;
    static final Set<String> TYPES=Set.of("Trade licence","Business registration","Tax document","Other supporting document");
    public OrganizationEvidenceService(MongoTemplate mongo,PrivateBusinessFiles files,AuditService audit,PlatformTransactionManager manager){this.mongo=mongo;this.files=files;this.audit=audit;this.tx=new TransactionTemplate(manager);}
    @Document("organization_documents") public record Evidence(@Id String id,String organizationId,String type,String description,String filename,long bytes,String sha256,Instant createdAt,String uploadedBy){}
    @Document("organization_document_deletions") record Deletion(@Id String id,Instant requestedAt){}
    @Document("organization_review_history") public record Review(@Id String id,String organizationId,long organizationVersion,String status,String reason,List<Evidence> documents,String actor,Instant at){}
    public record Bundle(PlatformService.Organization organization,List<Evidence> documents,List<Review> history){}
    public Bundle bundle(String org){return new Bundle(organization(org),list(org),mongo.find(Query.query(Criteria.where("organizationId").is(org)).with(Sort.by(Sort.Direction.DESC,"at")).limit(50),Review.class));}
    PlatformService.Organization organization(String org){var result=mongo.findById(org,PlatformService.Organization.class);if(result==null)throw new ApiException(HttpStatus.NOT_FOUND,"Organization not found.");return result;}
    public List<Evidence> list(String org){return mongo.find(Query.query(Criteria.where("organizationId").is(org)).with(Sort.by("createdAt","id")),Evidence.class);}
    Evidence owned(String org,String id){var result=mongo.findOne(Query.query(Criteria.where("_id").is(id).and("organizationId").is(org)),Evidence.class);if(result==null)throw new ApiException(HttpStatus.NOT_FOUND,"Document not found.");return result;}
    void changed(String org,long version){
        var updated=mongo.updateFirst(Query.query(Criteria.where("_id").is(org).and("version").is(version)),new Update().inc("version",1).set("status","Pending").set("reviewReason","Supporting documents changed. Administrator review required."),PlatformService.Organization.class);
        if(updated.getModifiedCount()!=1)throw new ApiException(HttpStatus.CONFLICT,"Organization evidence changed. Refresh the documents before saving.");
    }
    public Evidence upload(String org,String type,String description,String filename,byte[] bytes,long version,String actor){
        if(!TYPES.contains(type)||description==null||description.trim().length()<10||description.length()>500)throw new ApiException(HttpStatus.BAD_REQUEST,"Choose a document type and explain the document in 10 to 500 characters.");
        if(bytes.length<5||bytes.length>8*1024*1024||!new String(bytes,0,5,java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-"))throw new ApiException(HttpStatus.BAD_REQUEST,"Upload a PDF up to 8 MB.");
        if(organization(org).version()!=version)throw new ApiException(HttpStatus.CONFLICT,"Refresh the organization before uploading.");
        var id=UUID.randomUUID().toString();
        var name=Optional.ofNullable(filename).orElse("business-document.pdf").replaceAll("[\\\\/\\p{Cntrl}]","_");if(name.length()>160)name=name.substring(name.length()-160);
        String hash;try{hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception e){throw new IllegalStateException(e);}
        var record=new Evidence(id,org,type,description.trim(),name,bytes.length,hash,Instant.now(),actor);
        files.request(id,"PUT",bytes);
        try {return tx.execute(status->{
            changed(org,version); // Serializes uploads/removals/reviews on the organization version.
            if(list(org).size()>=5)throw new ApiException(HttpStatus.CONFLICT,"Keep at most five supporting documents. Remove an old document first.");
            mongo.insert(record);audit.record(org,"ORGANIZATION_DOCUMENT_UPLOADED",id,type,actor);return record;
        });}catch(RuntimeException error){
            // A durable queue also covers a temporarily unavailable object store during compensation.
            mongo.save(new Deletion(id,Instant.now()));cleanup();throw error;
        }
    }
    public void remove(String org,String id,long version,String actor){
        tx.executeWithoutResult(status->{owned(org,id);changed(org,version);mongo.remove(Query.query(Criteria.where("_id").is(id).and("organizationId").is(org)),Evidence.class);mongo.save(new Deletion(id,Instant.now()));audit.record(org,"ORGANIZATION_DOCUMENT_REMOVED",id,"Private file deletion queued; verification requires another review",actor);});
        cleanup();
    }
    public byte[] download(String org,String id,String actor){var record=owned(org,id);var bytes=files.request(record.id(),"GET",null);audit.record(org,"ORGANIZATION_DOCUMENT_ACCESSED",id,"Private supporting PDF downloaded",actor);return bytes;}
    public void recordReview(String org,long version,String status,String reason,List<String> reviewedIds,String actor){
        var documents=list(org);
        if(status.equals("Verified")) {
            var expected=new HashSet<>(documents.stream().map(Evidence::id).toList());
            if(expected.isEmpty())throw new ApiException(HttpStatus.CONFLICT,"At least one supporting business document is required before approval.");
            if(reviewedIds==null||reviewedIds.size()!=expected.size()||!expected.equals(new HashSet<>(reviewedIds)))throw new ApiException(HttpStatus.CONFLICT,"Review every current supporting document before approval.");
        }
        mongo.insert(new Review(UUID.randomUUID().toString(),org,version,status,reason,documents,actor,Instant.now()));
    }
    @Scheduled(fixedDelay=60000) public void cleanup(){
        for(var item:mongo.find(new Query().limit(20),Deletion.class)){
            try{files.request(item.id(),"DELETE",null);mongo.remove(item);}catch(RuntimeException ignored){ /* inaccessible file stays queued for a later retry */ }
        }
    }
}
