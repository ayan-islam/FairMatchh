package com.fairmatch;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"fairmatch.seed=false","fairmatch.legacy-public-applications=true","fairmatch.bootstrap.demo-enabled=true","fairmatch.auth.basic-enabled=true","fairmatch.mail.dispatch=false"})
@AutoConfigureMockMvc
class WorkingFeaturesTest {
  static final String DATABASE="fairmatch_test_"+UUID.randomUUID().toString().replace("-", "");
  @DynamicPropertySource static void database(DynamicPropertyRegistry r) { r.add("spring.data.mongodb.uri", () -> "mongodb://127.0.0.1:27018/"+DATABASE+"?replicaSet=fairmatch-rs"); }
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired MongoTemplate mongo;
  Map<String,Object> job() { return new HashMap<>(Map.of("title","Quality Assistant","department","Quality","location","Dhaka","workplace","On-site","salary","BDT 25,000 monthly","description","Inspect garment quality and maintain clear inspection records.","requirements",List.of("Quality inspection experience"),"status","Active","closes",LocalDate.now().plusDays(30).toString(),"noFeeConfirmed",true)); }
  Map<String,Object> application() { var r=new HashMap<String,Object>(); r.put("name","Test Candidate");r.put("contact","candidate@example.com");r.put("role","Quality Assistant");r.put("experience","I inspected garments and maintained the daily defect tracker.");r.put("education","Diploma");r.put("skills",List.of("Quality inspection"));r.put("example","I found a recurring stitching defect and coordinated a correction with production.");r.put("availability","30 days");r.put("location","Dhaka");r.put("consent",true);r.put("evidenceConfirmed",true);r.put("finalConsent",true);return r; }
  String publish(Map<String,Object> request) throws Exception { var body=mvc.perform(post("/api/employer/jobs").with(httpBasic("recruiter","LocalTestEmployer!2026")).contentType("application/json").content(json.writeValueAsString(request))).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();return json.readTree(body).get("id").asText(); }

