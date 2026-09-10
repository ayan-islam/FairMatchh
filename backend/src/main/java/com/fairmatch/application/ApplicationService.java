package com.fairmatch.application;

import java.time.*;
import java.util.*;

import com.fairmatch.job.JobService;
import com.fairmatch.audit.AuditService;
import com.fairmatch.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.*;

@Service
public class ApplicationService {
    private final ApplicationRepository applications;
    private final JobService jobs;
    private final AuditService audit;
    private final MongoTemplate mongo;
    private final com.fairmatch.platform.PlatformService platform;
    private final org.springframework.context.ApplicationEventPublisher events;

    ApplicationService(ApplicationRepository applications, JobService jobs, AuditService audit, MongoTemplate mongo, com.fairmatch.platform.PlatformService platform,org.springframework.context.ApplicationEventPublisher events) {
        this.applications = applications;
        this.jobs = jobs;
        this.audit = audit;
        this.mongo = mongo;
        this.platform=platform;
        this.events=events;
    }

    @Transactional
    public Receipt submit(String jobId, ApplicationRequest r) {
        return submitOwned(jobId,r,null);
    }
    @Transactional public Receipt submitOwned(String jobId,ApplicationRequest r,String ownerId) {
        var organization = jobs.organizationForOpenJob(jobId);
        var contact = r.contact().trim().toLowerCase(Locale.ROOT);
        if (!contact.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$") && !contact.matches("^\\+?[0-9][0-9 ()-]{7,19}$"))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Enter a valid email address or mobile number.");
        if (!contact.contains("@")) contact = contact.replaceAll("[ ()-]", "");
        if (applications.existsByJobIdAndNormalizedContact(jobId, contact))
            throw new ApiException(HttpStatus.CONFLICT, "This contact has already applied for this job.");
        var a = applications.insert(new ApplicationDocument("FM-" + UUID.randomUUID(), organization, jobId, r.name().trim(), contact, r.role().trim(), r.experience().trim(), r.education().trim(), r.skills().stream().map(String::trim).distinct().toList(), r.example().trim(), r.availability(), r.location(), "New", "Needs review", "2026-09-v1", Instant.now(), null, null,ownerId));
        jobs.countApplication(jobId);
        audit.record(organization, "APPLICATION_SUBMITTED", a.id());
        platform.notify(ownerId,"Application submitted","Your application was saved and is ready for employer review.",a.id());
        platform.notifyOrganization(organization,"New application","A new application is ready for evidence review.",a.id());
        return new Receipt(a.id(), jobId, "Submitted", a.appliedAt());
    }

    public List<BlindApplication> blindList(String organizationId) {
        return applications.findByOrganizationIdOrderByAppliedAtDesc(organizationId).stream().map(this::blind).toList();
    }

