package com.fairmatch;

import com.fasterxml.jackson.databind.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.mock.web.MockMultipartFile;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"fairmatch.seed=false","fairmatch.bootstrap.demo-enabled=true","fairmatch.mail.dispatch=false"}) @AutoConfigureMockMvc
class OrganizationEvidenceTest {
    static final String DATABASE="fairmatch_business_test_"+UUID.randomUUID().toString().replace("-","");
    @DynamicPropertySource static void database(DynamicPropertyRegistry r){r.add("spring.data.mongodb.uri",()->"mongodb://127.0.0.1:27018/"+DATABASE+"?replicaSet=fairmatch-rs");}
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;
    @Autowired org.springframework.data.mongodb.core.MongoTemplate mongo;
    JsonNode call(MockHttpServletRequestBuilder method,String token,Object body,int expected)throws Exception{
        if(token!=null)method.header("Authorization","Bearer "+token);
        if(body!=null)method.contentType("application/json").content(json.writeValueAsString(body));
        var response=mvc.perform(method).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();return response.isBlank()?json.nullNode():json.readTree(response);
    }
    JsonNode register(String role)throws Exception{var name="business_"+UUID.randomUUID().toString().replace("-","");return call(post("/api/public/auth/register"),null,Map.of("username",name,"password","TestPassword!123","contact",name+"@example.test","name","Synthetic Evidence Test","role",role,"organizationName","Synthetic Test Organization"),200);}
    String admin()throws Exception{return call(post("/api/public/auth/login"),null,Map.of("username","admin","password","LocalTestAdmin!2026"),200).get("token").asText();}
    byte[] pdf()throws Exception{return getClass().getResourceAsStream("/test-resume.pdf").readAllBytes();}
    JsonNode upload(String token,long version)throws Exception{
        var response=mvc.perform(multipart("/api/employer/organization/evidence").file(new MockMultipartFile("file","test-evidence.pdf","application/pdf",pdf())).param("type","Business registration").param("description","Synthetic supporting file for a test organization.").param("expectedVersion",Long.toString(version)).header("Authorization","Bearer "+token)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();return json.readTree(response);
    }
    Map<String,Object> decision(long version,List<String> ids){return Map.of("status","Verified","reason","Reviewed the synthetic organization details and every supporting document.","reviewed",true,"expectedVersion",version,"reviewedDocumentIds",ids);}
    void cleanup(String token)throws Exception{var b=call(get("/api/employer/organization/evidence"),token,null,200);long version=b.at("/organization/version").asLong();for(var item:b.get("documents"))call(delete("/api/employer/organization/evidence/"+item.get("id").asText()),token,Map.of("expectedVersion",version++),200);}
    @Test void approvalRequiresCurrentDocumentsAndSavesHistory()throws Exception{
        var user=register("EMPLOYER");var token=user.get("token").asText();var org=user.at("/user/organizationId").asText();var admin=admin();var path="/api/admin/organizations/"+org+"/review";
        call(post(path),admin,decision(0,List.of()),409);
        assertThat(call(get("/api/employer/organization/evidence"),token,null,200).at("/organization/version").asLong()).isZero();
        try{
            var first=upload(token,0);var id=first.get("id").asText();
            call(post(path),admin,decision(1,List.of("invented-id")),409);
            call(post(path),admin,decision(1,List.of(id)),200);
            var saved=call(get("/api/admin/organizations/"+org+"/evidence"),admin,null,200);
            assertThat(saved.at("/organization/status").asText()).isEqualTo("Verified");assertThat(saved.at("/history/0/documents/0/sha256").asText()).isEqualTo(first.get("sha256").asText());
            call(post(path),admin,decision(1,List.of(id)),409);
            upload(token,2);
            var changed=call(get("/api/employer/organization/evidence"),token,null,200);
            assertThat(changed.at("/organization/status").asText()).isEqualTo("Pending");assertThat(changed.get("history").size()).isEqualTo(1);
            call(post(path),admin,decision(2,List.of(id)),409);
            call(post(path),admin,decision(3,List.of(id)),409);
        }finally{cleanup(token);}
    }
    @Test void filesArePrivateAcrossOrganizationsAndRoles()throws Exception{
        var owner=register("EMPLOYER");var token=owner.get("token").asText();var stranger=register("EMPLOYER");var candidate=register("CANDIDATE");var admin=admin();
        try{
            var id=upload(token,0).get("id").asText();var path="/api/employer/organization/evidence/"+id+"/file";
            var response=mvc.perform(get(path).header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store, private")).andReturn().getResponse();
            assertThat(response.getContentAsByteArray()).isEqualTo(pdf());
            call(get(path),stranger.get("token").asText(),null,404);call(get(path),candidate.get("token").asText(),null,403);call(get(path),null,null,401);
            call(get("/api/admin/organizations/"+owner.at("/user/organizationId").asText()+"/evidence"),token,null,403);
            mvc.perform(get("/api/admin/organizations/"+owner.at("/user/organizationId").asText()+"/evidence/"+id+"/file").header("Authorization","Bearer "+admin)).andExpect(status().isOk());
            call(get("/api/admin/organizations/"+stranger.at("/user/organizationId").asText()+"/evidence/"+id+"/file"),admin,null,404);
        }finally{cleanup(token);}
    }
    @Test void removalsUseVersionAndInvalidateApprovalWithoutErasingDecisionHistory()throws Exception{
        var owner=register("EMPLOYER");var token=owner.get("token").asText();var org=owner.at("/user/organizationId").asText();var admin=admin();
        var id=upload(token,0).get("id").asText();
        call(post("/api/admin/organizations/"+org+"/review"),admin,decision(1,List.of(id)),200);
        call(delete("/api/employer/organization/evidence/"+id),token,Map.of("expectedVersion",1),409);
        call(delete("/api/employer/organization/evidence/"+id),token,Map.of("expectedVersion",2),200);
        var result=call(get("/api/employer/organization/evidence"),token,null,200);
        assertThat(result.get("documents").size()).isZero();assertThat(result.at("/organization/status").asText()).isEqualTo("Pending");assertThat(result.at("/history/0/documents/0/id").asText()).isEqualTo(id);
        call(get("/api/employer/organization/evidence/"+id+"/file"),token,null,404);
        assertThat(mongo.getCollection("organization_document_deletions").countDocuments()).isZero();
    }
    @Test void changesCanBeRequestedWithoutFilesAndInvalidUploadsAreRejected()throws Exception{
        var owner=register("EMPLOYER");var token=owner.get("token").asText();var org=owner.at("/user/organizationId").asText();
        call(post("/api/admin/organizations/"+org+"/review"),admin(),Map.of("status","Changes requested","reviewed",true,"expectedVersion",0,"reason","Please supply a document establishing the registered organization name."),200);
        mvc.perform(multipart("/api/employer/organization/evidence").file(new MockMultipartFile("file","fake.pdf","application/pdf","not a PDF".getBytes())).param("type","Business registration").param("description","Invalid upload should not change the organization.").param("expectedVersion","1").header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        assertThat(call(get("/api/employer/organization/evidence"),token,null,200).at("/organization/version").asInt()).isEqualTo(1);
    }
    @Test void unverifiedEmployerCanSaveReopenAndEditDraftButCannotPublish()throws Exception{
        var owner=register("EMPLOYER");var token=owner.get("token").asText();
        var draft=new HashMap<String,Object>();draft.put("title","Software Engineer draft");draft.put("department","");draft.put("location","");draft.put("workplace","On-site");draft.put("salary","");draft.put("description","");draft.put("requirements",List.of());draft.put("status","Draft");draft.put("closes",java.time.LocalDate.now().plusDays(30).toString());draft.put("noFeeConfirmed",false);
        var saved=call(post("/api/employer/jobs"),token,draft,201);var id=saved.get("id").asText();
        assertThat(call(get("/api/employer/jobs"),token,null,200).toString()).contains(id,"Draft");
        assertThat(call(get("/api/public/jobs"),null,null,200).toString()).doesNotContain(id);
        draft.put("title","Edited draft title");call(put("/api/employer/jobs/"+id),token,draft,200);
        assertThat(call(get("/api/employer/jobs"),token,null,200).toString()).contains("Edited draft title");
        draft.put("status","Active");call(put("/api/employer/jobs/"+id),token,draft,409);
        assertThat(call(get("/api/employer/jobs"),token,null,200).get(0).get("status").asText()).isEqualTo("Draft");
    }
}
