package com.fairmatch;

import com.fasterxml.jackson.databind.*;
import java.time.LocalDate;
import java.util.*;
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
class CriteriaReviewTest {
    static final String DATABASE="fairmatch_criteria_test_"+UUID.randomUUID().toString().replace("-","");
    @DynamicPropertySource static void database(DynamicPropertyRegistry r){r.add("spring.data.mongodb.uri",()->"mongodb://127.0.0.1:27018/"+DATABASE+"?replicaSet=fairmatch-rs");}
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired MongoTemplate mongo;
    JsonNode call(MockHttpServletRequestBuilder method,String token,Object body,int expected) throws Exception {
        if(token!=null)method.header("Authorization","Bearer "+token);
        if(body!=null)method.contentType("application/json").content(json.writeValueAsString(body));
        var text=mvc.perform(method).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
        return text.isBlank()?json.nullNode():json.readTree(text);
    }
    String register(String role) throws Exception {
        var name="criteria_"+UUID.randomUUID().toString().replace("-","");
        return call(post("/api/public/auth/register"),null,Map.of("username",name,"password","TestPassword!123","contact",name+"@example.test","name","Private candidate identity","role",role,"organizationName","Other company"),200).get("token").asText();
    }
    String employer() throws Exception {return call(post("/api/public/auth/login"),null,Map.of("username","recruiter","password","LocalTestEmployer!2026"),200).get("token").asText();}
    Map<String,Object> job(List<String> criteria){return Map.of("title","Engineer","department","CSE","location","Dhaka","workplace","On-site","salary","BDT 40000 monthly","description","Build and test Java APIs with a small engineering team.","requirements",criteria,"status","Active","closes",LocalDate.now().plusDays(20).toString(),"noFeeConfirmed",true);}
    String[] fixture(String employer) throws Exception {
        var jobId=call(post("/api/employer/jobs"),employer,job(List.of("Java programming","Software testing")),201).get("id").asText();
        var candidate=register("CANDIDATE");
        var body=new HashMap<String,Object>();body.put("name","ignored");body.put("contact","ignored@example.test");body.put("role","Engineer");body.put("experience","Built Java APIs and wrote automated tests.");body.put("education","BSc in CSE");body.put("skills",List.of("Java","Testing"));body.put("example","I created integration tests for persistent Java APIs and verified their results after restart.");body.put("availability","30 days");body.put("location","Dhaka");body.put("consent",true);body.put("evidenceConfirmed",true);body.put("finalConsent",true);
        var id=call(post("/api/candidate/jobs/"+jobId+"/applications"),candidate,body,201).get("id").asText();
        return new String[]{jobId,id,candidate};
    }
    Map<String,Object> item(int index,String assessment,String source,String quote){return Map.of("index",index,"assessment",assessment,"source",source,"quote",quote,"reason","This submitted passage directly supports the stated requirement.");}
    Map<String,Object> input(JsonNode report,List<Map<String,Object>> items) {return Map.of("snapshot",report.get("snapshot").asText(),"expectedVersion",report.get("version").asLong(),"expectedBand",report.get("currentBand").asText(),"items",items,"confirmed",true);}

    @Test void humanCriteriaProduceDeterministicBandsWithoutChangingHiringStage() throws Exception {
        var employer=employer();var f=fixture(employer);var path="/api/employer/applications/"+f[1]+"/criteria-review";
        var original=call(get(path),employer,null,200);
        assertThat(original.toString()).doesNotContain("Private candidate identity","@example.test");
        var strong=input(original,List.of(item(0,"Supported","experience","Built Java APIs"),item(1,"Supported","experience","automated tests")));
        var saved=call(post(path),employer,strong,200);
        assertThat(saved.at("/application/band").asText()).isEqualTo("Strong evidence");
        assertThat(saved.at("/application/stage").asText()).isEqualTo("New");
        assertThat(saved.at("/report/reviewCurrent").asBoolean()).isTrue();
        assertThat(call(get(path),employer,null,200).at("/latestReview/items/0/quote").asText()).isEqualTo("Built Java APIs");
        call(post(path),employer,strong,409);
        var partial=input(saved.get("report"),List.of(item(0,"Partial","skills","Java"),item(1,"Needs evidence","none","")));
        saved=call(post(path),employer,partial,200);
        assertThat(saved.at("/application/band").asText()).isEqualTo("Consider");
        var needs=input(saved.get("report"),List.of(item(0,"Needs evidence","none",""),item(1,"Needs evidence","none","")));
        saved=call(post(path),employer,needs,200);
        assertThat(saved.at("/application/band").asText()).isEqualTo("Needs review");
        assertThat(saved.at("/application/stage").asText()).isEqualTo("New");
        assertThat(mongo.getCollection("criteria_review_history").countDocuments(new Document("review.applicationId",f[1]))).isEqualTo(3);
    }

    @Test void inventedSourcesMissingCriteriaAndCrossTenantAccessAreRejected() throws Exception {
        var employer=employer();var f=fixture(employer);var path="/api/employer/applications/"+f[1]+"/criteria-review";
        var report=call(get(path),employer,null,200);
        call(get(path),null,null,401);call(get(path),f[2],null,403);call(get(path),register("EMPLOYER"),null,404);
        var valid=List.of(item(0,"Supported","experience","Built Java APIs"),item(1,"Supported","experience","automated tests"));
        call(post(path),register("EMPLOYER"),input(report,valid),404);
        call(post(path),employer,input(report,List.of(item(0,"Supported","experience","INVENTED PASSAGE"),valid.get(1))),400);
        call(post(path),employer,input(report,List.of(item(0,"Supported","none",""),valid.get(1))),400);
        call(post(path),employer,input(report,List.of(valid.get(0))),400);
        call(post(path),employer,input(report,List.of(valid.get(0),valid.get(0))),400);
        var unconfirmed=new HashMap<>(input(report,valid));unconfirmed.put("confirmed",false);call(post(path),employer,unconfirmed,400);
        assertThat(call(get(path),employer,null,200).get("version").asInt()).isZero();
        assertThat(mongo.getCollection("criteria_review_history").countDocuments(new Document("review.applicationId",f[1]))).isZero();
    }

    @Test void changedJobRequirementsInvalidateSavedReviewsAndBlockStaleWrites() throws Exception {
        var employer=employer();var f=fixture(employer);var path="/api/employer/applications/"+f[1]+"/criteria-review";
        var report=call(get(path),employer,null,200);
        var items=List.of(item(0,"Supported","experience","Built Java APIs"),item(1,"Supported","experience","automated tests"));
        var saved=call(post(path),employer,input(report,items),200).get("report");
        call(put("/api/employer/jobs/"+f[0]),employer,job(List.of("Java programming","Database administration")),200);
        var current=call(get(path),employer,null,200);
        assertThat(current.get("reviewCurrent").asBoolean()).isFalse();
        assertThat(current.get("currentBand").asText()).isEqualTo("Needs review");
        assertThat(current.get("snapshot").asText()).isNotEqualTo(saved.get("snapshot").asText());
        call(post(path),employer,input(saved,items),409);
    }
}