  @Test void publishingRequiresAuthenticationAndRejectsUnsafeOrIncompleteJobs() throws Exception {
    mvc.perform(post("/api/employer/jobs").contentType("application/json").content(json.writeValueAsString(job()))).andExpect(status().isUnauthorized());
    for (String field:List.of("noFeeConfirmed","closes","requirements","title","department")) {
      var r=job(); r.put(field,switch(field){case "noFeeConfirmed"->false;case "closes"->"2020-01-01";case "requirements"->List.of("Male applicants only");default->"";});
      mvc.perform(post("/api/employer/jobs").with(httpBasic("recruiter","LocalTestEmployer!2026")).contentType("application/json").content(json.writeValueAsString(r))).andExpect(status().isBadRequest());
    }
    var r=job();r.put("status","Draft");var id=publish(r);
    mvc.perform(get("/api/public/jobs/"+id)).andExpect(status().isNotFound());
    mvc.perform(post("/api/public/jobs/"+id+"/applications").contentType("application/json").content(json.writeValueAsString(application()))).andExpect(status().isNotFound());
  }
  @Test void publishApplyAndBlindReviewPersistTogetherAndRejectDuplicate() throws Exception {
    var id=publish(job()); assertThat(id).startsWith("REF-");
    mvc.perform(get("/api/public/jobs/"+id)).andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Quality Assistant")).andExpect(jsonPath("$.department").value("Quality"));
    var receipt=mvc.perform(post("/api/public/jobs/"+id+"/applications").contentType("application/json").content(json.writeValueAsString(application()))).andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("Submitted")).andReturn().getResponse().getContentAsString();
    var applicationId=json.readTree(receipt).get("id").asText();
    var response=mvc.perform(get("/api/employer/applications").with(httpBasic("recruiter","LocalTestEmployer!2026"))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    assertThat(response).contains(applicationId,"Quality inspection").doesNotContain("Test Candidate","candidate@example.com","\"name\"","\"normalizedContact\"");
    mvc.perform(get("/api/employer/applications")).andExpect(status().isUnauthorized());
    var duplicate=application();duplicate.put("contact"," CANDIDATE@example.com ");
    mvc.perform(post("/api/public/jobs/"+id+"/applications").contentType("application/json").content(json.writeValueAsString(duplicate))).andExpect(status().isConflict());
    mvc.perform(get("/api/public/jobs/"+id)).andExpect(jsonPath("$.applications").value(1));
    assertThat(mongo.count(Query.query(Criteria.where("jobId").is(id)),"applications")).isEqualTo(1);
    assertThat(mongo.count(Query.query(Criteria.where("reference").is(applicationId)),"audit_events")).isEqualTo(1);
    var update=job();update.put("title","Updated Quality Assistant");
    mvc.perform(put("/api/employer/jobs/"+id).with(httpBasic("recruiter","LocalTestEmployer!2026")).contentType("application/json").content(json.writeValueAsString(update))).andExpect(status().isOk()).andExpect(jsonPath("$.applications").value(1));
  }
  @Test void submissionRequiresConsentAndARealOpenJob() throws Exception {
    var id=publish(job());
    for(String field:List.of("consent","evidenceConfirmed","finalConsent","contact","experience","example")) {
      var r=application();r.put(field,field.equals("consent")||field.equals("evidenceConfirmed")||field.equals("finalConsent")?false:"");
      mvc.perform(post("/api/public/jobs/"+id+"/applications").contentType("application/json").content(json.writeValueAsString(r))).andExpect(status().isBadRequest());
    }
    mvc.perform(post("/api/public/jobs/not-a-job/applications").contentType("application/json").content(json.writeValueAsString(application()))).andExpect(status().isNotFound());
    mongo.updateFirst(Query.query(Criteria.where("_id").is(id)),new Update().set("closes",LocalDate.of(2020,1,1)),"jobs");
    mvc.perform(post("/api/public/jobs/"+id+"/applications").contentType("application/json").content(json.writeValueAsString(application()))).andExpect(status().isConflict());
    assertThat(mongo.count(Query.query(Criteria.where("jobId").is(id)),"applications")).isZero();
  }
  @Test void hiringStageAndReasonSurviveReadBackWithAuditAndStaleProtection() throws Exception {
    var jobId=publish(job());
    var receipt=mvc.perform(post("/api/public/jobs/"+jobId+"/applications").contentType("application/json").content(json.writeValueAsString(application()))).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    var id=json.readTree(receipt).get("id").asText();
    var payload=Map.of("stage","Shortlisted","expectedStage","New","reason","Relevant inspection evidence matches the role.");
    mvc.perform(patch("/api/employer/applications/"+id+"/stage").with(httpBasic("recruiter","LocalTestEmployer!2026")).contentType("application/json").content(json.writeValueAsString(payload))).andExpect(status().isOk()).andExpect(jsonPath("$.stage").value("Shortlisted")).andExpect(jsonPath("$.stageReason").value(payload.get("reason"))).andExpect(jsonPath("$.name").doesNotExist()).andExpect(jsonPath("$.normalizedContact").doesNotExist());
    var stored=mongo.getCollection("applications").find(new org.bson.Document("_id",id)).first();
    assertThat(stored.getString("stage")).isEqualTo("Shortlisted");
    assertThat(stored.getString("stageReason")).isEqualTo(payload.get("reason"));
    assertThat(stored.get("stageChangedAt")).isNotNull();
    var refreshed=json.readTree(mvc.perform(get("/api/employer/applications").with(httpBasic("recruiter","LocalTestEmployer!2026"))).andReturn().getResponse().getContentAsString());
    assertThat(refreshed.findValuesAsText("stageReason")).contains(payload.get("reason"));
    mvc.perform(patch("/api/employer/applications/"+id+"/stage").with(httpBasic("recruiter","LocalTestEmployer!2026")).contentType("application/json").content(json.writeValueAsString(payload))).andExpect(status().isConflict());
    var audit=mongo.getCollection("audit_events").find(new org.bson.Document("reference",id).append("action","APPLICATION_STAGE_CHANGED")).first();
    assertThat(audit.getString("actor")).isEqualTo("recruiter");
    assertThat(audit.getString("detail")).contains("New -> Shortlisted",payload.get("reason"));
    assertThat(mongo.count(Query.query(Criteria.where("reference").is(id).and("action").is("APPLICATION_STAGE_CHANGED")),"audit_events")).isEqualTo(1);
    mvc.perform(get("/api/public/jobs/"+jobId)).andExpect(jsonPath("$.applications").value(1));
  }
  @Test void hiringStageRequiresEmployerValidReasonAndOrganizationScope() throws Exception {
    var jobId=publish(job());
    var receipt=mvc.perform(post("/api/public/jobs/"+jobId+"/applications").contentType("application/json").content(json.writeValueAsString(application()))).andReturn().getResponse().getContentAsString();
    var id=json.readTree(receipt).get("id").asText();
    var payload=new HashMap<>(Map.of("stage","Hired","expectedStage","New","reason","The submitted evidence supports this decision."));
    mvc.perform(patch("/api/employer/applications/"+id+"/stage").contentType("application/json").content(json.writeValueAsString(payload))).andExpect(status().isUnauthorized());
    for(String field:List.of("stage","expectedStage","reason")) {
      var invalid=new HashMap<>(payload);invalid.put(field,field.equals("reason")?"                 ":"Unknown");
      mvc.perform(patch("/api/employer/applications/"+id+"/stage").with(httpBasic("recruiter","LocalTestEmployer!2026")).contentType("application/json").content(json.writeValueAsString(invalid))).andExpect(status().isBadRequest());
    }
    mvc.perform(patch("/api/employer/applications/unknown/stage").with(httpBasic("recruiter","LocalTestEmployer!2026")).contentType("application/json").content(json.writeValueAsString(payload))).andExpect(status().isNotFound());
    mongo.updateFirst(Query.query(Criteria.where("_id").is(id)),new Update().set("organizationId","another-employer"),"applications");
    mvc.perform(patch("/api/employer/applications/"+id+"/stage").with(httpBasic("recruiter","LocalTestEmployer!2026")).contentType("application/json").content(json.writeValueAsString(payload))).andExpect(status().isNotFound());
    assertThat(mongo.getCollection("applications").find(new org.bson.Document("_id",id)).first().getString("stage")).isEqualTo("New");
  }
  @Test void databaseUniqueIndexPreventsDuplicateContacts() {
    var indexes=mongo.getCollection("applications").listIndexes().into(new ArrayList<>());
    assertThat(indexes).anySatisfy(index->{ assertThat(index.getString("name")).isEqualTo("one_contact_per_job");assertThat(index.getBoolean("unique")).isTrue(); });
  }
  @Test void modulesHaveNoCyclesOrIllegalDependencies() { org.springframework.modulith.core.ApplicationModules.of(FairMatchApplication.class).verify(); }
}
