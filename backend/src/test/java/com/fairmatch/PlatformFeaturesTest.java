package com.fairmatch;

import com.fasterxml.jackson.databind.*;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"fairmatch.seed=false","fairmatch.bootstrap.demo-enabled=true","fairmatch.mail.dispatch=false"}) @AutoConfigureMockMvc
class PlatformFeaturesTest {
    static final String DATABASE="fairmatch_platform_test_"+UUID.randomUUID().toString().replace("-","");
    @DynamicPropertySource static void database(DynamicPropertyRegistry r){r.add("spring.data.mongodb.uri",()->"mongodb://127.0.0.1:27018/"+DATABASE+"?replicaSet=fairmatch-rs");}
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;
    JsonNode call(MockHttpServletRequestBuilder method,String token,Object body,int expected) throws Exception {
        if(token!=null)method.header("Authorization","Bearer "+token);
        if(body!=null)method.contentType("application/json").content(json.writeValueAsString(body));
        var response=mvc.perform(method).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
        return response.isBlank()?json.nullNode():json.readTree(response);
    }
    JsonNode register(String role) throws Exception {
        var name="qa_"+UUID.randomUUID().toString().replace("-","");
        return call(post("/api/public/auth/register"),null,Map.of("username",name,"password","TestPassword!123","contact",name+"@example.test","name","QA Candidate","role",role,"organizationName","QA Engineering"),200);
    }
    String login(String username,String password)throws Exception{return call(post("/api/public/auth/login"),null,Map.of("username",username,"password",password),200).get("token").asText();}
    Map<String,Object> job(){return Map.of("title","Software Engineer","department","CSE","location","Dhaka","workplace","On-site","salary","BDT 40000 monthly","description","Build and test software features with clear technical documentation.","requirements",List.of("Java programming"),"status","Active","closes",LocalDate.now().plusDays(20).toString(),"noFeeConfirmed",true);}
    Map<String,Object> application(){var r=new HashMap<String,Object>();r.put("name","Untrusted supplied identity");r.put("contact","untrusted@example.test");r.put("role","Software Engineer");r.put("experience","Built Java applications and wrote integration tests for APIs.");r.put("education","BSc in CSE");r.put("skills",List.of("Java"));r.put("example","Built a persistent application system with role-based authorization and integration tests.");r.put("availability","30 days");r.put("location","Dhaka");r.put("consent",true);r.put("evidenceConfirmed",true);r.put("finalConsent",true);return r;}
    String publish(String employer)throws Exception{return call(post("/api/employer/jobs"),employer,job(),201).get("id").asText();}

