package com.fairmatch.platform;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.time.Instant;
import java.util.*;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.web.bind.annotation.*;
import com.fairmatch.audit.AuditService;

@RestController
class PlatformController {
    private final PlatformService platform;private final AccountSecurityService security;
    PlatformController(PlatformService platform,AccountSecurityService security){this.platform=platform;this.security=security;}
    record Login(@NotBlank @Size(max=60) String username,@NotBlank @Size(max=72) String password){}
    @PostMapping("/api/public/auth/login") AccountSecurityService.Session login(@Valid @RequestBody Login r,jakarta.servlet.http.HttpServletRequest request){return security.login(r.username(),r.password(),request.getRemoteAddr());}
    @PostMapping("/api/public/auth/register") AccountSecurityService.Session register(@Valid @RequestBody PlatformService.Registration r,jakarta.servlet.http.HttpServletRequest request){security.rateLimit("register",request.getRemoteAddr(),10,900);return security.issue(platform.register(r));}
    @GetMapping("/api/account/me") PlatformService.UserView me(Principal p){return platform.account(p.getName()).view();}
    @GetMapping("/api/account/notifications") List<PlatformService.Notification> notifications(Principal p){return platform.notifications(platform.account(p.getName()).id());}
    @PostMapping("/api/account/notifications/{id}/read") Map<String,Boolean> read(@PathVariable String id,Principal p){platform.markRead(platform.account(p.getName()).id(),id);return Map.of("saved",true);}
    @GetMapping("/api/account/cases") List<PlatformService.SupportCase> cases(Principal p){return platform.cases(platform.account(p.getName()).id());}
    @PostMapping("/api/account/cases") PlatformService.SupportCase createCase(@Valid @RequestBody PlatformService.CaseInput r,Principal p){return platform.createCase(platform.account(p.getName()),r);}
    @GetMapping("/api/employer/organization") PlatformService.Organization organization(Principal p){return platform.organization(platform.organizationId(p.getName()));}
    @PutMapping("/api/employer/organization") PlatformService.Organization organization(@Valid @RequestBody PlatformService.OrganizationInput r,Principal p){return platform.saveOrganization(platform.organizationId(p.getName()),r,p.getName());}
    @GetMapping("/api/employer/members") List<PlatformService.Member> members(Principal p){return platform.members(platform.organizationId(p.getName()));}
    @GetMapping("/api/admin/organizations") List<PlatformService.Organization> organizations(){return platform.organizations();}
    @PostMapping("/api/admin/organizations/{id}/review") PlatformService.Organization verify(@PathVariable String id,@Valid @RequestBody PlatformService.OrganizationDecision r,Principal p){return platform.verify(id,r,p.getName());}
    @GetMapping("/api/admin/cases") List<PlatformService.SupportCase> allCases(){return platform.cases(null);}
    @PostMapping("/api/admin/cases/{id}/review") PlatformService.SupportCase resolve(@PathVariable String id,@Valid @RequestBody PlatformService.Decision r,Principal p){return platform.resolveCase(id,r,p.getName());}
    @GetMapping("/api/admin/audit") List<AuditService.Entry> audit(){return platform.allAudit();}
    @GetMapping("/api/candidate/profile") PlatformService.Profile profile(Principal p){return platform.profile(platform.account(p.getName()).id());}
    @PutMapping("/api/candidate/profile") PlatformService.Profile profile(@Valid @RequestBody PlatformService.ProfileInput r,Principal p){return platform.saveProfile(platform.account(p.getName()).id(),r);}
    @GetMapping("/api/candidate/drafts/{jobId}") PlatformService.Draft draft(@PathVariable String jobId,Principal p){return platform.draft(platform.account(p.getName()).id(),jobId);}
    @PutMapping("/api/candidate/drafts/{jobId}") PlatformService.Draft draft(@PathVariable String jobId,@RequestBody Map<String,Object> r,Principal p){return platform.saveDraft(platform.account(p.getName()).id(),jobId,r);}
}
