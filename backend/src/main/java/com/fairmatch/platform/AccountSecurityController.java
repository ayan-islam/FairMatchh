package com.fairmatch.platform;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import jakarta.servlet.http.HttpServletRequest;
import java.security.Principal;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
class AccountSecurityController {
    private final AccountSecurityService security;
    AccountSecurityController(AccountSecurityService security){this.security=security;}
    record Identity(@NotBlank @Size(max=160) String identity){}
    record Code(@NotBlank @Size(max=100) String challengeId,@Pattern(regexp="[0-9]{6}") @NotNull String code){}
    record Reset(@NotBlank @Size(max=100) String challengeId,@Pattern(regexp="[0-9]{6}") @NotNull String code,@NotBlank @Size(min=10,max=72) String password){}
    record Password(@NotBlank @Size(max=72) String currentPassword,@NotBlank @Size(min=10,max=72) String newPassword){}
    @GetMapping("/api/account/security") AccountSecurityService.Status status(Principal p){return security.status(p.getName());}
    @PostMapping("/api/account/logout") Map<String,Boolean> logout(Principal p,@AuthenticationPrincipal Jwt jwt){security.logout(p.getName(),jwt==null?null:jwt.getId(),false);return Map.of("saved",true);}
    @PostMapping("/api/account/logout-all") Map<String,Boolean> logoutAll(Principal p){security.logout(p.getName(),null,true);return Map.of("saved",true);}
    @PostMapping("/api/account/password") Map<String,Boolean> password(Principal p,@Valid @RequestBody Password r){security.changePassword(p.getName(),r.currentPassword(),r.newPassword());return Map.of("saved",true);}
    @PostMapping("/api/public/auth/recovery") AccountSecurityService.ChallengeView recovery(@Valid @RequestBody Identity r,HttpServletRequest request){return security.recovery(r.identity(),request.getRemoteAddr());}
    @PostMapping("/api/public/auth/reset") Map<String,Boolean> reset(@Valid @RequestBody Reset r){security.reset(r.challengeId(),r.code(),r.password());return Map.of("saved",true);}
    @PostMapping("/api/account/verification") AccountSecurityService.ChallengeView verify(Principal p){return security.requestVerification(p.getName());}
    @PostMapping("/api/account/verification/confirm") Map<String,Boolean> confirm(Principal p,@Valid @RequestBody Code r){security.verify(p.getName(),r.challengeId(),r.code());return Map.of("saved",true);}
}
