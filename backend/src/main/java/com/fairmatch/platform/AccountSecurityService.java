package com.fairmatch.platform;

import com.fairmatch.audit.AuditService;
import com.fairmatch.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;

/** Account security is independent of recruitment modules. Existing records need no destructive migration. */
@Service
public class AccountSecurityService implements OAuth2TokenValidator<Jwt> {
    private final MongoTemplate mongo;
    private final PlatformService platform;
    private final PasswordEncoder passwords;
    private final JwtEncoder encoder;
    private final AuditService audit;
    private final TransactionTemplate transaction;
    private final MailDelivery delivery;
    private final EmailQueue email;
    private final SecureRandom random=new SecureRandom();

    public AccountSecurityService(MongoTemplate mongo,PlatformService platform,PasswordEncoder passwords,JwtEncoder encoder,AuditService audit,
        PlatformTransactionManager manager,MailDelivery delivery,EmailQueue email) {
        this.mongo=mongo;this.platform=platform;this.passwords=passwords;this.encoder=encoder;this.audit=audit;
        this.transaction=new TransactionTemplate(manager);this.delivery=delivery;this.email=email;
    }
    public record Session(String token,PlatformService.UserView user,Instant expiresAt){}
    @Document("account_sessions") record SavedSession(@Id String id,@Indexed String ownerId,String username,Instant createdAt,@Indexed(expireAfter="0s") Instant expiresAt,boolean revoked){}
    @Document("security_limits") record Limit(@Id String id,int count,@Indexed(expireAfter="0s") Instant expiresAt){}
    @Document("account_challenges") record Challenge(@Id String id,String ownerId,String purpose,String hash,int attempts,boolean consumed,@Indexed(expireAfter="0s") Instant expiresAt){}
    @Document("account_verifications") record Verification(@Id String id,String contact,String deliveryMode,Instant verifiedAt){}
    public record ChallengeView(String challengeId,String message,String deliveryMode){}
    public record Status(boolean verified,String deliveryMode,Instant verifiedAt,int activeSessions,boolean emailConfigured){}

