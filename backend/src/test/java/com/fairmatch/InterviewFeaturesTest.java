package com.fairmatch;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
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
class InterviewFeaturesTest {
    static final String DATABASE="fairmatch_interview_test_"+UUID.randomUUID().toString().replace("-", "");
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) {
        r.add("spring.data.mongodb.uri",()->"mongodb://127.0.0.1:27018/"+DATABASE+"?replicaSet=fairmatch-rs");
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MongoTemplate mongo;
    String candidate() throws Exception {
        var fixture=new WorkingFeaturesTest();
        var job=json.readTree(mvc.perform(post("/api/employer/jobs").with(httpBasic("recruiter","LocalTestEmployer!2026"))
            .contentType("application/json").content(json.writeValueAsString(fixture.job()))).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        var application=fixture.application();application.put("contact",UUID.randomUUID()+"@example.com");
        return json.readTree(mvc.perform(post("/api/public/jobs/"+job.get("id").asText()+"/applications")
            .contentType("application/json").content(json.writeValueAsString(application))).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("id").asText();
    }
    Map<String,Object> schedule(String candidate) {
        return new HashMap<>(Map.of("candidateId",candidate,"date",LocalDate.now(ZoneId.of("Asia/Dhaka")).plusDays(2).toString(),
            "time","11:00","format","Video interview","location","Local test meeting instructions"));
    }
    JsonNode create(Map<String,Object> body) throws Exception {
        return json.readTree(mvc.perform(post("/api/employer/interviews").with(httpBasic("recruiter","LocalTestEmployer!2026"))
            .contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }
    @Test void scheduleRescheduleCancelPersistAndRejectStaleOrDuplicateUpdates() throws Exception {
        String candidate=candidate();var body=schedule(candidate);var saved=create(body);var id=saved.get("id").asText();
        assertThat(saved.get("version").asLong()).isZero();
        assertThat(saved.get("status").asText()).isEqualTo("Scheduled");
        assertThat(saved.has("organizationId")).isFalse();
        mvc.perform(post("/api/employer/interviews").with(httpBasic("recruiter","LocalTestEmployer!2026"))
            .contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isConflict());
        body.put("time","14:30");body.put("expectedVersion",0);
        mvc.perform(put("/api/employer/interviews/"+id).with(httpBasic("recruiter","LocalTestEmployer!2026"))
            .contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
        mvc.perform(put("/api/employer/interviews/"+id).with(httpBasic("recruiter","LocalTestEmployer!2026"))
            .contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isConflict());
        var cancellation=Map.of("reason","Candidate requested a different interview arrangement.","expectedVersion",1);
        mvc.perform(post("/api/employer/interviews/"+id+"/cancellation").with(httpBasic("recruiter","LocalTestEmployer!2026"))
            .contentType("application/json").content(json.writeValueAsString(cancellation))).andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("Cancelled")).andExpect(jsonPath("$.version").value(2));
        var stored=mongo.getCollection("interviews").find(new org.bson.Document("_id",id)).first();
        assertThat(stored.getString("cancellationReason")).isEqualTo(cancellation.get("reason"));
        assertThat(mongo.count(Query.query(Criteria.where("reference").is(id)),"audit_events")).isEqualTo(3);
        mvc.perform(get("/api/employer/interviews").with(httpBasic("recruiter","LocalTestEmployer!2026")))
            .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id == '"+id+"')].status").value("Cancelled"));
        body.put("expectedVersion",2);
        mvc.perform(put("/api/employer/interviews/"+id).with(httpBasic("recruiter","LocalTestEmployer!2026"))
            .contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isConflict());
    }
    @Test void evaluationPersistsScoresWithoutMakingHiringDecision() throws Exception {
        var candidate=candidate();var interview=create(schedule(candidate));var id=interview.get("id").asText();
        var evaluation=new HashMap<String,Object>(Map.of("scores",List.of(4,3,5,4),"notes","Candidate demonstrated clear examples of quality inspection.","expectedVersion",0));
        mvc.perform(post("/api/employer/interviews/"+id+"/evaluation").with(httpBasic("recruiter","LocalTestEmployer!2026"))
            .contentType("application/json").content(json.writeValueAsString(evaluation))).andExpect(status().isBadRequest());
        // Only this isolated test record is moved into the past to exercise completion.
        mongo.updateFirst(Query.query(Criteria.where("_id").is(id)),new Update().set("date",LocalDate.now().minusDays(1)),"interviews");
        for (Object scores:List.of(List.of(1,2,3),List.of(0,2,3,4),List.of(1,2,3,6))) {
            var invalid=new HashMap<>(evaluation);invalid.put("scores",scores);
            mvc.perform(post("/api/employer/interviews/"+id+"/evaluation").with(httpBasic("recruiter","LocalTestEmployer!2026"))
                .contentType("application/json").content(json.writeValueAsString(invalid))).andExpect(status().isBadRequest());
        }
        var invalidNotes=new HashMap<>(evaluation);invalidNotes.put("notes","                 ");
        mvc.perform(post("/api/employer/interviews/"+id+"/evaluation").with(httpBasic("recruiter","LocalTestEmployer!2026"))
            .contentType("application/json").content(json.writeValueAsString(invalidNotes))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/employer/interviews/"+id+"/evaluation").with(httpBasic("recruiter","LocalTestEmployer!2026"))
            .contentType("application/json").content(json.writeValueAsString(evaluation))).andExpect(status().isOk())
            .andExpect(jsonPath("$.scores[2]").value(5)).andExpect(jsonPath("$.completed").value(true));
        assertThat(mongo.getCollection("applications").find(new org.bson.Document("_id",candidate)).first().getString("stage")).isEqualTo("New");
        assertThat(mongo.getCollection("interviews").find(new org.bson.Document("_id",id)).first().getString("notes")).isEqualTo(evaluation.get("notes"));
        evaluation.put("expectedVersion",1);
        mvc.perform(post("/api/employer/interviews/"+id+"/evaluation").with(httpBasic("recruiter","LocalTestEmployer!2026"))
            .contentType("application/json").content(json.writeValueAsString(evaluation))).andExpect(status().isConflict());
    }
    @Test void enforceAuthenticationInputValidationAndOrganizationIsolation() throws Exception {
        var candidate=candidate();var body=schedule(candidate);
        mvc.perform(get("/api/employer/interviews")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/employer/interviews").contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isUnauthorized());
        for(String field:List.of("date","time","format","location")) {
            var invalid=new HashMap<>(body);invalid.put(field,switch(field){case "date"->"2020-01-01";case "time"->"25:00";case "format"->"Unknown";default->" ";});
            mvc.perform(post("/api/employer/interviews").with(httpBasic("recruiter","LocalTestEmployer!2026"))
                .contentType("application/json").content(json.writeValueAsString(invalid))).andExpect(status().isBadRequest());
        }
        var interview=create(body);var id=interview.get("id").asText();
        mongo.updateFirst(Query.query(Criteria.where("_id").is(id)),new Update().set("organizationId","another-employer"),"interviews");
        body.put("expectedVersion",0);
        mvc.perform(put("/api/employer/interviews/"+id).with(httpBasic("recruiter","LocalTestEmployer!2026"))
            .contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isNotFound());
        var list=mvc.perform(get("/api/employer/interviews").with(httpBasic("recruiter","LocalTestEmployer!2026"))).andReturn().getResponse().getContentAsString();
        assertThat(list).doesNotContain(id);
        mongo.updateFirst(Query.query(Criteria.where("_id").is(candidate)),new Update().set("organizationId","another-employer"),"applications");
        mvc.perform(post("/api/employer/interviews").with(httpBasic("recruiter","LocalTestEmployer!2026"))
            .contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isNotFound());
    }
}
