package com.fairmatch;

import com.fasterxml.jackson.databind.*;
import java.time.Instant;
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

@SpringBootTest(properties={"fairmatch.seed=false","fairmatch.bootstrap.demo-enabled=false","fairmatch.mail.dispatch=false"})
@AutoConfigureMockMvc
class CandidatePrivacyTest {
    static final String DATABASE="fairmatch_privacy_test_"+UUID.randomUUID().toString().replace("-","");
    @DynamicPropertySource static void database(DynamicPropertyRegistry r) { r.add("spring.data.mongodb.uri",()->"mongodb://127.0.0.1:27018/"+DATABASE+"?replicaSet=fairmatch-rs"); }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired MongoTemplate mongo;

    JsonNode call(MockHttpServletRequestBuilder request,String token,Object body,int expected) throws Exception {
        if(token!=null)request.header("Authorization","Bearer "+token);
        if(body!=null)request.contentType("application/json").content(json.writeValueAsString(body));
        var output=mvc.perform(request).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
        return output.isBlank()?json.nullNode():json.readTree(output);
    }
    JsonNode register(String role) throws Exception {
        var name="privacy_"+UUID.randomUUID().toString().replace("-","");
        return call(post("/api/public/auth/register"),null,Map.of("username",name,"password","TestPassword!123","contact",name+"@example.test","name","Privacy test","role",role,"organizationName","Privacy test company"),200);
    }
    void insert(String collection, String id, String owner, Object... fields) {
        var doc=new Document("_id",id).append("ownerId",owner);
        for(int i=0;i<fields.length;i+=2)doc.append((String)fields[i],fields[i+1]);
        mongo.getCollection(collection).insertOne(doc);
    }

    @Test void exportIncludesOwnedDataAndExcludesOtherCandidatesAndSecrets() throws Exception {
        var session=register("CANDIDATE");var token=session.get("token").asText();var owner=session.at("/user/id").asText();
        var stranger=register("CANDIDATE");var other=stranger.at("/user/id").asText();
        call(put("/api/candidate/profile"),token,Map.of("role","Software Engineer","experience","My own work","education","CSE","skills",List.of("Java")),200);
        call(put("/api/candidate/drafts/own-job"),token,Map.of("role","My draft"),200);
        insert("applications","own-application",owner,"role","My submitted role","jobId","own-job","band","PRIVATE_BAND","stageReason","PRIVATE_REVIEW_REASON");
        insert("applications","stranger-application",other,"role","STRANGER_RECORD");
        insert("application_messages","own-message",owner,"applicationId","own-application","message","Shared conversation","sender","Employer");
        insert("application_messages","stranger-message",other,"applicationId","stranger-application","message","STRANGER_RECORD");
        insert("interviews","own-interview",owner,"candidateId","own-application","status","Scheduled","notes","PRIVATE_INTERVIEW_NOTES","scores",List.of(5,5));
        insert("interviews","stranger-interview",other,"candidateId","stranger-application","location","STRANGER_RECORD");
        insert("candidate_documents","own-cv",owner,"filename","private-cv.pdf","text","Owned extracted text","storageKey","PRIVATE_STORAGE_KEY","pages",List.of(new Document("number",1).append("text","Page evidence").append("internalSecret","PRIVATE_NESTED_SECRET")));
        insert("candidate_documents","stranger-cv",other,"filename","STRANGER_RECORD");
        insert("support_cases","own-case",owner,"subject","My privacy question","response","Visible response");
        insert("notifications","own-notice",owner,"title","My notification");
        insert("notifications","stranger-notice",other,"title","STRANGER_RECORD");
        insert("account_sessions","unexportable-session",owner,"token","PRIVATE_TOKEN");
        var result=mvc.perform(get("/api/candidate/privacy/export").header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store, private"))
            .andExpect(header().string("Content-Disposition","attachment; filename=\"fairmatch-candidate-data.json\""))
            .andReturn().getResponse().getContentAsString();
        assertThat(result).contains("My own work","My submitted role","My draft","Shared conversation","Page evidence","My privacy question","My notification");
        assertThat(result).doesNotContain("STRANGER_RECORD","PRIVATE_","passwordHash","$2a$","internalSecret","storageKey");
        var data=json.readTree(result);
        assertThat(data.get("applications").size()).isEqualTo(1);
        assertThat(data.at("/account/id").asText()).isEqualTo(owner);
        // A caller-supplied account query cannot change the authenticated export scope.
        assertThat(call(get("/api/candidate/privacy/export").param("ownerId",other),token,null,200).at("/account/id").asText()).isEqualTo(owner);
    }

    @Test void exportRequiresCandidateRoleAndDoesNotSilentlyTruncate() throws Exception {
        call(get("/api/candidate/privacy/export"),null,null,401);
        call(get("/api/candidate/privacy/export"),register("EMPLOYER").get("token").asText(),null,403);
        var session=register("CANDIDATE");var owner=session.at("/user/id").asText();
        var notices=new ArrayList<Document>();
        for(int i=0;i<1001;i++)notices.add(new Document("_id",UUID.randomUUID().toString()).append("ownerId",owner).append("title","Synthetic notice"));
        mongo.getCollection("notifications").insertMany(notices);
        var response=call(get("/api/candidate/privacy/export"),session.get("token").asText(),null,409);
        assertThat(response.toString()).contains("no partial file");
    }

    @Test void draftDeletionChecksOwnershipAndStaleTimestampAndPreservesSubmissions() throws Exception {
        var session=register("CANDIDATE");var token=session.get("token").asText();var owner=session.at("/user/id").asText();
        var other=register("CANDIDATE").get("token").asText();
        call(put("/api/candidate/profile"),token,Map.of("role","Saved profile","experience","","education","","skills",List.of()),200);
        call(put("/api/candidate/drafts/shared-job"),token,Map.of("role","My saved draft"),200);
        call(put("/api/candidate/drafts/shared-job"),other,Map.of("role","Other saved draft"),200);
        insert("applications","preserved-submission",owner,"role","Submitted snapshot","jobId","shared-job");
        var drafts=call(get("/api/candidate/privacy/drafts"),token,null,200);
        assertThat(drafts.size()).isEqualTo(1);
        assertThat(drafts.toString()).doesNotContain("Other saved draft");
        var stamp=drafts.get(0).get("updatedAt").asText();
        call(delete("/api/candidate/privacy/drafts/shared-job"),token,Map.of("expectedUpdatedAt",Instant.EPOCH.toString()),409);
        call(delete("/api/candidate/privacy/drafts/shared-job"),token,Map.of("expectedUpdatedAt",stamp),200);
        assertThat(call(get("/api/candidate/privacy/drafts"),token,null,200).size()).isZero();
        assertThat(call(get("/api/candidate/privacy/drafts"),other,null,200).size()).isEqualTo(1);
        assertThat(call(get("/api/candidate/profile"),token,null,200).get("role").asText()).isEqualTo("Saved profile");
        assertThat(mongo.getCollection("applications").countDocuments(new Document("_id","preserved-submission"))).isEqualTo(1);
        call(delete("/api/candidate/privacy/drafts/shared-job"),token,Map.of("expectedUpdatedAt",stamp),404);
    }

    @Test void exportIsRateLimitedPerAccount() throws Exception {
        var token=register("CANDIDATE").get("token").asText();
        for(int i=0;i<6;i++)call(get("/api/candidate/privacy/export"),token,null,200);
        call(get("/api/candidate/privacy/export"),token,null,429);
    }
}