    public void rateLimit(String purpose,String key,int maximum,int seconds) {
        long window=Instant.now().getEpochSecond()/seconds;
        String id=purpose+":"+sha(key)+":"+window;
        var result=mongo.findAndModify(Query.query(Criteria.where("_id").is(id)),
            new Update().inc("count",1).setOnInsert("expiresAt",Instant.ofEpochSecond((window+1)*seconds)),
            FindAndModifyOptions.options().upsert(true).returnNew(true),Limit.class);
        if(result.count()>maximum)throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,"Too many attempts. Please wait and try again.");
    }
    public Session login(String username,String password,String address) {
        rateLimit("login-address",address,60,300);
        rateLimit("login-account",username.trim().toLowerCase(Locale.ROOT),12,300);
        return issue(platform.login(username,password));
    }
    public Session issue(PlatformService.Account account) {
        var now=Instant.now();var expires=now.plusSeconds(3600);var id=UUID.randomUUID().toString();
        mongo.insert(new SavedSession(id,account.id(),account.username(),now,expires,false));
        var claims=JwtClaimsSet.builder().issuer("fairmatch-local").subject(account.username()).id(id).issuedAt(now).expiresAt(expires).claim("roles",List.of(account.role())).build();
        String token=encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(),claims)).getTokenValue();
        return new Session(token,account.view(),expires);
    }
    @Override public OAuth2TokenValidatorResult validate(Jwt jwt) {
        boolean valid=jwt.getId()!=null&&mongo.exists(Query.query(Criteria.where("_id").is(jwt.getId()).and("username").is(jwt.getSubject()).and("revoked").is(false).and("expiresAt").gt(Instant.now())),SavedSession.class);
        if(valid) {
            var account=mongo.findOne(Query.query(Criteria.where("username").is(jwt.getSubject())),PlatformService.Account.class);
            valid=account!=null&&platform.membershipActive(account);
        }
        return valid?OAuth2TokenValidatorResult.success():OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token","Session expired or revoked",null));
    }
    public void logout(String username,String sessionId,boolean all) {
        var account=platform.account(username);var query=Query.query(Criteria.where("ownerId").is(account.id()));
        if(!all)query.addCriteria(Criteria.where("_id").is(sessionId));
        mongo.updateMulti(query,new Update().set("revoked",true),SavedSession.class);
    }
    public void changePassword(String username,String current,String next) {
        validatePassword(next);
        var account=platform.account(username);
        rateLimit("password-change",account.id(),8,300);
        if(!passwords.matches(current,account.passwordHash()))throw new ApiException(HttpStatus.BAD_REQUEST,"Current password is incorrect.");
        transaction.executeWithoutResult(status->{
            updatePassword(account,next);logout(username,null,true);
            audit.record("platform","PASSWORD_CHANGED",account.id(),"All sessions revoked",username);
        });
    }
    public ChallengeView recovery(String identity,String address) {
        delivery.requireConfigured();
        rateLimit("recovery-address",address,15,900);
        rateLimit("recovery-account",identity.trim().toLowerCase(Locale.ROOT),3,900);
        var normalized=identity.trim().toLowerCase(Locale.ROOT);
        var account=mongo.findOne(Query.query(new Criteria().orOperator(Criteria.where("username").is(normalized),Criteria.where("contact").is(normalized))),PlatformService.Account.class);
        var id=account==null?UUID.randomUUID().toString():sendChallenge(account,"RESET");
        return new ChallengeView(id,"If the account exists, a recovery email has been queued. Check your inbox for the code; it expires in 10 minutes.","SMTP");
    }
    public ChallengeView requestVerification(String username) {
        delivery.requireConfigured();
        var account=platform.account(username);rateLimit("verification",account.id(),3,900);
        return new ChallengeView(sendChallenge(account,"VERIFY"),"A verification email has been queued. Check your inbox for the code.","SMTP");
    }
    private String sendChallenge(PlatformService.Account account,String purpose) {
        String id=UUID.randomUUID().toString();String code=String.format(Locale.ROOT,"%06d",random.nextInt(1_000_000));
        transaction.executeWithoutResult(status -> {
        mongo.insert(new Challenge(id,account.id(),purpose,sha(id+":"+code),0,false,Instant.now().plusSeconds(600)));
        email.enqueue(account.contact(),purpose.equals("RESET")?"Reset your FairMatch password":"Verify your FairMatch email",
            "Your FairMatch code is: "+code+"\nIt expires in 10 minutes and can be used once.\nIf you did not request this, ignore this email.",Instant.now().plusSeconds(600));
        });
        return id;
    }
    private Challenge check(String id,String code,String purpose,String owner) {
        var criteria=Criteria.where("_id").is(id).and("purpose").is(purpose).and("consumed").is(false).and("attempts").lt(5).and("expiresAt").gt(Instant.now());
        if(owner!=null)criteria.and("ownerId").is(owner);
        // The failed-attempt counter is deliberately outside the success transaction.
        var challenge=mongo.findAndModify(Query.query(criteria),new Update().inc("attempts",1),FindAndModifyOptions.options().returnNew(true),Challenge.class);
        if(challenge==null||!MessageDigest.isEqual(challenge.hash().getBytes(StandardCharsets.US_ASCII),sha(id+":"+code).getBytes(StandardCharsets.US_ASCII)))
            throw new ApiException(HttpStatus.BAD_REQUEST,"The code is invalid, expired or exhausted. Request a new code.");
        return challenge;
    }
    private void consume(Challenge challenge) {
        var changed=mongo.updateFirst(Query.query(Criteria.where("_id").is(challenge.id()).and("consumed").is(false).and("expiresAt").gt(Instant.now())),new Update().set("consumed",true),Challenge.class);
        if(changed.getModifiedCount()!=1)throw new ApiException(HttpStatus.CONFLICT,"This code was already used. Request a new code.");
    }
    public void reset(String id,String code,String password) {
        validatePassword(password);var challenge=check(id,code,"RESET",null);
        transaction.executeWithoutResult(status->{
            consume(challenge);var account=mongo.findById(challenge.ownerId(),PlatformService.Account.class);
            if(account==null)throw new ApiException(HttpStatus.BAD_REQUEST,"Account unavailable.");
            updatePassword(account,password);logout(account.username(),null,true);
            audit.record("platform","PASSWORD_RESET",account.id(),"Email recovery completed; all sessions revoked",account.username());
        });
    }
    public void verify(String username,String id,String code) {
        var account=platform.account(username);var challenge=check(id,code,"VERIFY",account.id());
        transaction.executeWithoutResult(status->{consume(challenge);mongo.save(new Verification(account.id(),account.contact(),"SMTP",Instant.now()));audit.record("platform","EMAIL_VERIFIED",account.id(),"Email ownership confirmed with a one-use code",username);});
    }
    public Status status(String username) {
        var account=platform.account(username);var record=mongo.findById(account.id(),Verification.class);
        long active=mongo.count(Query.query(Criteria.where("ownerId").is(account.id()).and("revoked").is(false).and("expiresAt").gt(Instant.now())),SavedSession.class);
        return new Status(record!=null,record==null?"SMTP":record.deliveryMode(),record==null?null:record.verifiedAt(),(int)active,delivery.configured());
    }
    private void updatePassword(PlatformService.Account account,String password) {
        var changed=mongo.updateFirst(Query.query(Criteria.where("_id").is(account.id()).and("passwordHash").is(account.passwordHash())),new Update().set("passwordHash",passwords.encode(password)),PlatformService.Account.class);
        if(changed.getModifiedCount()!=1)throw new ApiException(HttpStatus.CONFLICT,"Credentials changed. Start again.");
    }
    private void validatePassword(String password){if(password==null||password.isBlank()||password.length()<10||password.getBytes(StandardCharsets.UTF_8).length>72)throw new ApiException(HttpStatus.BAD_REQUEST,"Use a password of at least 10 characters and at most 72 UTF-8 bytes.");}
    private String sha(String value) {try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
}
