package com.fairmatch.application;

import java.util.List;
import java.security.Principal;

import com.fairmatch.job.JobService;
import com.fairmatch.audit.AuditService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;

@RestController
class ApplicationController {
    private final ApplicationService applications;
    private final AuditService audit;
    private final com.fairmatch.platform.PlatformService platform;
    @org.springframework.beans.factory.annotation.Value("${fairmatch.legacy-public-applications:false}") boolean legacyApplications;

    ApplicationController(ApplicationService applications, AuditService audit,com.fairmatch.platform.PlatformService platform) {
        this.applications = applications;
        this.audit = audit;
        this.platform=platform;
    }

    @PostMapping("/api/public/jobs/{jobId}/applications")
    @ResponseStatus(HttpStatus.CREATED)
    ApplicationService.Receipt submit(@PathVariable String jobId, @Valid @RequestBody ApplicationRequest request) {
        if(!legacyApplications)throw new com.fairmatch.common.ApiException(HttpStatus.UNAUTHORIZED,"Sign into your candidate account to apply.");
        return applications.submit(jobId, request);
    }

    @GetMapping("/api/employer/applications")
    List<ApplicationService.BlindApplication> list(Principal p) {
        return applications.blindList(platform.organizationId(p.getName()));
    }

    @PatchMapping("/api/employer/applications/{id}/stage")
    ApplicationService.BlindApplication stage(@PathVariable String id, @Valid @RequestBody StageRequest request, Principal principal) {
        return applications.changeStage(platform.organizationId(principal.getName()), id, request, principal.getName());
    }

    @GetMapping("/api/employer/audit")
    List<AuditService.Entry> audit(Principal p) {
        return audit.list(platform.organizationId(p.getName()));
    }
    @PostMapping("/api/candidate/jobs/{jobId}/applications") @ResponseStatus(HttpStatus.CREATED)
    ApplicationService.Receipt ownedSubmit(@PathVariable String jobId,@Valid @RequestBody ApplicationRequest r,Principal p) {
        var a=platform.account(p.getName());
        var owned=new ApplicationRequest(a.name(),a.contact(),r.role(),r.experience(),r.education(),r.skills(),r.example(),r.availability(),r.location(),r.consent(),r.evidenceConfirmed(),r.finalConsent());
        return applications.submitOwned(jobId,owned,a.id());
    }
    @GetMapping("/api/candidate/applications") List<ApplicationService.CandidateApplication> owned(Principal p){return applications.owned(platform.account(p.getName()).id());}
    @PostMapping("/api/candidate/applications/{id}/withdrawal") java.util.Map<String,Boolean> withdraw(@PathVariable String id,Principal p){applications.withdraw(platform.account(p.getName()).id(),id);return java.util.Map.of("saved",true);}
    @PostMapping("/api/employer/applications/{id}/review") ApplicationService.BlindApplication review(@PathVariable String id,@Valid @RequestBody ApplicationService.ReviewRequest r,Principal p){return applications.review(platform.organizationId(p.getName()),id,r,p.getName());}
    record Message(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(min=20,max=2000) String message){}
    @GetMapping("/api/candidate/applications/{id}/messages") List<ApplicationService.ConversationMessage> messages(@PathVariable String id,Principal p){return applications.messages(platform.account(p.getName()).id(),id,false);}
    @GetMapping("/api/employer/applications/{id}/messages") List<ApplicationService.ConversationMessage> employerMessages(@PathVariable String id,Principal p){return applications.messages(platform.organizationId(p.getName()),id,true);}
    @PostMapping("/api/candidate/applications/{id}/messages") java.util.Map<String,Boolean> reply(@PathVariable String id,@Valid @RequestBody Message r,Principal p){applications.reply(platform.account(p.getName()).id(),id,r.message());return java.util.Map.of("saved",true);}
    @PostMapping("/api/employer/applications/{id}/information-request") java.util.Map<String,Boolean> request(@PathVariable String id,@Valid @RequestBody Message r,Principal p){applications.requestInformation(platform.organizationId(p.getName()),id,r.message(),p.getName());return java.util.Map.of("saved",true);}
}
