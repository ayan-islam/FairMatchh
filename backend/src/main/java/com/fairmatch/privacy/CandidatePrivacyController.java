package com.fairmatch.privacy;

import com.fairmatch.audit.AuditService;
import com.fairmatch.application.ApplicationService;
import com.fairmatch.common.ApiException;
import com.fairmatch.document.DocumentController;
import com.fairmatch.platform.AccountSecurityService;
import com.fairmatch.platform.PlatformService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.time.Instant;
import java.util.*;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/** Candidate-owned read projections. Never serialize account, reviewer or security documents wholesale. */
@RestController
@RequestMapping("/api/candidate/privacy")
class CandidatePrivacyController {
    private static final int MAX_RECORDS = 1000;
    private final PlatformService platform;
    private final AccountSecurityService security;
    private final MongoTemplate mongo;
    private final AuditService audit;
    private final ApplicationService applications;
    private final DocumentController documents;
    private final PasswordEncoder passwords;

    CandidatePrivacyController(PlatformService platform, AccountSecurityService security, MongoTemplate mongo, AuditService audit,
        ApplicationService applications, DocumentController documents, PasswordEncoder passwords) {
        this.platform = platform; this.security = security; this.mongo = mongo; this.audit = audit;
        this.applications = applications; this.documents = documents; this.passwords = passwords;
    }

    private List<Document> read(String collection, Criteria scope, String... fields) {
        var query = Query.query(scope).with(Sort.by("_id")).limit(MAX_RECORDS + 1);
        query.fields().include(fields);
        var records = mongo.find(query, Document.class, collection);
        if (records.size() > MAX_RECORDS)
            throw new ApiException(HttpStatus.CONFLICT, "This export exceeds the local download limit. Contact support for a complete export; no partial file was generated.");
        return records;
    }

    @GetMapping("/drafts")
    List<PlatformService.Draft> drafts(Principal principal) {
        var owner = platform.account(principal.getName()).id();
        return mongo.find(Query.query(Criteria.where("ownerId").is(owner)).with(Sort.by(Sort.Direction.DESC,"updatedAt")), PlatformService.Draft.class);
    }

    record DraftRemoval(@NotNull Instant expectedUpdatedAt) {}

    @DeleteMapping("/drafts/{jobId}")
    @Transactional
    Map<String, Boolean> deleteDraft(@PathVariable String jobId, @Valid @RequestBody DraftRemoval input, Principal principal) {
        var owner = platform.account(principal.getName()).id();
        var scope = Criteria.where("_id").is(owner + ":" + jobId).and("ownerId").is(owner);
        if (!mongo.exists(Query.query(scope), PlatformService.Draft.class))
            throw new ApiException(HttpStatus.NOT_FOUND,"Saved draft not found.");
        var removed = mongo.remove(Query.query(scope.and("updatedAt").is(input.expectedUpdatedAt())), PlatformService.Draft.class);
        if (removed.getDeletedCount() != 1)
            throw new ApiException(HttpStatus.CONFLICT,"This draft changed in another tab. Refresh before deleting it.");
        audit.record("platform","CANDIDATE_DRAFT_DELETED",jobId,"Candidate deleted an unfinished application draft",principal.getName());
        return Map.of("deleted",true);
    }