    public String requireInterviewCandidate(String organizationId, String id) {
        var candidate=applications.findByIdAndOrganizationId(id, organizationId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,"Application not found in this organization."));
        if (Set.of("Hired","Not selected","Withdrawn").contains(candidate.stage()))
            throw new ApiException(HttpStatus.CONFLICT,"This application has a final decision. Change its stage before scheduling an interview.");
        return candidate.jobId();
    }

    @Transactional
    public BlindApplication changeStage(String organizationId, String id, StageRequest request, String actor) {
        var current=applications.findByIdAndOrganizationId(id,organizationId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Application not found."));
        if(current.stage().equals("Withdrawn"))throw new ApiException(HttpStatus.CONFLICT,"The candidate withdrew this application.");
        if (request.reason().trim().length() < 15)
            throw new ApiException(HttpStatus.BAD_REQUEST, "Add a job-related reason of at least 15 characters.");
        if (request.stage().equals(request.expectedStage()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Choose a different hiring stage.");
        var scope = Criteria.where("_id").is(id).and("organizationId").is(organizationId);
        if (!mongo.exists(Query.query(scope), ApplicationDocument.class))
            throw new ApiException(HttpStatus.NOT_FOUND, "Application not found in this organization.");
        // Match the stage the reviewer actually saw, preventing a stale tab from overwriting a newer decision.
        var query = Query.query(Criteria.where("_id").is(id).and("organizationId").is(organizationId).and("stage").is(request.expectedStage()));
        var update = new Update().set("stage", request.stage()).set("stageReason", request.reason().trim()).set("stageChangedAt", Instant.now());
        var saved = mongo.findAndModify(query, update, FindAndModifyOptions.options().returnNew(true), ApplicationDocument.class);
        if (saved == null)
            throw new ApiException(HttpStatus.CONFLICT, "This application's stage changed. Close this dialog, refresh data and try again.");
        audit.record(organizationId, "APPLICATION_STAGE_CHANGED", id, request.expectedStage() + " -> " + request.stage() + ": " + request.reason().trim(), actor);
        platform.notify(saved.ownerId(),"Application status updated","Your application is now: "+request.stage(),id);
        if(Set.of("Hired","Not selected").contains(request.stage()))events.publishEvent(new FinalDecision(organizationId,id,"Application reached final stage: "+request.stage(),actor));
        return blind(saved);
    }

    public void notifyCandidate(String organizationId,String id,String title,String message) {
        applications.findByIdAndOrganizationId(id,organizationId).ifPresent(a->platform.notify(a.ownerId(),title,message,id));
    }
    public List<CandidateApplication> owned(String ownerId) {
        return applications.findByOwnerIdOrderByAppliedAtDesc(ownerId).stream().map(a->new CandidateApplication(a.id(),a.jobId(),a.stage(),a.appliedAt(),a.role(),a.experience(),a.education(),a.skills(),a.example(),jobs.applicationJobTitle(a.organizationId(),a.jobId()))).toList();
    }
    @Transactional public void withdraw(String ownerId,String id) {
        var old=applications.findByIdAndOwnerId(id,ownerId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Application not found."));
        if(Set.of("Hired","Not selected","Withdrawn").contains(old.stage()))throw new ApiException(HttpStatus.CONFLICT,"This application already has a final outcome.");
        var result=mongo.updateFirst(Query.query(Criteria.where("_id").is(id).and("ownerId").is(ownerId).and("stage").is(old.stage())),
            new Update().set("stage","Withdrawn").set("stageReason","Candidate withdrew the application.").set("stageChangedAt",Instant.now()),ApplicationDocument.class);
        if(result.getModifiedCount()!=1)throw new ApiException(HttpStatus.CONFLICT,"Application changed. Refresh and try again.");
        audit.record(old.organizationId(),"APPLICATION_WITHDRAWN",id,"Candidate initiated withdrawal",ownerId);
        platform.notify(ownerId,"Application withdrawn","Your withdrawal has been recorded.",id);
        platform.notifyOrganization(old.organizationId(),"Application withdrawn","The candidate withdrew this application.",id);
        events.publishEvent(new FinalDecision(old.organizationId(),id,"Candidate withdrew the application.",ownerId));
    }
    public record FinalDecision(String organizationId,String applicationId,String reason,String actor){}
    @Transactional public BlindApplication review(String org,String id,ReviewRequest r,String actor) {
        if(r.reason().trim().length()<20)throw new ApiException(HttpStatus.BAD_REQUEST,"Record at least 20 characters of evidence reasoning.");
        var saved=mongo.findAndModify(Query.query(Criteria.where("_id").is(id).and("organizationId").is(org).and("band").is(r.expectedBand())),
            new Update().set("band",r.band()),FindAndModifyOptions.options().returnNew(true),ApplicationDocument.class);
        if(saved==null)throw new ApiException(HttpStatus.CONFLICT,"The evidence review changed or is unavailable. Refresh and try again.");
        audit.record(org,"EVIDENCE_REVIEWED",id,r.band()+": "+r.reason().trim(),actor);return blind(saved);
    }
    @Transactional public void requestInformation(String org,String id,String message,String actor) {
        var a=applications.findByIdAndOrganizationId(id,org).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Application not found."));
        if(message.trim().length()<20)throw new ApiException(HttpStatus.BAD_REQUEST,"Add a useful request of at least 20 characters.");
        if(a.ownerId()==null)throw new ApiException(HttpStatus.CONFLICT,"This legacy application has no candidate account. Contact the candidate directly.");
        platform.notify(a.ownerId(),"Employer requests information",message.trim(),id);audit.record(org,"INFORMATION_REQUESTED",id,message.trim(),actor);
        mongo.insert(new ConversationMessage(UUID.randomUUID().toString(),org,id,"Employer",message.trim(),Instant.now()));
    }
    public List<ConversationMessage> messages(String scope,String id,boolean employer) {
        if(employer)applications.findByIdAndOrganizationId(id,scope).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Application not found."));
        else applications.findByIdAndOwnerId(id,scope).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Application not found."));
        return mongo.find(Query.query(Criteria.where("applicationId").is(id)).with(org.springframework.data.domain.Sort.by("at")),ConversationMessage.class);
    }
    @Transactional public void reply(String ownerId,String id,String message) {
        var a=applications.findByIdAndOwnerId(id,ownerId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Application not found."));
        if(message.trim().length()<20)throw new ApiException(HttpStatus.BAD_REQUEST,"Add at least 20 characters of supporting information.");
        // Serialize new ranking evidence with an in-flight assessment of this application.
        mongo.updateFirst(Query.query(Criteria.where("_id").is(id).and("ownerId").is(ownerId)),new Update().inc("rankingFence",1),ApplicationDocument.class);
        mongo.insert(new ConversationMessage(UUID.randomUUID().toString(),a.organizationId(),id,"Candidate",message.trim(),Instant.now()));
        platform.notifyOrganization(a.organizationId(),"Candidate added information",message.trim(),id);
        audit.record(a.organizationId(),"CANDIDATE_INFORMATION_ADDED",id,"Candidate submitted supporting information",ownerId);
    }
    @org.springframework.data.mongodb.core.mapping.Document("application_messages")
    public record ConversationMessage(@org.springframework.data.annotation.Id String id,String organizationId,String applicationId,String sender,String message,Instant at){}
    public record CandidateApplication(String id,String jobId,String stage,Instant appliedAt,String role,String experience,String education,List<String> skills,String example,String jobTitle){}
    public record ReviewRequest(@jakarta.validation.constraints.Pattern(regexp="Strong evidence|Consider|Needs review") @jakarta.validation.constraints.NotNull String band,
        @jakarta.validation.constraints.NotBlank String expectedBand,@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=2000) String reason){}

    private BlindApplication blind(ApplicationDocument a) {
        return new BlindApplication(a.id(), a.jobId(), "To confirm", a.skills(), a.band(), a.stage(), a.appliedAt().atZone(ZoneId.of("Asia/Dhaka")).toLocalDate().toString(), a.experience(), a.education(), a.example(), a.availability(), a.location(), a.stageReason(), a.stageChangedAt());
    }

    public record Receipt(String id, String jobId, String status, Instant submittedAt) {
    }

    public record BlindApplication(String id, String jobId, String experience, List<String> skills, String band,
                                   String stage, String applied, String evidence, String education, String example,
                                   String availability, String location, String stageReason, Instant stageChangedAt) {
    }
}
