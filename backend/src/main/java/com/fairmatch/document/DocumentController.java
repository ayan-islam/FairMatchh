package com.fairmatch.document;

import com.fairmatch.audit.AuditService;
import com.fairmatch.common.ApiException;
import com.fairmatch.platform.PlatformService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.net.http.*;
import java.net.http.HttpRequest;
import org.springframework.http.HttpHeaders;
import java.nio.file.*;
import java.security.Principal;
import java.time.*;
import java.util.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController @RequestMapping("/api/candidate/documents")
class DocumentController {
    private final PlatformService platform;private final MongoTemplate mongo;private final AuditService audit;private final ObjectMapper json;
    private final HttpClient http=HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(3)).build();
    DocumentController(PlatformService platform,MongoTemplate mongo,AuditService audit,ObjectMapper json){this.platform=platform;this.mongo=mongo;this.audit=audit;this.json=json;}
    record SourcePage(int number,String text,String method,boolean truncated){}
    record Suggestion(String field,String value,int page,int start,int end,String method){}
    @Document("candidate_documents") record Resume(@Id String id,String ownerId,String filename,long bytes,String status,String text,Instant createdAt,List<SourcePage> pages,List<Suggestion> suggestions,List<String> warnings,Integer extractionVersion){}
    record Confirmation(@Valid @NotNull PlatformService.ProfileInput profile,@AssertTrue boolean confirmed){}
    private String owner(Principal p){return platform.account(p.getName()).id();}
    private Resume owned(String id,String owner){var r=mongo.findOne(Query.query(Criteria.where("_id").is(id).and("ownerId").is(owner)),Resume.class);if(r==null)throw new ApiException(HttpStatus.NOT_FOUND,"Document not found.");return r;}
    private byte[] worker(String id,String method,byte[] bytes) {return worker(id,method,bytes,"");}
    private byte[] worker(String id,String method,byte[] bytes,String suffix) {
        try {
            var config=new Properties();try(var reader=Files.newBufferedReader(Path.of("../data/document-worker.properties"))){config.load(reader);}
            var response=http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:8090/documents/"+UUID.fromString(id)+suffix)).timeout(Duration.ofSeconds(35)).header("X-Worker-Key",config.getProperty("key")).header("Content-Type","application/pdf").method(method,bytes==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofByteArray(bytes)).build(),HttpResponse.BodyHandlers.ofByteArray());
            if(response.statusCode()==507)throw new ApiException(HttpStatus.INSUFFICIENT_STORAGE,"CV storage is full. Free space on the drive containing FairMatch data and try again. Existing documents remain saved.");
            if(response.statusCode()>=400)throw new ApiException(response.statusCode()==422?HttpStatus.BAD_REQUEST:HttpStatus.SERVICE_UNAVAILABLE,"The document service could not process this file. Use an unencrypted PDF of at most 10 pages, or try again later.");
            return response.body();
        }catch(ApiException e){throw e;}catch(InterruptedException e){Thread.currentThread().interrupt();throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"Document request interrupted.");}
        catch(Exception e){throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"Document service is unavailable. Start FairMatch using START_FAIRMATCH.cmd and try again.");}
    }
    @GetMapping List<Resume> list(Principal p){return mongo.find(Query.query(Criteria.where("ownerId").is(owner(p))).with(Sort.by(Sort.Direction.DESC,"createdAt")),Resume.class);}
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED)
    Resume upload(@RequestParam MultipartFile file,Principal p) throws java.io.IOException {
        var owner=owner(p);if(file.isEmpty()||file.getSize()>8*1024*1024)throw new ApiException(HttpStatus.BAD_REQUEST,"Upload a PDF up to 8 MB.");
        if(mongo.count(Query.query(Criteria.where("ownerId").is(owner)),Resume.class)>=10)throw new ApiException(HttpStatus.CONFLICT,"Remove an old document before uploading more than 10 CVs.");
        var id=UUID.randomUUID().toString();var bytes=file.getBytes();
        if(bytes.length<5||!new String(bytes,0,5,java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-"))throw new ApiException(HttpStatus.BAD_REQUEST,"Upload a valid PDF file.");
        var result=json.readTree(worker(id,"PUT",bytes));
        var name=Optional.ofNullable(file.getOriginalFilename()).orElse("resume.pdf").replaceAll("[\\\\/\\p{Cntrl}]","_");if(name.length()>160)name=name.substring(name.length()-160);
        try {
            var saved=mongo.insert(extracted(id,owner,name,file.getSize(),Instant.now(),result));
            audit.record("platform","DOCUMENT_UPLOADED",id,"Private candidate PDF",p.getName());return saved;
        }catch(RuntimeException e){worker(id,"DELETE",null);throw e;}
    }
    @GetMapping("/{id}/file") ResponseEntity<byte[]> download(@PathVariable String id,Principal p){var r=owned(id,owner(p));return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(r.filename(),java.nio.charset.StandardCharsets.UTF_8).build().toString()).header(HttpHeaders.CACHE_CONTROL,"no-store").body(worker(id,"GET",null));}
    private Resume extracted(String id,String owner,String name,long bytes,Instant created,com.fasterxml.jackson.databind.JsonNode result) {
        var pages=result.has("pages")?Arrays.asList(json.convertValue(result.get("pages"),SourcePage[].class)):List.<SourcePage>of();
        var suggestions=result.has("suggestions")?Arrays.asList(json.convertValue(result.get("suggestions"),Suggestion[].class)):List.<Suggestion>of();
        var warnings=result.has("warnings")?Arrays.asList(json.convertValue(result.get("warnings"),String[].class)):List.<String>of();
        return new Resume(id,owner,name,bytes,result.get("status").asText(),result.get("text").asText(),created,pages,suggestions,warnings,result.path("extractionVersion").asInt(1));
    }
    @PostMapping("/{id}/extraction") Resume reextract(@PathVariable String id,@RequestParam(defaultValue="false") boolean ocr,Principal p) throws java.io.IOException {
        var old=owned(id,owner(p));
        var result=json.readTree(worker(id,"POST",null,"/extraction?ocr="+ocr));
        var saved=extracted(old.id(),old.ownerId(),old.filename(),old.bytes(),old.createdAt(),result);
        // Update only an existing owned document: a concurrent deletion must not resurrect its metadata.
        var updated=mongo.findAndModify(Query.query(Criteria.where("_id").is(id).and("ownerId").is(old.ownerId())),new Update().set("status",saved.status()).set("text",saved.text()).set("pages",saved.pages()).set("suggestions",saved.suggestions()).set("warnings",saved.warnings()).set("extractionVersion",saved.extractionVersion()),org.springframework.data.mongodb.core.FindAndModifyOptions.options().returnNew(true),Resume.class);
        if(updated==null)throw new ApiException(HttpStatus.CONFLICT,"This document was removed. Refresh the list.");
        audit.record("platform","DOCUMENT_REEXTRACTED",id,"Candidate requested page-linked text extraction; profile unchanged",p.getName());return updated;
    }
    @PostMapping("/{id}/confirmation") @org.springframework.transaction.annotation.Transactional Resume confirm(@PathVariable String id,@Valid @RequestBody Confirmation r,Principal p){var old=owned(id,owner(p));platform.saveProfile(old.ownerId(),r.profile());var saved=new Resume(old.id(),old.ownerId(),old.filename(),old.bytes(),"Confirmed",old.text(),old.createdAt(),old.pages(),old.suggestions(),old.warnings(),old.extractionVersion());mongo.save(saved);audit.record("platform","DOCUMENT_PROFILE_CONFIRMED",id,"Candidate reviewed and confirmed profile fields",p.getName());return saved;}
    @DeleteMapping("/{id}") Map<String,Boolean> delete(@PathVariable String id,Principal p){var r=owned(id,owner(p));worker(id,"DELETE",null);mongo.remove(r);audit.record("platform","DOCUMENT_DELETED",id,"Candidate removed private CV",p.getName());return Map.of("deleted",true);}
}
