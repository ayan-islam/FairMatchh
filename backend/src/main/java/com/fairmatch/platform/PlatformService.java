package com.fairmatch.platform;

import com.fairmatch.audit.AuditService;
import com.fairmatch.common.ApiException;
import jakarta.annotation.PostConstruct;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Shared identity, organization, inbox and support foundation. No hiring decisions live here. */
@Service
public class PlatformService implements UserDetailsService {
    private final MongoTemplate mongo;
    private final PasswordEncoder passwords;
    private final AuditService audit;
    private final OrganizationEvidenceService evidence;
    private final String employerUsername, employerPassword, adminPassword;
    public PlatformService(MongoTemplate mongo, PasswordEncoder passwords, AuditService audit,OrganizationEvidenceService evidence,
        @Value("${fairmatch.demo.username}") String username,@Value("${fairmatch.demo.password}") String password,
        @Value("${fairmatch.admin.password:LocalTestAdmin!2026}") String adminPassword) {
        this.mongo=mongo;this.passwords=passwords;this.audit=audit;
        this.evidence=evidence;
        this.employerUsername=username;this.employerPassword=password;this.adminPassword=adminPassword;
    }
    @Value("${fairmatch.bootstrap.demo-enabled:false}") private boolean demoEnabled;
    @PostConstruct void seedAccounts() {
        if (!demoEnabled) return;
        seed(employerUsername,"recruiter@fairmatch.local","Rafiq Karim","EMPLOYER","apex-textiles",employerPassword);
        seed("admin","admin@fairmatch.local","Platform Administrator","ADMIN",null,adminPassword);
        if (!mongo.exists(Query.query(Criteria.where("_id").is("apex-textiles")),Organization.class))
            mongo.insert(new Organization("apex-textiles","Apex Textiles Ltd.","Apparel & Textiles","Dhaka, Bangladesh","",
                "recruiter@fairmatch.local","Verified","Classroom seed organization; not an external business verification.",Instant.now(),0));
    }
    private void seed(String username,String contact,String name,String role,String organization,String password) {
        if (!mongo.exists(Query.query(Criteria.where("username").is(username)),Account.class))
            mongo.insert(new Account(UUID.randomUUID().toString(),username,contact,name,role,organization,passwords.encode(password),Instant.now()));
    }
    @Override public UserDetails loadUserByUsername(String username) {
        var account=mongo.findOne(Query.query(Criteria.where("username").is(username.toLowerCase(Locale.ROOT))),Account.class);
        if(account==null)throw new UsernameNotFoundException("Invalid credentials.");
        return User.withUsername(account.username()).password(account.passwordHash()).roles(account.role()).build();
    }
    public Account account(String username) {
        var result=mongo.findOne(Query.query(Criteria.where("username").is(username)),Account.class);
        if(result==null)throw new ApiException(HttpStatus.UNAUTHORIZED,"Sign in again.");return result;
    }
    public String organizationId(String username) {
        var a=account(username);
        if(!a.role().equals("EMPLOYER")||a.organizationId()==null)throw new ApiException(HttpStatus.FORBIDDEN,"Employer membership required.");
        return a.organizationId();
    }
    public Account login(String username,String password) {
        var a=mongo.findOne(Query.query(Criteria.where("username").is(username.trim().toLowerCase(Locale.ROOT))),Account.class);
        if(a==null || !passwords.matches(password,a.passwordHash()))throw new ApiException(HttpStatus.UNAUTHORIZED,"Incorrect username or password.");
        return a;
    }
    @Transactional public Account register(Registration r) {
        if(r.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length>72)bad("Password must be at most 72 UTF-8 bytes.");
        var username=r.username().trim().toLowerCase(Locale.ROOT);var contact=r.contact().trim().toLowerCase(Locale.ROOT);
        if(mongo.exists(Query.query(new Criteria().orOperator(Criteria.where("username").is(username),Criteria.where("contact").is(contact))),Account.class))
            throw new ApiException(HttpStatus.CONFLICT,"This username or email already has an account.");
        if(r.name().isBlank())bad("Enter your name.");
        String org=null;
        if(r.role().equals("EMPLOYER")) {
            if(r.organizationName()==null||r.organizationName().trim().length()<2)bad("Enter your organization name.");
            org="ORG-"+UUID.randomUUID();
            mongo.insert(new Organization(org,r.organizationName().trim(),"","","",contact,"Pending","",Instant.now(),0));
        }
        var account=mongo.insert(new Account(UUID.randomUUID().toString(),username,contact,r.name().trim(),r.role(),org,passwords.encode(r.password()),Instant.now()));
        audit.record(org==null?"platform":org,"ACCOUNT_CREATED",account.id(),r.role(),username);
        return account;
    }
    public Organization organization(String id) {
        var org=mongo.findById(id,Organization.class);if(org==null)throw new ApiException(HttpStatus.NOT_FOUND,"Organization not found.");return org;
    }
    public void requireVerified(String id) {
        if(!organization(id).status().equals("Verified"))throw new ApiException(HttpStatus.CONFLICT,"Your organization must be verified by an administrator before publishing jobs.");
    }
    @Transactional public Organization saveOrganization(String id,OrganizationInput r,String actor) {
        var old=organization(id);
        if(r.name().trim().length()<2)bad("Enter an organization name.");
        var saved=new Organization(id,r.name().trim(),r.industry().trim(),r.location().trim(),r.website().trim(),old.contact(),
            old.name().equals(r.name().trim())?old.status():"Pending",old.reviewReason(),old.submittedAt(),old.version()+1);
        var changed=mongo.updateFirst(Query.query(Criteria.where("_id").is(id).and("version").is(r.expectedVersion())),
            new Update().set("name",saved.name()).set("industry",saved.industry()).set("location",saved.location()).set("website",saved.website()).set("status",saved.status()).inc("version",1),Organization.class);
        if(changed.getModifiedCount()!=1)conflict();
        audit.record(id,"ORGANIZATION_UPDATED",id,null,actor);return saved;
    }
    public List<Organization> organizations() { return mongo.find(new Query().with(Sort.by(Sort.Direction.DESC,"submittedAt")),Organization.class); }
    @Transactional public Organization verify(String id,OrganizationDecision r,String actor) {
        if(!Set.of("Verified","Changes requested").contains(r.status()))bad("Choose a verification decision.");
        if(!r.reviewed()||r.reason().trim().length()<20)bad("Review the organization and record at least 20 characters of reasoning.");
        var old=organization(id);
        var changed=mongo.updateFirst(Query.query(Criteria.where("_id").is(id).and("version").is(r.expectedVersion())),
            new Update().set("status",r.status()).set("reviewReason",r.reason().trim()).inc("version",1),Organization.class);
        if(changed.getModifiedCount()!=1)conflict();
        evidence.recordReview(id,old.version()+1,r.status(),r.reason().trim(),r.reviewedDocumentIds(),actor);
        audit.record(id,"ORGANIZATION_"+r.status().toUpperCase(Locale.ROOT).replace(' ','_'),id,r.reason().trim(),actor);
        mongo.find(Query.query(Criteria.where("organizationId").is(id)),Account.class).forEach(a->notify(a.id(),"Organization review",r.status()+": "+r.reason().trim(),id));
        return organization(old.id());
    }
    public List<Member> members(String id) {
        return mongo.find(Query.query(Criteria.where("organizationId").is(id)),Account.class).stream()
            .map(a->new Member(a.name(),a.contact(),a.role(),"Active")).toList();
    }
    public void notify(String ownerId,String title,String message,String reference) {
        if(ownerId!=null)mongo.insert(new Notification(UUID.randomUUID().toString(),ownerId,title,message,reference,Instant.now(),false));
    }
    public void notifyOrganization(String org,String title,String message,String reference) {
        mongo.find(Query.query(Criteria.where("organizationId").is(org)),Account.class).forEach(a->notify(a.id(),title,message,reference));
    }
    public List<Notification> notifications(String ownerId) {
        return mongo.find(Query.query(Criteria.where("ownerId").is(ownerId)).with(Sort.by(Sort.Direction.DESC,"createdAt")).limit(200),Notification.class);
    }
    public void markRead(String ownerId,String id) {
        if(mongo.updateFirst(Query.query(Criteria.where("_id").is(id).and("ownerId").is(ownerId)),new Update().set("read",true),Notification.class).getMatchedCount()!=1)
            throw new ApiException(HttpStatus.NOT_FOUND,"Notification not found.");
    }
    public Profile profile(String ownerId) {
        var p=mongo.findById(ownerId,Profile.class);return p==null?new Profile(ownerId,"","","",List.of(),null):p;
    }
    public Profile saveProfile(String ownerId,ProfileInput r) {
        return mongo.save(new Profile(ownerId,r.role().trim(),r.experience().trim(),r.education().trim(),r.skills().stream().map(String::trim).filter(s->!s.isEmpty()).distinct().toList(),Instant.now()));
    }
    public Draft draft(String ownerId,String jobId) {
        var d=mongo.findById(ownerId+":"+jobId,Draft.class);return d==null?new Draft(ownerId+":"+jobId,ownerId,jobId,Map.of(),null):d;
    }
    public Draft saveDraft(String ownerId,String jobId,Map<String,Object> values) {
        if(values.size()>20 || values.toString().length()>25000)bad("Draft is too large.");
        var allowed=Set.of("role","experience","education","skills","example","availability","location");
        if(!allowed.containsAll(values.keySet()))bad("Unsupported draft fields.");
        values.forEach((key,value)->{
            if(key.equals("skills")) {
                if(!(value instanceof List<?> list)||list.size()>30||list.stream().anyMatch(v->!(v instanceof String text)||text.length()>100))bad("Draft skills must be a list of up to 30 short text values.");
            } else if(!(value instanceof String text)||text.length()>6000)bad("Draft fields must contain text of at most 6000 characters.");
        });
        return mongo.save(new Draft(ownerId+":"+jobId,ownerId,jobId,values,Instant.now()));
    }
    @Transactional public SupportCase createCase(Account owner,CaseInput r) {
        if(r.detail().trim().length()<20)bad("Describe your request in at least 20 characters.");
        var saved=mongo.insert(new SupportCase("CASE-"+UUID.randomUUID(),owner.id(),r.subject().trim(),r.category(),r.reference(),"Normal","Open",r.detail().trim(),"",Instant.now(),0));
        audit.record("platform","SUPPORT_CASE_OPENED",saved.id(),r.category(),owner.username());return saved;
    }
    public List<SupportCase> cases(String ownerId) {
        var query=ownerId==null?new Query():Query.query(Criteria.where("ownerId").is(ownerId));
        return mongo.find(query.with(Sort.by(Sort.Direction.DESC,"createdAt")),SupportCase.class);
    }
    @Transactional public SupportCase resolveCase(String id,Decision r,String actor) {
        if(!Set.of("In review","Resolved").contains(r.status())||r.reason().trim().length()<20)bad("Choose a status and add a useful response.");
        var old=mongo.findById(id,SupportCase.class);if(old==null)throw new ApiException(HttpStatus.NOT_FOUND,"Case not found.");
        var changed=mongo.updateFirst(Query.query(Criteria.where("_id").is(id).and("version").is(r.expectedVersion())),
            new Update().set("status",r.status()).set("response",r.reason().trim()).inc("version",1),SupportCase.class);
        if(changed.getModifiedCount()!=1)conflict();
        notify(old.ownerId(),"Support request updated",r.reason().trim(),id);
        audit.record("platform","SUPPORT_CASE_UPDATED",id,r.reason().trim(),actor);return mongo.findById(id,SupportCase.class);
    }
    public List<AuditService.Entry> allAudit() { return mongo.find(new Query().with(Sort.by(Sort.Direction.DESC,"at")).limit(300),AuditService.Entry.class); }
    private void bad(String message){throw new ApiException(HttpStatus.BAD_REQUEST,message);}
    private void conflict(){throw new ApiException(HttpStatus.CONFLICT,"This record changed. Refresh and try again.");}

