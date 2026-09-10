package com.fairmatch.application;

import com.fairmatch.audit.AuditService;
import com.fairmatch.common.ApiException;
import com.fairmatch.job.JobService;
import com.fairmatch.platform.PlatformService;
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
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/** Process checks are explainable diagnostics, not demographic parity claims or hiring decisions. */
@RestController
class GovernanceController {
    private final ApplicationService applications; private final JobService jobs;
    private final PlatformService platform; private final AuditService audit; private final MongoTemplate mongo;
    GovernanceController(ApplicationService applications,JobService jobs,PlatformService platform,AuditService audit,MongoTemplate mongo) {
        this.applications=applications;this.jobs=jobs;this.platform=platform;this.audit=audit;this.mongo=mongo;
    }
    record Check(String label,long issues,String explanation) {}
    record Report(String jobId,String snapshot,int applications,List<Check> checks,Review latestReview,boolean reviewCurrent) {}
    @Document("fairness_reviews") record Review(@Id String id,String organizationId,String jobId,String snapshot,String reason,String actor,Instant at) {}
    record ReviewInput(@NotBlank String snapshot,@NotBlank @Size(min=20,max=2000) String reason,@AssertTrue boolean confirmed) {}
    Report report(String org,String jobId) {
        var job=jobs.employerJobs(org).stream().filter(j->j.id().equals(jobId)).findFirst().orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Job not found."));
        var rows=applications.blindList(org).stream().filter(a->a.jobId().equals(jobId)).toList();
        var checks=List.of(new Check("No applicant fee",job.noFeeConfirmed()?0:1,"Employer must confirm the no-fee policy."),
            new Check("Published criteria",job.requirements().isEmpty()?1:0,"Review candidates against the same job-related requirements."),
            new Check("Evidence awaiting review",rows.stream().filter(a->a.band().equals("Needs review")).count(),"A human must review evidence; the system never assigns a hiring outcome."),
            new Check("Recorded decision reasons",rows.stream().filter(a->!a.stage().equals("New")&&(a.stageReason()==null||a.stageReason().isBlank())).count(),"Every stage change needs a recorded job-related reason."));
        String snapshot;
        try { snapshot=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((job.toString()+rows.toString()).getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}
        var last=mongo.findOne(Query.query(Criteria.where("organizationId").is(org).and("jobId").is(jobId)).with(Sort.by(Sort.Direction.DESC,"at")),Review.class);
        return new Report(jobId,snapshot,rows.size(),checks,last,last!=null&&last.snapshot().equals(snapshot));
    }
    @GetMapping("/api/employer/jobs/{jobId}/fairness") Report report(@PathVariable String jobId,Principal p){return report(platform.organizationId(p.getName()),jobId);}
    @PostMapping("/api/employer/jobs/{jobId}/fairness") @Transactional
    Report review(@PathVariable String jobId,@Valid @RequestBody ReviewInput r,Principal p) {
        var org=platform.organizationId(p.getName());var report=report(org,jobId);
        if(!report.snapshot().equals(r.snapshot()))throw new ApiException(HttpStatus.CONFLICT,"Job or applications changed. Reload the checks before reviewing.");
        if(r.reason().trim().length()<20)throw new ApiException(HttpStatus.BAD_REQUEST,"Record at least 20 characters of reasoning.");
        mongo.insert(new Review(UUID.randomUUID().toString(),org,jobId,r.snapshot(),r.reason().trim(),p.getName(),Instant.now()));
        audit.record(org,"FAIRNESS_PROCESS_REVIEWED",jobId,r.reason().trim(),p.getName());return report(org,jobId);
    }
}
