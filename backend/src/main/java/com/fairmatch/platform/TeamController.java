package com.fairmatch.platform;

import jakarta.validation.Valid;
import java.security.Principal;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
class TeamController {
    private final TeamService team;private final AccountSecurityService security;
    private final TransactionTemplate tx;
    TeamController(TeamService team,AccountSecurityService security,PlatformTransactionManager manager){this.team=team;this.security=security;this.tx=new TransactionTemplate(manager);}
    @GetMapping("/api/employer/team") TeamService.Board board(Principal p){return team.board(p.getName());}
    @PostMapping("/api/employer/team/invitations") @ResponseStatus(HttpStatus.CREATED)
    TeamService.Created invite(@Valid @RequestBody TeamService.InviteInput input,Principal p){security.rateLimit("team-invite",p.getName(),30,3600);return team.invite(p.getName(),input);}
    @PostMapping("/api/employer/team/invitations/{id}/revocation")
    Map<String,Boolean> revoke(@PathVariable String id,@Valid @RequestBody TeamService.Revision input,Principal p){team.revoke(p.getName(),id,input);return Map.of("saved",true);}
    @PostMapping("/api/employer/team/members/{id}/access")
    Map<String,Boolean> access(@PathVariable String id,@Valid @RequestBody TeamService.AccessInput input,Principal p){team.changeAccess(p.getName(),id,input);return Map.of("saved",true);}
    @PostMapping("/api/public/team/accept")
    AccountSecurityService.Session accept(@Valid @RequestBody TeamService.Acceptance input,jakarta.servlet.http.HttpServletRequest request){
        security.rateLimit("team-accept",request.getRemoteAddr(),20,900);
        return tx.execute(status -> security.issue(team.accept(input)));
    }
}
