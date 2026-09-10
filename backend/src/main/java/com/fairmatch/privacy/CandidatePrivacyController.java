package com.fairmatch.privacy;

import com.fairmatch.audit.AuditService;
import com.fairmatch.common.ApiException;
import com.fairmatch.platform.AccountSecurityService;
import com.fairmatch.platform.PlatformService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.security.Principal;
import java.time.Instant;
import java.util.*;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.*;
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

    CandidatePrivacyController(PlatformService platform, AccountSecurityService security, MongoTemplate mongo, AuditService audit) {
        this.platform = platform; this.security = security; this.mongo = mongo; this.audit = audit;
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
        var applications = read("applications", owned, "jobId","stage","appliedAt","role","experience","education","skills","example","availability","location","consentVersion","name","normalizedContact");
        var applicationIds = applications.stream().map(d -> d.getString("_id")).toList();
        var body = new LinkedHashMap<String,Object>();
        body.put("schemaVersion", 1);
        body.put("exportStartedAt", startedAt);
        body.put("account", account.view());
        body.put("accountCreatedAt", account.createdAt());
        body.put("profile", platform.profile(account.id()));
        body.put("drafts", read("application_drafts",owned,"jobId","values","updatedAt"));
        body.put("applications", applications);
        body.put("conversations", read("application_messages",Criteria.where("applicationId").in(applicationIds),"applicationId","sender","message","at"));
        body.put("interviews", read("interviews",Criteria.where("candidateId").in(applicationIds),"candidateId","jobId","date","time","format","location","status","cancellationReason"));
        body.put("notifications", read("notifications",owned,"title","message","reference","createdAt","read"));
        body.put("supportCases", read("support_cases",owned,"subject","category","reference","status","detail","response","createdAt","version"));
        body.put("documents", read("candidate_documents",owned,"filename","bytes","status","text","createdAt","extractionVersion","warnings","pages.number","pages.text","pages.method","pages.truncated","suggestions.field","suggestions.value","suggestions.page","suggestions.start","suggestions.end","suggestions.method"));
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
}
