package com.fairmatch.application;

import com.fairmatch.audit.AuditService;
import com.fairmatch.common.ApiException;
import com.fairmatch.job.JobService;
import com.fairmatch.platform.PlatformService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/** Human assessments of published criteria; Java summarizes them without choosing a hiring outcome. */
@RestController
@RequestMapping("/api/employer/applications/{id}/criteria-review")
class CriteriaReviewController {
    private final MongoTemplate mongo;
    private final PlatformService platform;
    private final JobService jobs;
    private final ApplicationService applications;
    private final AuditService audit;
    private final ObjectMapper json;
    CriteriaReviewController(MongoTemplate mongo,PlatformService platform,JobService jobs,ApplicationService applications,AuditService audit,ObjectMapper json) {
        this.mongo=mongo;this.platform=platform;this.jobs=jobs;this.applications=applications;this.audit=audit;this.json=json;
    }
    record EvidenceSource(String field,String text) {}
    record Item(@Min(0) int index,@NotNull @Pattern(regexp="Supported|Partial|Needs evidence") String assessment,
        @NotNull @Pattern(regexp="experience|education|skills|example|none") String source,
        @NotNull @Size(max=1000) String quote,@NotBlank @Size(min=15,max=1500) String reason) {}
    record Input(@NotBlank String snapshot,@Min(0) long expectedVersion,@NotBlank String expectedBand,
        @NotEmpty @Size(max=30) List<@Valid Item> items,@AssertTrue boolean confirmed) {}
    @Document("criteria_reviews") record Review(@Id String id,String organizationId,String applicationId,String snapshot,
        List<String> criteria,List<Item> items,String band,int supported,int partial,int needsEvidence,long version,String actor,Instant at) {}
    @Document("criteria_review_history") record History(@Id String id,Review review) {}
    record Report(String applicationId,String snapshot,List<String> criteria,List<EvidenceSource> sources,
        String currentBand,long version,Review latestReview,boolean reviewCurrent) {}
    record Saved(Report report,ApplicationService.BlindApplication application) {}
    private ApplicationDocument owned(String org,String id) {
        var record=mongo.findOne(Query.query(Criteria.where("_id").is(id).and("organizationId").is(org)),ApplicationDocument.class);
        if(record==null)throw new ApiException(HttpStatus.NOT_FOUND,"Application not found.");
        return record;
    }
    private Report report(String org,String id) {
        var application=owned(org,id);
        var job=jobs.employerJobs(org).stream().filter(j->j.id().equals(application.jobId())).findFirst()
            .orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Job not found."));
        var sources=List.of(new EvidenceSource("experience",application.experience()),new EvidenceSource("education",application.education()),
            new EvidenceSource("skills",String.join(", ",application.skills())),new EvidenceSource("example",application.example()));
        String snapshot;
        try { snapshot=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsString(Arrays.asList(id,job.id(),job.requirements(),sources)).getBytes(StandardCharsets.UTF_8))); }
        catch(Exception e){throw new IllegalStateException("Could not identify evidence revision",e);}
        var last=mongo.findById(id,Review.class);
        return new Report(id,snapshot,job.requirements(),sources,application.band(),last==null?0:last.version(),last,
            last!=null&&last.snapshot().equals(snapshot)&&last.band().equals(application.band()));
    }
    @GetMapping Report get(@PathVariable String id,Principal principal) { return report(platform.organizationId(principal.getName()),id); }

    @org.springframework.context.event.EventListener
    public void requirementsChanged(JobService.CriteriaChanged event) {
        // Joins the job-edit transaction: stale structured summaries must not remain active evidence bands.
        var ids=mongo.find(Query.query(Criteria.where("organizationId").is(event.organizationId()).and("jobId").is(event.jobId())),ApplicationDocument.class)
            .stream().map(ApplicationDocument::id).toList();
        var reviewed=mongo.find(Query.query(Criteria.where("organizationId").is(event.organizationId()).and("applicationId").in(ids)),Review.class);
        for(var review:reviewed) mongo.updateFirst(Query.query(Criteria.where("_id").is(review.applicationId()).and("organizationId").is(event.organizationId())),new Update().set("band","Needs review"),ApplicationDocument.class);
        if(!reviewed.isEmpty())audit.record(event.organizationId(),"CRITERIA_REVIEWS_INVALIDATED",event.jobId(),"Published requirements changed; structured evidence bands need review; hiring stages unchanged","system");
    }

    @PostMapping @Transactional
    Saved save(@PathVariable String id,@Valid @RequestBody Input input,Principal principal) {
        var org=platform.organizationId(principal.getName());var current=report(org,id);
        if(!input.snapshot().equals(current.snapshot())||input.expectedVersion()!=current.version()||!input.expectedBand().equals(current.currentBand()))
            throw new ApiException(HttpStatus.CONFLICT,"The criteria or review changed. Reload the evidence before saving.");
        if(current.criteria().isEmpty()||input.items().size()!=current.criteria().size())bad("Assess each published requirement exactly once.");
        var seen=new HashSet<Integer>();
        for(var item:input.items()) {
            if(item.index()>=current.criteria().size()||!seen.add(item.index()))bad("Assess each published requirement exactly once.");
            if(item.reason().trim().length()<15)bad("Explain each assessment in at least 15 characters.");
            var quote=item.quote().trim();
            if(item.source().equals("none")) {
                if(!item.assessment().equals("Needs evidence")||!quote.isEmpty())bad("Supported or partial evidence requires a quote from a submitted field.");
            } else {
                var source=current.sources().stream().filter(s->s.field().equals(item.source())).findFirst().orElseThrow();
                if(quote.length()<3||source.text()==null||!source.text().contains(quote))bad("Copy the supporting passage exactly from the selected submitted field.");
            }
        }
        var items=input.items().stream().sorted(Comparator.comparingInt(Item::index)).map(i->new Item(i.index(),i.assessment(),i.source(),i.quote().trim(),i.reason().trim())).toList();
        int supported=(int)items.stream().filter(i->i.assessment().equals("Supported")).count();
        int partial=(int)items.stream().filter(i->i.assessment().equals("Partial")).count();
        int needs=items.size()-supported-partial;
        String band=supported==items.size()?"Strong evidence":supported+partial>0?"Consider":"Needs review";
        var saved=new Review(id,org,id,current.snapshot(),current.criteria(),items,band,supported,partial,needs,current.version()+1,principal.getName(),Instant.now());
        if(current.version()==0) mongo.insert(saved);
        else {
            var changed=mongo.updateFirst(Query.query(Criteria.where("_id").is(id).and("organizationId").is(org).and("version").is(current.version())),
                new Update().set("snapshot",saved.snapshot()).set("criteria",saved.criteria()).set("items",saved.items()).set("band",band)
                    .set("supported",supported).set("partial",partial).set("needsEvidence",needs).set("version",saved.version()).set("actor",saved.actor()).set("at",saved.at()),Review.class);
            if(changed.getModifiedCount()!=1)throw new ApiException(HttpStatus.CONFLICT,"Another reviewer saved first. Reload before saving.");
        }
        mongo.insert(new History(UUID.randomUUID().toString(),saved));
        var application=applications.review(org,id,new ApplicationService.ReviewRequest(band,input.expectedBand(),
            "Criterion review: "+supported+" supported, "+partial+" partial, "+needs+" need evidence. Review version "+saved.version()+"."),principal.getName());
        audit.record(org,"CRITERIA_REVIEW_SAVED",id,"Review version "+saved.version()+"; evidence summary "+band+"; hiring stage unchanged",principal.getName());
        return new Saved(report(org,id),application);
    }
    private void bad(String message) { throw new ApiException(HttpStatus.BAD_REQUEST,message); }
}