    @Document("accounts") public record Account(@Id String id,@Indexed(unique=true) String username,@Indexed(unique=true) String contact,String name,String role,String organizationId,String passwordHash,Instant createdAt) {
        public UserView view(){return new UserView(id,username,contact,name,role,organizationId);}
    }
    public record UserView(String id,String username,String contact,String name,String role,String organizationId){}
    public record Registration(@NotBlank @Pattern(regexp="[a-zA-Z0-9_.-]{3,60}") String username,@NotBlank @Email @Size(max=160) String contact,@NotBlank @Size(max=160) String name,@NotBlank @Size(min=10,max=72) String password,@Pattern(regexp="CANDIDATE|EMPLOYER") @NotNull String role,@Size(max=160) String organizationName){}
    @Document("organizations") public record Organization(@Id String id,String name,String industry,String location,String website,String contact,String status,String reviewReason,Instant submittedAt,long version){}
    public record OrganizationInput(@NotBlank @Size(max=160) String name,@NotNull @Size(max=160) String industry,@NotNull @Size(max=160) String location,@NotNull @Size(max=240) String website,@Min(0) long expectedVersion){}
    public record Decision(@NotBlank String status,@NotBlank @Size(max=2000) String reason,boolean reviewed,@Min(0) long expectedVersion){}
    public record OrganizationDecision(@NotBlank String status,@NotBlank @Size(max=2000) String reason,boolean reviewed,@Min(0) long expectedVersion,@Size(max=5) List<String> reviewedDocumentIds){}
    public record Member(String name,String email,String role,String status){}
    @Document("notifications") public record Notification(@Id String id,@Indexed String ownerId,String title,String message,String reference,Instant createdAt,boolean read){}
    @Document("profiles") public record Profile(@Id String id,String role,String experience,String education,List<String> skills,Instant updatedAt){}
    public record ProfileInput(@NotNull @Size(max=160) String role,@NotNull @Size(max=6000) String experience,@NotNull @Size(max=1000) String education,@NotNull @Size(max=30) List<@NotBlank @Size(max=100) String> skills){}
    @Document("application_drafts") public record Draft(@Id String id,@Indexed String ownerId,String jobId,Map<String,Object> values,Instant updatedAt){}
    @Document("support_cases") public record SupportCase(@Id String id,@Indexed String ownerId,String subject,String category,String reference,String priority,String status,String detail,String response,Instant createdAt,long version){}
    public record CaseInput(@NotBlank @Size(max=160) String subject,@NotBlank @Pattern(regexp="Candidate appeal|Trust & safety|Privacy|Employer support") String category,@NotNull @Size(max=160) String reference,@NotBlank @Size(min=20,max=5000) String detail){}
}
