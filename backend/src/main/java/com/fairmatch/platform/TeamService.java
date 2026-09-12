package com.fairmatch.platform;

import com.fairmatch.audit.AuditService;
import com.fairmatch.common.ApiException;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner-managed recruitment access. Invitation codes are shown once and stored only as hashes. */
@Service
public class TeamService {
    private final MongoTemplate mongo;
    private final PlatformService platform;
    private final PasswordEncoder passwords;
    private final AuditService audit;
    TeamService(MongoTemplate mongo,PlatformService platform,PasswordEncoder passwords,AuditService audit) {
        this.mongo=mongo;this.platform=platform;this.passwords=passwords;this.audit=audit;
    }
    @Document("team_invitations") record Invitation(@Id String id,String organizationId,String email,
        @Indexed(unique=true) String codeHash,String status,long version,Instant createdAt,Instant expiresAt,String actor,String acceptedBy) {}
    @Document("team_access") record Access(@Id String id,String organizationId,String status,long version,String reason,String actor,Instant at) {}
    public record InviteInput(@NotBlank @Email @Size(max=160) String email) {}
    public record Revision(@Min(0) long expectedVersion) {}
    public record AccessInput(@NotNull @Pattern(regexp="Active|Suspended") String status,@Min(0) long expectedVersion,
        @NotBlank @Size(min=15,max=1000) String reason) {}
    public record Acceptance(@NotBlank @Pattern(regexp="[A-Za-z0-9_-]{43}") String code,
        @NotBlank @Email @Size(max=160) String email,@NotBlank @Pattern(regexp="[a-zA-Z0-9_.-]{3,60}") String username,
        @NotBlank @Size(max=160) String name,@NotBlank @Size(min=10,max=72) String password) {}
    public record InviteView(String id,String email,String status,long version,Instant createdAt,Instant expiresAt) {}
    public record MemberView(String id,String name,String email,String role,String status,long version) {}
    public record Board(boolean canManage,String organizationName,List<MemberView> members,List<InviteView> invitations) {}
    public record Created(InviteView invitation,String code) {}
    private static String normalize(String value){return value.trim().toLowerCase(Locale.ROOT);}
    private String hash(String code) {
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(code.getBytes(StandardCharsets.UTF_8)));}
        catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}
    }
    private InviteView view(Invitation i){return new InviteView(i.id(),i.email(),i.status().equals("Pending")&&!i.expiresAt().isAfter(Instant.now())?"Expired":i.status(),i.version(),i.createdAt(),i.expiresAt());}
    private void lock(String org) {
        if(mongo.updateFirst(Query.query(Criteria.where("_id").is(org)),new Update().inc("teamFence",1),PlatformService.Organization.class).getMatchedCount()!=1)
            throw new ApiException(HttpStatus.NOT_FOUND,"Organization not found.");
    }
    public Board board(String username) {
        var org=platform.organizationId(username);var owner=platform.organizationOwner(org).id();
        boolean manage=platform.account(username).id().equals(owner);
        var members=mongo.find(Query.query(Criteria.where("organizationId").is(org)).with(Sort.by("createdAt","_id")),PlatformService.Account.class).stream().map(a->{
            var access=mongo.findById(a.id(),Access.class);
            return new MemberView(a.id(),a.name(),a.contact(),owner.equals(a.id())?"Owner":"Recruiter",access==null?"Active":access.status(),access==null?0:access.version());
        }).toList();
        var invitations=manage?mongo.find(Query.query(Criteria.where("organizationId").is(org)).with(Sort.by(Sort.Direction.DESC,"createdAt","_id")).limit(100),Invitation.class).stream().map(this::view).toList():List.<InviteView>of();
        return new Board(manage,platform.organization(org).name(),members,invitations);
    }
    @Transactional public Created invite(String username,InviteInput input) {
        var org=platform.requireOrganizationOwner(username);lock(org);var email=normalize(input.email());
        if(mongo.exists(Query.query(Criteria.where("contact").is(email)),PlatformService.Account.class))
            throw new ApiException(HttpStatus.CONFLICT,"This email already has an account. Invitations currently require a new account; existing accounts are not transferred between workspaces.");
        if(mongo.exists(Query.query(Criteria.where("organizationId").is(org).and("email").is(email).and("status").is("Pending").and("expiresAt").gt(Instant.now())),Invitation.class))
            throw new ApiException(HttpStatus.CONFLICT,"An active invitation already exists for this email. Revoke it before creating a replacement.");
        if(mongo.count(Query.query(Criteria.where("organizationId").is(org).and("status").is("Pending").and("expiresAt").gt(Instant.now())),Invitation.class)>=25)
            throw new ApiException(HttpStatus.CONFLICT,"This organization already has 25 pending invitations. Revoke unused invitations first.");
        byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);
        var code=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);var now=Instant.now();
        var saved=mongo.insert(new Invitation(UUID.randomUUID().toString(),org,email,hash(code),"Pending",0,now,now.plusSeconds(48*3600),username,null));
        audit.record(org,"TEAM_INVITATION_CREATED",saved.id(),"Recruiter invitation created; expires in 48 hours",username);
        return new Created(view(saved),code);
    }
    @Transactional public void revoke(String username,String id,Revision input) {
        var org=platform.requireOrganizationOwner(username);lock(org);
        var changed=mongo.updateFirst(Query.query(Criteria.where("_id").is(id).and("organizationId").is(org).and("version").is(input.expectedVersion()).and("status").is("Pending")),
            new Update().set("status","Revoked").inc("version",1),Invitation.class);
        if(changed.getModifiedCount()!=1)conflict("Invitation changed or is unavailable. Refresh the team list.");
        audit.record(org,"TEAM_INVITATION_REVOKED",id,"Unused invitation revoked",username);
    }
    @Transactional public PlatformService.Account accept(Acceptance input) {
        var invitation=mongo.findOne(Query.query(Criteria.where("codeHash").is(hash(input.code()))),Invitation.class);
        if(invitation==null)invalidInvitation();
        lock(invitation.organizationId());
        invitation=mongo.findById(invitation.id(),Invitation.class);
        if(!invitation.status().equals("Pending")||!invitation.expiresAt().isAfter(Instant.now())||!invitation.email().equals(normalize(input.email())))invalidInvitation();
        // Fix legacy ownership before introducing another employer into that organization.
        platform.organizationOwner(invitation.organizationId());
        if(input.password().getBytes(StandardCharsets.UTF_8).length>72)
            throw new ApiException(HttpStatus.BAD_REQUEST,"Password must be at most 72 UTF-8 bytes.");
        var username=normalize(input.username());var email=normalize(input.email());
        if(mongo.exists(Query.query(new Criteria().orOperator(Criteria.where("username").is(username),Criteria.where("contact").is(email))),PlatformService.Account.class))
            throw new ApiException(HttpStatus.CONFLICT,"Username or email is already registered. Existing accounts cannot be transferred using an invitation.");
        var account=mongo.insert(new PlatformService.Account(UUID.randomUUID().toString(),username,email,input.name().trim(),"EMPLOYER",invitation.organizationId(),passwords.encode(input.password()),Instant.now()));
        mongo.insert(new Access(account.id(),invitation.organizationId(),"Active",0,"Joined using an owner-issued invitation",invitation.actor(),Instant.now()));
        var changed=mongo.updateFirst(Query.query(Criteria.where("_id").is(invitation.id()).and("status").is("Pending").and("version").is(invitation.version())),
            new Update().set("status","Accepted").set("acceptedBy",account.id()).inc("version",1),Invitation.class);
        if(changed.getModifiedCount()!=1)conflict("Invitation changed. Refresh before trying again.");
        audit.record(invitation.organizationId(),"TEAM_MEMBER_JOINED",account.id(),"Recruiter joined the organization",account.username());
        platform.notify(platform.organizationOwner(invitation.organizationId()).id(),"Team member joined",account.name()+" joined as a recruiter.",account.id());
        return account;
    }
    @Transactional public void changeAccess(String username,String id,AccessInput input) {
        var org=platform.requireOrganizationOwner(username);lock(org);
        if(platform.organizationOwner(org).id().equals(id))throw new ApiException(HttpStatus.CONFLICT,"The organization owner cannot be suspended or changed here.");
        var account=mongo.findOne(Query.query(Criteria.where("_id").is(id).and("organizationId").is(org).and("role").is("EMPLOYER")),PlatformService.Account.class);
        if(account==null)throw new ApiException(HttpStatus.NOT_FOUND,"Team member not found.");
        var old=mongo.findById(id,Access.class);long version=old==null?0:old.version();String status=old==null?"Active":old.status();
        if(version!=input.expectedVersion()||status.equals(input.status()))conflict("This member's access changed. Refresh the team list.");
        if(input.reason().trim().length()<15)throw new ApiException(HttpStatus.BAD_REQUEST,"Record a reason of at least 15 characters.");
        mongo.save(new Access(id,org,input.status(),version+1,input.reason().trim(),username,Instant.now()));
        if(input.status().equals("Suspended"))mongo.updateMulti(Query.query(Criteria.where("ownerId").is(id)),new Update().set("revoked",true),"account_sessions");
        audit.record(org,"TEAM_ACCESS_CHANGED",id,status+" -> "+input.status()+": "+input.reason().trim(),username);
        platform.notify(id,"Organization access updated","Your access is now "+input.status()+". "+input.reason().trim(),id);
    }
    private void invalidInvitation(){throw new ApiException(HttpStatus.BAD_REQUEST,"Invitation is invalid, expired, revoked, already used or does not match this email.");}
    private void conflict(String message){throw new ApiException(HttpStatus.CONFLICT,message);}
}
