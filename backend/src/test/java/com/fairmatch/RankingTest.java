package com.fairmatch;

import com.fasterxml.jackson.databind.*;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"fairmatch.seed=false","fairmatch.bootstrap.demo-enabled=true","fairmatch.mail.dispatch=false"}) @AutoConfigureMockMvc
class RankingTest {
 static final String DATABASE="fairmatch_ranking_test_"+UUID.randomUUID().toString().replace("-","");
 @DynamicPropertySource static void database(DynamicPropertyRegistry r){r.add("spring.data.mongodb.uri",()->"mongodb://127.0.0.1:27018/"+DATABASE+"?replicaSet=fairmatch-rs");}
 @org.junit.jupiter.api.BeforeEach void resetTestRateLimits(){mongo.getCollection("security_limits").deleteMany(new Document());}
 @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired MongoTemplate mongo;
 JsonNode call(MockHttpServletRequestBuilder method,String token,Object body,int expected)throws Exception{
  if(token!=null)method.header("Authorization","Bearer "+token);if(body!=null)method.contentType("application/json").content(json.writeValueAsString(body));
  var result=mvc.perform(method).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();return result.isBlank()?json.nullNode():json.readTree(result);
 }
 String employer()throws Exception{return call(post("/api/public/auth/login"),null,Map.of("username","recruiter","password","LocalTestEmployer!2026"),200).get("token").asText();}
 String register(String role)throws Exception{var id="rank_"+UUID.randomUUID().toString().replace("-","");return call(post("/api/public/auth/register"),null,Map.of("username",id,"password","TestPassword!123","contact",id+"@example.test","name","Private rank applicant","role",role,"organizationName","Separate employer"),200).get("token").asText();}
 List<String> requirements(){return List.of("Java backend development","Relevant software project contribution","Problem solving","Explain technical decisions");}
 Map<String,Object> job(List<String> req){return Map.of("title","Software Engineer","department","CSE","location","Dhaka","workplace","On-site","salary","BDT 40000","description","Build and test Java backend services for real users.","requirements",req,"status","Active","closes",LocalDate.now().plusDays(20).toString(),"noFeeConfirmed",true);}
 String create(String token)throws Exception{return call(post("/api/employer/jobs"),token,job(requirements()),201).get("id").asText();}
 String apply(String job,String token)throws Exception{
  var data=new HashMap<String,Object>();data.put("name","ignored");data.put("contact","ignored@example.test");data.put("role","Engineer");data.put("experience","Built Java APIs and tested a software project with clear technical explanations.");data.put("education","BSc in CSE");data.put("skills",List.of("Java","SQL"));data.put("example","Implemented reliable APIs, tested database updates and explained the tradeoffs in a project review.");data.put("availability","30 days");data.put("location","Dhaka");data.put("consent",true);data.put("evidenceConfirmed",true);data.put("finalConsent",true);
  return call(post("/api/candidate/jobs/"+job+"/applications"),token,data,201).get("id").asText();
 }
 String base(String job){return "/api/employer/jobs/"+job+"/ranking";}
 List<Map<String,Object>> criteria(){var result=new ArrayList<Map<String,Object>>();int[] weights={40,30,20,10};for(int n=0;n<4;n++)result.add(new HashMap<>(Map.of("index",n,"weight",weights[n],"anchors",List.of("Does not demonstrate the competency after assessment.","Shows only a basic understanding of the competency.","Shows some relevant work but the contribution is unclear.","Explains a relevant contribution and how it was tested.","Explains the contribution, tests and measurable improvements."),"essential",n==0,"essentialReason",n==0?"Java development is necessary for maintaining this backend.":"")));return result;}
 Map<String,Object> rubricInput(JsonNode board){return new HashMap<>(Map.of("snapshot",board.get("snapshot").asText(),"expectedVersion",board.path("rubric").path("version").asLong(),"criteria",criteria(),"reason","Weights reflect the daily work of this software engineering position.","confirmed",true));}
 void rubric(String token,String job)throws Exception{var b=call(get(base(job)),token,null,200);call(put(base(job)+"/rubric"),token,rubricInput(b),200);}
 Map<String,Object> input(JsonNode report,Integer...ratings){var items=new ArrayList<Map<String,Object>>();for(int n=0;n<ratings.length;n++){var i=new HashMap<String,Object>();i.put("index",n);i.put("rating",ratings[n]);i.put("source",ratings[n]!=null&&ratings[n]>0?"experience":"none");i.put("quote",ratings[n]!=null&&ratings[n]>0?"Built Java APIs":"");i.put("reason",ratings[n]==null?"Clarification is still required.":"This evidence was assessed against the defined competency level.");items.add(i);}return new HashMap<>(Map.of("snapshot",report.get("snapshot").asText(),"expectedVersion",report.get("version").asLong(),"items",items,"confirmed",true));}
 JsonNode assess(String token,String job,String app,Integer...ratings)throws Exception{var path=base(job)+"/applications/"+app;var r=call(get(path),token,null,200);return call(post(path),token,input(r,ratings),200);}
 @Test void weightedScoresTiesUnknownZeroAndEssentialGapsAreExplainedWithoutStageChanges()throws Exception{
  var t=employer();var j=create(t);rubric(t,j);
  var a=apply(j,register("CANDIDATE"));var b=apply(j,register("CANDIDATE"));var c=apply(j,register("CANDIDATE"));var d=apply(j,register("CANDIDATE"));var e=apply(j,register("CANDIDATE"));
  assess(t,j,a,4,3,3,2);assess(t,j,b,3,4,2,3);assess(t,j,c,4,3,3,2);assess(t,j,d,4,null,3,2);assess(t,j,e,0,3,3,2);
  var board=call(get(base(j)),t,null,200);assertThat(board.get("ranked").size()).isEqualTo(4);assertThat(board.get("pending").size()).isEqualTo(1);
  assertThat(board.at("/ranked/0/rank").asInt()).isEqualTo(1);assertThat(board.at("/ranked/1/rank").asInt()).isEqualTo(1);assertThat(board.at("/ranked/2/rank").asInt()).isEqualTo(3);
  assertThat(board.at("/ranked/0/score").asDouble()).isEqualTo(82.5);assertThat(board.at("/ranked/2/score").asDouble()).isEqualTo(77.5);
  assertThat(board.at("/pending/0/score").isNull()).isTrue();assertThat(board.at("/pending/0/rank").isNull()).isTrue();assertThat(board.at("/pending/0/assessed").asInt()).isEqualTo(3);
  assertThat(board.at("/ranked/3/essentialGaps/0").asText()).isEqualTo(requirements().get(0));
  assertThat(mongo.getCollection("applications").countDocuments(new Document("jobId",j).append("stage","New"))).isEqualTo(5);
  assertThat(mongo.getCollection("ranking_review_history").countDocuments(new Document("review.jobId",j))).isEqualTo(5);
  assertThat(board.toString()).doesNotContain("Private rank applicant","@example.test","normalizedContact");
 }
 @Test void serverRejectsInvalidWeightsDuplicateCriteriaInventedQuotesAndUnconfirmedRatings()throws Exception{
  var t=employer();var j=create(t);var b=call(get(base(j)),t,null,200);var r=rubricInput(b);var cs=criteria();cs.get(0).put("weight",39);r.put("criteria",cs);call(put(base(j)+"/rubric"),t,r,400);
  r=rubricInput(b);r.put("confirmed",false);call(put(base(j)+"/rubric"),t,r,400);
  r=rubricInput(b);cs=criteria();cs.set(0,null);r.put("criteria",cs);call(put(base(j)+"/rubric"),t,r,400);rubric(t,j);
  var a=apply(j,register("CANDIDATE"));var path=base(j)+"/applications/"+a;var report=call(get(path),t,null,200);
  var value=input(report,4,3,3,2);var items=(List<Map<String,Object>>)value.get("items");items.get(0).put("quote","Invented statement");call(post(path),t,value,400);
  value=input(report,4,3,3,2);value.put("confirmed",false);call(post(path),t,value,400);
  value=input(report,4,3,3,2);items=(List<Map<String,Object>>)value.get("items");items.get(0).put("rating",3.5);call(post(path),t,value,400);
  value=input(report,4,3,3,2);items=(List<Map<String,Object>>)value.get("items");items.get(0).put("source","none");items.get(0).put("quote","");call(post(path),t,value,400);
  value=input(report,4,3,3,2);items=(List<Map<String,Object>>)value.get("items");items.get(1).put("index",0);call(post(path),t,value,400);
  value=input(report,4,3,3,2);items=(List<Map<String,Object>>)value.get("items");items.set(0,null);call(post(path),t,value,400);
  value=input(report,4,3,3,2);items=(List<Map<String,Object>>)value.get("items");items.get(0).put("source","reply:"+UUID.randomUUID());call(post(path),t,value,400);
  assertThat(call(get(path),t,null,200).get("version").asInt()).isZero();
 }
 @Test void rankingAndRubricEndpointsEnforceOrganizationAndRole()throws Exception{
  var t=employer();var j=create(t);rubric(t,j);var candidate=register("CANDIDATE");var a=apply(j,candidate);var stranger=register("EMPLOYER");var board=call(get(base(j)),t,null,200);
  call(get(base(j)),null,null,401);call(get(base(j)),candidate,null,403);call(get(base(j)),stranger,null,404);
  call(put(base(j)+"/rubric"),stranger,rubricInput(board),404);
  call(get(base(j)+"/applications/"+a),stranger,null,404);call(get(base(j)+"/applications/"+a),candidate,null,403);
  var another=create(t);rubric(t,another);call(get(base(another)+"/applications/"+a),t,null,404);
 }
 @Test void rubricAndRequirementChangesInvalidateScoresEvenWhenRequirementsAreReverted()throws Exception{
  var t=employer();var j=create(t);rubric(t,j);var a=apply(j,register("CANDIDATE"));var path=base(j)+"/applications/"+a;var old=assess(t,j,a,4,3,3,2);
  var board=call(get(base(j)),t,null,200);call(put(base(j)+"/rubric"),t,rubricInput(board),200);
  var updated=call(get(base(j)),t,null,200);assertThat(updated.get("ranked").size()).isZero();assertThat(updated.at("/pending/0/status").asText()).isEqualTo("Reassessment required");call(post(path),t,input(old,4,3,3,2),409);
  assess(t,j,a,4,3,3,2);var changed=new ArrayList<>(requirements());changed.set(0,"Python backend development");call(put("/api/employer/jobs/"+j),t,job(changed),200);call(put("/api/employer/jobs/"+j),t,job(requirements()),200);
  assertThat(call(get(base(j)),t,null,200).get("rubricCurrent").asBoolean()).isFalse();call(get(path),t,null,409);
  rubric(t,j);assertThat(call(get(base(j)),t,null,200).get("ranked").size()).isZero();assertThat(call(get(path),t,null,200).get("history").size()).isEqualTo(2);
 }
 @Test void stageChangesRemoveOldComparisonsAndStaleReviewsCannotOverwrite()throws Exception{
  var t=employer();var j=create(t);rubric(t,j);var candidate=register("CANDIDATE");var a=apply(j,candidate);var old=assess(t,j,a,4,3,3,2);var path=base(j)+"/applications/"+a;
  call(patch("/api/employer/applications/"+a+"/stage"),t,Map.of("stage","Shortlisted","expectedStage","New","reason","Recruiter chose to proceed after reviewing relevant evidence."),200);
  assertThat(call(get(base(j)),t,null,200).get("ranked").size()).isZero();assertThat(call(get(base(j)+"?stage=Shortlisted"),t,null,200).at("/pending/0/status").asText()).isEqualTo("Not assessed");call(post(path),t,input(old,4,3,3,2),409);
  var current=assess(t,j,a,4,3,3,2);call(post(path),t,input(old,4,3,3,2),409);
  var newer=assess(t,j,a,3,3,3,3);call(post(path),t,input(current,4,3,3,2),409);assertThat(newer.path("latestReview").path("scoreUnits").asInt()).isEqualTo(300);
  call(patch("/api/employer/applications/"+a+"/stage"),t,Map.of("stage","New","expectedStage","Shortlisted","reason","Additional evidence review is required for all applicants."),200);
  assertThat(call(get(base(j)),t,null,200).at("/pending/0/status").asText()).isEqualTo("Reassessment required");
 }
 @Test void clarificationInvalidatesPriorScoresAndCanSupportTheNextAssessment()throws Exception{
  var t=employer();var j=create(t);rubric(t,j);var candidate=register("CANDIDATE");var a=apply(j,candidate);var old=assess(t,j,a,4,3,3,2);var path=base(j)+"/applications/"+a;
  call(post("/api/candidate/applications/"+a+"/messages"),candidate,Map.of("message","I added integration tests to my Java API and documented the tradeoffs."),200);
  var board=call(get(base(j)),t,null,200);assertThat(board.get("ranked").size()).isZero();assertThat(board.at("/pending/0/status").asText()).isEqualTo("Reassessment required");
  call(post(path),t,input(old,4,3,3,2),409);var report=call(get(path),t,null,200);var payload=input(report,4,3,3,2);var items=(List<Map<String,Object>>)payload.get("items");
  items.get(0).put("source",report.at("/sources/4/field").asText());items.get(0).put("quote","I added integration tests to my Java API");
  call(post(path),t,payload,200);assertThat(call(get(base(j)),t,null,200).get("ranked").size()).isEqualTo(1);
  call(post("/api/candidate/applications/"+a+"/withdrawal"),candidate,Map.of(),200);
  var withdrawn=call(get(base(j)+"?stage=Withdrawn"),t,null,200);assertThat(withdrawn.get("ranked").size()).isZero();assertThat(withdrawn.at("/pending/0/status").asText()).isEqualTo("Outside active ranking");
 }
 @Test void simultaneousReviewSavesCommitOnceAndReturnARecoverableConflict()throws Exception{
  var t=employer();var j=create(t);rubric(t,j);var a=apply(j,register("CANDIDATE"));var path=base(j)+"/applications/"+a;var report=call(get(path),t,null,200);var payload=json.writeValueAsString(input(report,4,3,3,2));
  var ready=new CountDownLatch(2);var start=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
  try {
   Callable<Integer> action=()->{ready.countDown();start.await(10,TimeUnit.SECONDS);return mvc.perform(post(path).header("Authorization","Bearer "+t).contentType("application/json").content(payload)).andReturn().getResponse().getStatus();};
   var first=pool.submit(action);var second=pool.submit(action);assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();start.countDown();
   assertThat(List.of(first.get(20,TimeUnit.SECONDS),second.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
   assertThat(call(get(path),t,null,200).get("version").asInt()).isEqualTo(1);
   assertThat(mongo.getCollection("ranking_review_history").countDocuments(new Document("review.applicationId",a))).isEqualTo(1);
  } finally {pool.shutdownNow();}
 }

}
