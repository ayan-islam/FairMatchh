package com.fairmatch.application;

import com.fairmatch.audit.AuditService;
import com.fairmatch.common.ApiException;
import com.fairmatch.job.JobService;
import com.fairmatch.platform.PlatformService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.*;
import java.time.Instant;
import java.util.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/** Deterministic comparison of human ratings; never writes a hiring stage or inferred qualification. */
@RestController
@RequestMapping("/api/employer/jobs/{jobId}/ranking")
class RankingController {
    private final MongoTemplate mongo; private final PlatformService platform; private final JobService jobs;
    private final AuditService audit; private final ObjectMapper json;
    RankingController(MongoTemplate mongo,PlatformService platform,JobService jobs,AuditService audit,ObjectMapper json) {
        this.mongo=mongo;this.platform=platform;this.jobs=jobs;this.audit=audit;this.json=json;
    }
    static final Set<String> STAGES=Set.of("New","Shortlisted","Interview","Offer","Hired","Not selected","Withdrawn");
    record Criterion(@Min(0) int index,@Min(1) @Max(100) int weight,
        @NotNull @Size(min=5,max=5) List<@NotBlank @Size(min=10,max=500) String> anchors,
        boolean essential,@NotNull @Size(max=500) String essentialReason) {}
    record RubricInput(@NotBlank String snapshot,@Min(0) long expectedVersion,
        @NotEmpty @Size(max=30) List<@NotNull @Valid Criterion> criteria,@NotBlank @Size(min=20,max=1500) String reason,@AssertTrue boolean confirmed) {}
    @Document("ranking_rubrics") record Rubric(@Id String id,String organizationId,String snapshot,List<String> requirements,List<Criterion> criteria,long version,String reason,String actor,Instant at) {}
    @Document("ranking_rubric_history") record RubricHistory(@Id String id,Rubric rubric) {}
    record Item(@Min(0) int index,@Min(0) @Max(4) Integer rating,
        @NotNull @Pattern(regexp="experience|education|skills|example|none|reply:[a-f0-9-]+") String source,
        @NotNull @Size(max=1000) String quote,@NotNull @Size(max=1500) String reason) {}
    record ReviewInput(@NotBlank String snapshot,@Min(0) long expectedVersion,
        @NotEmpty @Size(max=30) List<@NotNull @Valid Item> items,@AssertTrue boolean confirmed) {}
    record Source(String field,String text) {}
    @Document("ranking_reviews") record Review(@Id String id,String organizationId,String jobId,String applicationId,String stage,String snapshot,
        long rubricVersion,List<Item> items,Integer scoreUnits,int assessed,long version,String actor,Instant at) {}
    @Document("ranking_review_history") record ReviewHistory(@Id String id,Review review) {}
    record ReviewReport(String applicationId,String stage,String snapshot,Rubric rubric,List<Source> sources,Review latestReview,boolean current,long version,List<Review> history) {}
    record Row(String applicationId,String stage,Integer rank,Double score,int assessed,int total,String status,List<String> essentialGaps,Review review) {}
    record Board(String jobId,String jobTitle,String stage,String snapshot,List<String> requirements,Rubric rubric,boolean rubricCurrent,List<Row> ranked,List<Row> pending,List<Rubric> rubricHistory) {}
    private String digest(Object value) {
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(value)));}
        catch(Exception e){throw new IllegalStateException("Cannot identify ranking revision",e);}
    }
    private com.fairmatch.job.JobView job(String org,String id) {
        return jobs.employerJobs(org).stream().filter(j->j.id().equals(id)).findFirst().orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Job not found."));
    }
    private String jobSnapshot(com.fairmatch.job.JobView j){return digest(List.of(j.id(),j.title(),j.department(),j.description(),j.requirements()));}
    private ApplicationDocument application(String org,String jobId,String id) {
        var a=mongo.findOne(Query.query(Criteria.where("_id").is(id).and("organizationId").is(org).and("jobId").is(jobId)),ApplicationDocument.class);
        if(a==null)throw new ApiException(HttpStatus.NOT_FOUND,"Application not found.");return a;
    }
    private List<Source> sources(ApplicationDocument a){
        var sources=new ArrayList<>(List.of(new Source("experience",a.experience()),new Source("education",a.education()),new Source("skills",String.join(", ",a.skills())),new Source("example",a.example())));
        mongo.find(Query.query(Criteria.where("applicationId").is(a.id()).and("organizationId").is(a.organizationId()).and("sender").is("Candidate")).with(Sort.by(Sort.Direction.DESC,"at","_id")).limit(20),ApplicationService.ConversationMessage.class)
            .forEach(m->sources.add(new Source("reply:"+m.id(),m.message())));
        return sources;
    }
    private String reviewSnapshot(ApplicationDocument a,Rubric rubric){return digest(Arrays.asList(a.id(),a.stage(),a.stageChangedAt(),rubric.version(),rubric.snapshot(),rubric.criteria(),sources(a)));}
    private void lockJob(String org,String id) {
        if(mongo.updateFirst(Query.query(Criteria.where("_id").is(id).and("organizationId").is(org)),new Update().inc("rankingFence",1),"jobs").getMatchedCount()!=1)throw new ApiException(HttpStatus.NOT_FOUND,"Job not found.");
    }
    private Rubric currentRubric(String org,String id) {
        var j=job(org,id);var r=mongo.findById(id,Rubric.class);
        if(r==null||!r.organizationId().equals(org)||!r.snapshot().equals(jobSnapshot(j)))conflict("Configure the rubric for the current job requirements first.");return r;
    }
    @org.springframework.context.event.EventListener
    public void criteriaChanged(JobService.CriteriaChanged event) {
        var previous=mongo.findById(event.jobId(),Rubric.class);
        if(previous==null)return;
        var invalid=new Rubric(previous.id(),previous.organizationId(),"invalidated-"+UUID.randomUUID(),previous.requirements(),previous.criteria(),previous.version()+1,"Job criteria changed; rubric and scores require reassessment.","system",Instant.now());
        mongo.save(invalid);mongo.insert(new RubricHistory(UUID.randomUUID().toString(),invalid));
        audit.record(event.organizationId(),"RANKING_INVALIDATED",event.jobId(),invalid.reason(),"system");
    }
    @GetMapping @Transactional(readOnly=true)
    Board board(@PathVariable String jobId,@RequestParam(defaultValue="New") String stage,Principal p) {
        if(!STAGES.contains(stage))bad("Choose one hiring stage.");
        var org=platform.organizationId(p.getName());var j=job(org,jobId);var snapshot=jobSnapshot(j);var rubric=mongo.findById(jobId,Rubric.class);
        boolean current=rubric!=null&&rubric.organizationId().equals(org)&&rubric.snapshot().equals(snapshot);
        var all=mongo.find(Query.query(Criteria.where("organizationId").is(org).and("jobId").is(jobId).and("stage").is(stage)),ApplicationDocument.class);
        var ranked=new ArrayList<Row>();var pending=new ArrayList<Row>();
        for(var a:all) {
            var r=mongo.findById(a.id()+":"+stage,Review.class);
            boolean valid=current&&r!=null&&r.snapshot().equals(reviewSnapshot(a,rubric));
            String status=!current?"Rubric needs setup":r==null?"Not assessed":!valid?"Reassessment required":r.scoreUnits()==null?"Assessment incomplete":"Complete";
            if(Set.of("Withdrawn","Not selected").contains(stage))status="Outside active ranking";
            var gaps=new ArrayList<String>();
            if(valid)for(var c:rubric.criteria()) {var i=r.items().stream().filter(x->x.index()==c.index()).findFirst().orElseThrow();if(c.essential()&&(i.rating()==null||i.rating()<3))gaps.add(rubric.requirements().get(c.index()));}
            var row=new Row(a.id(),stage,null,valid&&r.scoreUnits()!=null?r.scoreUnits()/4.0:null,valid?r.assessed():0,j.requirements().size(),status,gaps,valid?r:null);
            if(status.equals("Complete"))ranked.add(row);else pending.add(row);
        }
        ranked.sort(Comparator.comparing(Row::score).reversed().thenComparing(Row::applicationId));
        int rank=0;Double previous=null;
        for(int n=0;n<ranked.size();n++){var r=ranked.get(n);if(!Objects.equals(previous,r.score()))rank=n+1;previous=r.score();ranked.set(n,new Row(r.applicationId(),stage,rank,r.score(),r.assessed(),r.total(),r.status(),r.essentialGaps(),r.review()));}
        pending.sort(Comparator.comparing(Row::applicationId));
        var history=mongo.find(Query.query(Criteria.where("rubric.id").is(jobId).and("rubric.organizationId").is(org)).with(Sort.by(Sort.Direction.DESC,"rubric.version")),RubricHistory.class).stream().map(RubricHistory::rubric).toList();
        return new Board(jobId,j.title(),stage,snapshot,j.requirements(),rubric,current,ranked,pending,history);
    }
    @PutMapping("/rubric") @Transactional
    Rubric saveRubric(@PathVariable String jobId,@Valid @RequestBody RubricInput input,Principal p) {
        var org=platform.organizationId(p.getName());lockJob(org,jobId);var j=job(org,jobId);var previous=mongo.findById(jobId,Rubric.class);
        long version=previous==null?0:previous.version();
        if(version!=input.expectedVersion()||!jobSnapshot(j).equals(input.snapshot()))conflict("The job or rubric changed. Reload before saving.");
        if(input.reason().trim().length()<20||input.criteria().size()!=j.requirements().size())bad("Explain the rubric and configure each requirement exactly once.");
        var seen=new HashSet<Integer>();int weight=0;
        for(var c:input.criteria()) {
            if(c.index()>=j.requirements().size()||!seen.add(c.index()))bad("Configure each requirement exactly once.");weight+=c.weight();
            if(c.anchors().stream().anyMatch(a->a.trim().length()<10)||new HashSet<>(c.anchors().stream().map(String::trim).toList()).size()!=5)bad("Provide five distinct, concrete scoring anchors for each criterion.");
            if(c.essential()&&c.essentialReason().trim().length()<20)bad("Explain why each essential requirement is necessary for this job.");
        }
        if(weight!=100)bad("Criterion weights must total exactly 100%.");
        var criteria=input.criteria().stream().sorted(Comparator.comparingInt(Criterion::index)).toList();
        var saved=new Rubric(jobId,org,input.snapshot(),j.requirements(),criteria,version+1,input.reason().trim(),p.getName(),Instant.now());
        mongo.save(saved);mongo.insert(new RubricHistory(UUID.randomUUID().toString(),saved));
        audit.record(org,"RANKING_RUBRIC_SAVED",jobId,"Rubric version "+saved.version()+". All previous scores require reassessment. "+saved.reason(),p.getName());return saved;
    }
    private ReviewReport report(String org,String jobId,String id) {
        var rubric=currentRubric(org,jobId);var a=application(org,jobId,id);var snapshot=reviewSnapshot(a,rubric);var latest=mongo.findById(id+":"+a.stage(),Review.class);
        var history=mongo.find(Query.query(Criteria.where("review.applicationId").is(id).and("review.organizationId").is(org)).with(Sort.by(Sort.Direction.DESC,"review.at")),ReviewHistory.class).stream().map(ReviewHistory::review).toList();
        return new ReviewReport(id,a.stage(),snapshot,rubric,sources(a),latest,latest!=null&&snapshot.equals(latest.snapshot()),latest==null?0:latest.version(),history);
    }
    @GetMapping("/applications/{id}") @Transactional(readOnly=true)
    ReviewReport get(@PathVariable String jobId,@PathVariable String id,Principal p){return report(platform.organizationId(p.getName()),jobId,id);}
    @PostMapping("/applications/{id}") @Transactional
    ReviewReport save(@PathVariable String jobId,@PathVariable String id,@Valid @RequestBody ReviewInput input,Principal p) {
        var org=platform.organizationId(p.getName());lockJob(org,jobId);
        if(mongo.updateFirst(Query.query(Criteria.where("_id").is(id).and("organizationId").is(org).and("jobId").is(jobId)),new Update().inc("rankingFence",1),"applications").getMatchedCount()!=1)throw new ApiException(HttpStatus.NOT_FOUND,"Application not found.");
        var current=report(org,jobId,id);
        if(!current.snapshot().equals(input.snapshot())||current.version()!=input.expectedVersion())conflict("The rubric, evidence, stage or review changed. Reload before saving.");
        if(Set.of("Withdrawn","Not selected").contains(current.stage()))bad("This application is outside active ranking.");
        if(input.items().size()!=current.rubric().criteria().size())bad("Include each criterion exactly once, using Not assessed for missing evidence.");
        var seen=new HashSet<Integer>();int units=0,assessed=0;
        for(var i:input.items()) {
            if(i.index()>=input.items().size()||!seen.add(i.index()))bad("Include each criterion exactly once.");
            if(i.rating()!=null){assessed++;if(i.reason().trim().length()<15)bad("Explain every rating in at least 15 characters.");units+=i.rating()*current.rubric().criteria().get(i.index()).weight();}
            if(i.source().equals("none")) {
                if(!i.quote().isBlank()||(i.rating()!=null&&i.rating()>0))bad("Positive ratings require an exact submitted evidence quote. Missing evidence stays Not assessed.");
            } else {
                var source=current.sources().stream().filter(s->s.field().equals(i.source())).findFirst().orElseThrow(()->new ApiException(HttpStatus.BAD_REQUEST,"Choose an available submitted evidence source."));
                if(i.quote().trim().length()<3||source.text()==null||!source.text().contains(i.quote().trim()))bad("Copy the source quote exactly from the submitted evidence.");
            }
        }
        var items=input.items().stream().sorted(Comparator.comparingInt(Item::index)).map(i->new Item(i.index(),i.rating(),i.source(),i.quote().trim(),i.reason().trim())).toList();
        var saved=new Review(id+":"+current.stage(),org,jobId,id,current.stage(),current.snapshot(),current.rubric().version(),items,assessed==items.size()?units:null,assessed,current.version()+1,p.getName(),Instant.now());
        mongo.save(saved);mongo.insert(new ReviewHistory(UUID.randomUUID().toString(),saved));
        audit.record(org,"RANKING_REVIEW_SAVED",id,"Rubric "+saved.rubricVersion()+", review "+saved.version()+", assessed "+assessed+"/"+items.size()+". Hiring stage unchanged.",p.getName());return report(org,jobId,id);
    }
    private void bad(String message){throw new ApiException(HttpStatus.BAD_REQUEST,message);}
    private void conflict(String message){throw new ApiException(HttpStatus.CONFLICT,message);}
}