    @GetMapping("/export")
    ResponseEntity<Map<String,Object>> export(Principal principal) {
        var account = platform.account(principal.getName());
        security.rateLimit("candidate-export", account.id(), 6, 3600);
        var startedAt = Instant.now();
        var owned = Criteria.where("ownerId").is(account.id());
        var applications = read("applications", owned, "jobId","stage","appliedAt","role","experience","education","skills","example","availability","location","cvSummary","consentVersion","name","normalizedContact");
        var applicationIds = applications.stream().map(d -> d.getString("_id")).toList();
        var body = new LinkedHashMap<String,Object>();
        body.put("schemaVersion", 2);
        body.put("exportStartedAt", startedAt);
        body.put("account", account.view());
        body.put("accountCreatedAt", account.createdAt());
        body.put("profile", platform.profile(account.id()));
        body.put("drafts", read("application_drafts",owned,"jobId","values","updatedAt"));
        body.put("visitedJobs", read("candidate_job_visits",owned,"jobId","firstVisitedAt","lastVisitedAt"));
        body.put("applications", applications);
        body.put("conversations", read("application_messages",Criteria.where("applicationId").in(applicationIds),"applicationId","sender","message","at"));
        body.put("interviews", read("interviews",Criteria.where("candidateId").in(applicationIds),"candidateId","jobId","date","time","format","location","status","cancellationReason"));
        body.put("notifications", read("notifications",owned,"title","message","reference","createdAt","read"));
        body.put("supportCases", read("support_cases",owned,"subject","category","reference","status","detail","response","createdAt","version"));
        body.put("documents", read("candidate_documents",owned,"filename","bytes","status","text","createdAt","extractionVersion","warnings","pages.number","pages.text","pages.method","pages.truncated","suggestions.field","suggestions.value","suggestions.page","suggestions.start","suggestions.end","suggestions.method","aiStatus","aiReview.provider","aiReview.model","aiReview.promptVersion","aiReview.reviewedAt","aiReview.summary","aiReview.skills","aiReview.courses","aiReview.projects","aiReview.experience","aiReview.warnings"));
        body.put("scopeNotes",List.of(
            "Contains records linked to this signed-in candidate account. Legacy anonymous applications are not matched by email.",
            "Original CV files are downloaded separately from Documents. This JSON includes document metadata and extracted text.",
            "Passwords, tokens, codes, internal reviewer notes/scores and other accounts' records are excluded.",
            "Records are read between exportStartedAt and exportFinishedAt; concurrent updates may appear at different points in that interval."
        ));
        body.put("exportFinishedAt", Instant.now());
        audit.record("platform","CANDIDATE_DATA_EXPORTED",account.id(),"Candidate downloaded their account-linked recruitment records",principal.getName());
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON)
            .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\"fairmatch-candidate-data.json\"")
            .header(HttpHeaders.CACHE_CONTROL,"no-store, private").body(body);
    }

    record AccountErasure(
        @NotBlank(message="Current password is required.") @Size(max=72,message="Password must be at most 72 characters.") String password,
        @NotBlank(message="Type DELETE MY ACCOUNT to confirm.")
        @Pattern(regexp="DELETE MY ACCOUNT",message="Type DELETE MY ACCOUNT exactly to confirm permanent deletion.") String confirmation) {}
    record ErasureReceipt(boolean deleted,String receipt,int applicationsRemoved,int documentsRemoved) {}

    @DeleteMapping("/account")
    @Transactional
    ErasureReceipt eraseAccount(@Valid @RequestBody AccountErasure input, Principal principal) {
        var account=platform.account(principal.getName());
        if(!account.role().equals("CANDIDATE"))throw new ApiException(HttpStatus.FORBIDDEN,"Candidate account required.");
        security.rateLimit("candidate-erasure",account.id(),3,3600);
        if(input.password().getBytes(StandardCharsets.UTF_8).length>72||!passwords.matches(input.password(),account.passwordHash()))
            throw new ApiException(HttpStatus.BAD_REQUEST,"Current password is incorrect. Your account was not changed.");

        // Storage objects go first. If the private document service is unavailable, fail without deleting the account metadata.
        int documentsRemoved=documents.eraseAllForOwner(account.id());
        int applicationsRemoved=applications.eraseOwnedApplications(account.id());

        var supportIds=mongo.find(Query.query(Criteria.where("ownerId").is(account.id())),Document.class,"support_cases")
            .stream().map(d->d.getString("_id")).filter(Objects::nonNull).toList();
        mongo.remove(Query.query(Criteria.where("ownerId").is(account.id())),"application_drafts");
        mongo.remove(Query.query(Criteria.where("ownerId").is(account.id())),"candidate_job_visits");
        mongo.remove(Query.query(Criteria.where("ownerId").is(account.id())),"notifications");
        mongo.remove(Query.query(Criteria.where("ownerId").is(account.id())),"support_cases");
        mongo.remove(Query.query(Criteria.where("_id").is(account.id())),"profiles");
        mongo.remove(Query.query(Criteria.where("ownerId").is(account.id())),"account_sessions");
        mongo.remove(Query.query(Criteria.where("ownerId").is(account.id())),"account_challenges");
        mongo.remove(Query.query(Criteria.where("_id").is(account.id())),"account_verifications");
        mongo.remove(Query.query(Criteria.where("recipient").is(account.contact())),"email_outbox");

        var auditScope=new ArrayList<Criteria>();
        auditScope.add(Criteria.where("actor").in(account.username(),account.id()));
        auditScope.add(Criteria.where("reference").is(account.id()));
        if(!supportIds.isEmpty())auditScope.add(Criteria.where("reference").in(supportIds));
        mongo.remove(Query.query(new Criteria().orOperator(auditScope)),"audit_events");

        var deleted=mongo.remove(Query.query(Criteria.where("_id").is(account.id()).and("role").is("CANDIDATE").and("passwordHash").is(account.passwordHash())),PlatformService.Account.class);
        if(deleted.getDeletedCount()!=1)throw new ApiException(HttpStatus.CONFLICT,"The account changed during deletion. Sign in again and retry.");

        String receipt="ERASE-"+UUID.randomUUID();
        audit.record("platform","CANDIDATE_ACCOUNT_ERASED",receipt,"Candidate account and account-linked recruitment data were permanently erased","candidate-self-service");
        return new ErasureReceipt(true,receipt,applicationsRemoved,documentsRemoved);
    }
}