    @Test void jwtRolesAndAccountOwnershipAreEnforced() throws Exception {
        var candidate=register("CANDIDATE");var token=candidate.get("token").asText();var username=candidate.at("/user/username").asText();
        assertThat(login(username,"TestPassword!123")).isNotBlank();
        call(get("/api/account/me"),token,null,200);call(get("/api/employer/jobs"),token,null,403);call(get("/api/admin/organizations"),token,null,403);
        mvc.perform(get("/api/account/me").header("Authorization","Bearer "+token.substring(0,token.lastIndexOf('.')+1)+"AAAA")).andExpect(status().isUnauthorized());
        call(post("/api/public/auth/login"),null,Map.of("username",username,"password","incorrect"),401);
        call(post("/api/public/auth/register"),null,Map.of("username","illegal_admin","contact","illegal@example.test","name","Invalid","password","TestPassword!123","role","ADMIN"),400);
        var second=register("CANDIDATE").get("token").asText();
        assertThat(call(get("/api/candidate/profile"),second,null,200)).isEqualTo(call(get("/api/candidate/profile"),second,null,200));
        assertThat(call(get("/api/candidate/drafts/unsaved"),second,null,200)).isEqualTo(call(get("/api/candidate/drafts/unsaved"),second,null,200));
        var profile=Map.of("role","QA Engineer","experience","Tested a Java application","education","BSc CSE","skills",List.of("Java","Testing"));
        call(put("/api/candidate/profile"),token,profile,200);
        assertThat(call(get("/api/candidate/profile"),token,null,200).get("role").asText()).isEqualTo("QA Engineer");
        assertThat(call(get("/api/candidate/profile"),second,null,200).get("role").asText()).isEmpty();
        call(put("/api/candidate/drafts/qa-job"),token,Map.of("skills",List.of("Java"),"experience","Saved draft"),200);
        assertThat(call(get("/api/candidate/drafts/qa-job"),second,null,200).get("values").size()).isZero();
        call(put("/api/candidate/drafts/qa-job"),token,Map.of("skills",true),400);
    }
    @Test void organizationApprovalControlsPublishingAndTenantIsolation() throws Exception {
        var employer=register("EMPLOYER");var token=employer.get("token").asText();var org=employer.at("/user/organizationId").asText();
        call(post("/api/employer/jobs"),token,job(),409);
        var admin=login("admin","LocalTestAdmin!2026");
        var file=new org.springframework.mock.web.MockMultipartFile("file","synthetic-business.pdf","application/pdf",getClass().getResourceAsStream("/test-resume.pdf").readAllBytes());
        var uploaded=mvc.perform(multipart("/api/employer/organization/evidence").file(file).param("type","Business registration").param("description","Synthetic business evidence for integration testing only.").param("expectedVersion","0").header("Authorization","Bearer "+token)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        var documentId=json.readTree(uploaded).get("id").asText();
        var review=Map.of("status","Verified","reason","Reviewed the supplied organization record and synthetic supporting PDF.","reviewed",true,"expectedVersion",1,"reviewedDocumentIds",List.of(documentId));
        call(post("/api/admin/organizations/"+org+"/review"),admin,review,200);
        call(post("/api/admin/organizations/"+org+"/review"),admin,review,409);
        var id=publish(token);var other=login("recruiter","LocalTestEmployer!2026");
        assertThat(call(get("/api/employer/jobs"),other,null,200).toString()).doesNotContain(id);
        call(put("/api/employer/jobs/"+id),other,job(),404);
        call(put("/api/employer/organization"),token,Map.of("name","Renamed QA Company","industry","IT","location","Dhaka","website","","expectedVersion",2),200);
        call(post("/api/employer/jobs"),token,job(),409);
        call(delete("/api/employer/organization/evidence/"+documentId),token,Map.of("expectedVersion",3),200);
    }
    @Test void ownedApplicationReviewConversationInterviewsAndWithdrawalPersist() throws Exception {
        var employer=login("recruiter","LocalTestEmployer!2026");var candidate=register("CANDIDATE");var token=candidate.get("token").asText();var stranger=register("CANDIDATE").get("token").asText();
        var jobId=publish(employer);var id=call(post("/api/candidate/jobs/"+jobId+"/applications"),token,application(),201).get("id").asText();
        call(post("/api/candidate/jobs/"+jobId+"/applications"),token,application(),409);
        assertThat(call(get("/api/candidate/applications"),token,null,200).toString()).contains(id);
        assertThat(call(get("/api/candidate/applications"),stranger,null,200).toString()).doesNotContain(id);
        assertThat(call(get("/api/employer/applications"),employer,null,200).toString()).doesNotContain("Untrusted supplied identity","untrusted@example.test",candidate.at("/user/contact").asText());
        call(post("/api/employer/applications/"+id+"/review"),employer,Map.of("band","Strong evidence","expectedBand","Needs review","reason","The Java experience directly supports the published technical requirement."),200);
        call(post("/api/employer/applications/"+id+"/information-request"),employer,Map.of("message","Please describe how you tested database persistence in your Java project."),200);
        call(post("/api/candidate/applications/"+id+"/messages"),token,Map.of("message","I restarted the backend and verified that the saved records were still available."),200);
        assertThat(call(get("/api/employer/applications/"+id+"/messages"),employer,null,200).size()).isEqualTo(2);
        call(get("/api/candidate/applications/"+id+"/messages"),stranger,null,404);
        call(patch("/api/employer/applications/"+id+"/stage"),employer,Map.of("stage","Interview","expectedStage","New","reason","Relevant Java evidence is ready for structured interview review."),200);
        call(post("/api/employer/interviews"),employer,Map.of("candidateId",id,"date",LocalDate.now().plusDays(2).toString(),"time","10:00","format","Video interview","location","Use the classroom meeting room"),201);
        var interviews=call(get("/api/candidate/interviews"),token,null,200);
        assertThat(interviews.toString()).contains(id).doesNotContain("scores","notes");
        assertThat(call(get("/api/candidate/interviews"),stranger,null,200).size()).isZero();
        assertThat(call(get("/api/account/notifications"),token,null,200).size()).isGreaterThanOrEqualTo(4);
        call(post("/api/candidate/applications/"+id+"/withdrawal"),stranger,Map.of(),404);
        call(post("/api/candidate/applications/"+id+"/withdrawal"),token,Map.of(),200);
        assertThat(call(get("/api/candidate/interviews"),token,null,200).get(0).get("status").asText()).isEqualTo("Cancelled");
        assertThat(call(get("/api/candidate/applications"),token,null,200).get(0).get("stage").asText()).isEqualTo("Withdrawn");
        call(patch("/api/employer/applications/"+id+"/stage"),employer,Map.of("stage","Offer","expectedStage","Withdrawn","reason","Trying to reopen a withdrawn application incorrectly."),409);
    }
    @Test void supportResponsesAndFairnessReviewsArePersistedWithStaleProtection() throws Exception {
        var token=register("CANDIDATE").get("token").asText();var admin=login("admin","LocalTestAdmin!2026");
        var item=call(post("/api/account/cases"),token,Map.of("subject","Review my application","category","Candidate appeal","reference","QA","detail","Please review how the job criteria were applied to my submitted evidence."),200);
        var id=item.get("id").asText();
        call(post("/api/admin/cases/"+id+"/review"),admin,Map.of("status","Resolved","reason","The review is complete and the assessment has been explained to the candidate.","expectedVersion",0),200);
        assertThat(call(get("/api/account/cases"),token,null,200).get(0).get("status").asText()).isEqualTo("Resolved");
        var employer=login("recruiter","LocalTestEmployer!2026");var jobId=publish(employer);
        var report=call(get("/api/employer/jobs/"+jobId+"/fairness"),employer,null,200);
        var body=Map.of("snapshot",report.get("snapshot").asText(),"reason","Reviewed the stated requirements and recorded that there are no applicants yet.","confirmed",true);
        assertThat(call(post("/api/employer/jobs/"+jobId+"/fairness"),employer,body,200).get("reviewCurrent").asBoolean()).isTrue();
        call(post("/api/candidate/jobs/"+jobId+"/applications"),token,application(),201);
        call(post("/api/employer/jobs/"+jobId+"/fairness"),employer,body,409);
    }
    @Test void privatePdfStorageExtractionConfirmationAndDeletion() throws Exception {
        var token=register("CANDIDATE").get("token").asText();var stranger=register("CANDIDATE").get("token").asText();
        byte[] pdf;try(var input=getClass().getResourceAsStream("/test-resume.pdf")){pdf=input.readAllBytes();}
        var file=new org.springframework.mock.web.MockMultipartFile("file","resume.pdf","application/pdf",pdf);
        var result=mvc.perform(multipart("/api/candidate/documents").file(file).header("Authorization","Bearer "+token)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        var document=json.readTree(result);var id=document.get("id").asText();
        try {
            assertThat(document.get("text").asText()).contains("Java APIs","Computer Science");
            assertThat(document.get("extractionVersion").asInt()).isEqualTo(3);
            assertThat(document.get("pages").size()).isPositive();
            assertThat(call(get("/api/candidate/documents"),stranger,null,200).size()).isZero();
            call(get("/api/candidate/documents/"+id+"/file"),stranger,null,404);
            call(post("/api/candidate/documents/"+id+"/extraction"),stranger,Map.of(),404);
            var downloaded=mvc.perform(get("/api/candidate/documents/"+id+"/file").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
            assertThat(downloaded).isEqualTo(pdf);
            var profile=Map.of("role","Software Engineer","experience","Confirmed Java API experience","education","BSc CSE","skills",List.of("Java"));
            call(post("/api/candidate/documents/"+id+"/confirmation"),token,Map.of("profile",profile,"confirmed",false),400);
            call(post("/api/candidate/documents/"+id+"/confirmation"),token,Map.of("profile",profile,"confirmed",true),200);
            assertThat(call(get("/api/candidate/profile"),token,null,200).get("experience").asText()).isEqualTo("Confirmed Java API experience");
            var refreshed=call(post("/api/candidate/documents/"+id+"/extraction"),token,Map.of(),200);
            assertThat(refreshed.get("pages")).isEqualTo(document.get("pages"));
            assertThat(refreshed.get("status").asText()).isEqualTo("Needs confirmation");
            assertThat(call(get("/api/candidate/profile"),token,null,200).get("experience").asText()).isEqualTo("Confirmed Java API experience");
            call(post("/api/candidate/documents/"+id+"/extraction?ocr=true"),stranger,Map.of(),404);
            var ocr=call(post("/api/candidate/documents/"+id+"/extraction?ocr=true"),token,Map.of(),200);
            assertThat(ocr.get("pages").get(0).get("method").asText()).isEqualTo("tesseract-eng-ben");
            assertThat(ocr.get("text").asText()).contains("Java");
            assertThat(call(get("/api/candidate/profile"),token,null,200).get("experience").asText()).isEqualTo("Confirmed Java API experience");
            var bad=new org.springframework.mock.web.MockMultipartFile("file","fake.pdf","application/pdf","not a pdf".getBytes());
            mvc.perform(multipart("/api/candidate/documents").file(bad).header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        } finally {call(delete("/api/candidate/documents/"+id),token,null,200);}
        call(get("/api/candidate/documents/"+id+"/file"),token,null,404);
    }
}
