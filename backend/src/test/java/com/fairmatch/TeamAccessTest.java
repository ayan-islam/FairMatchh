package com.fairmatch;

import com.fasterxml.jackson.databind.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties={"fairmatch.seed=false","fairmatch.bootstrap.demo-enabled=false","fairmatch.mail.dispatch=false"})
@AutoConfigureMockMvc
class TeamAccessTest {
    static final String DATABASE="fairmatch_team_test_"+UUID.randomUUID().toString().replace("-","");
    static final String PASSWORD="SyntheticTeam!123";
    @DynamicPropertySource static void database(DynamicPropertyRegistry r){r.add("spring.data.mongodb.uri",()->"mongodb://127.0.0.1:27018/"+DATABASE+"?replicaSet=fairmatch-rs");}
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired MongoTemplate mongo;
    String unique(){return "team_"+UUID.randomUUID().toString().replace("-","");}
    JsonNode call(MockHttpServletRequestBuilder method,String token,Object body,int expected)throws Exception {
        if(token!=null)method.header("Authorization","Bearer "+token);
        method.with(r->{r.setRemoteAddr(UUID.randomUUID().toString());return r;});
        if(body!=null)method.contentType("application/json").content(json.writeValueAsString(body));
        var text=mvc.perform(method).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
        return text.isBlank()?json.nullNode():json.readTree(text);
    }
    JsonNode register(String role)throws Exception {
        var name=unique();return call(post("/api/public/auth/register"),null,Map.of("username",name,"password",PASSWORD,"contact",name+"@example.test","name","Synthetic Team Owner","role",role,"organizationName","Synthetic Team Organization"),200);
    }
    JsonNode invite(JsonNode owner,String email)throws Exception{return call(post("/api/employer/team/invitations"),owner.get("token").asText(),Map.of("email",email),201);}
    Map<String,Object> acceptance(JsonNode invitation,String email) {return new HashMap<>(Map.of("code",invitation.get("code").asText(),"email",email,"username",unique(),"name","Synthetic Recruiter","password",PASSWORD));}
    JsonNode join(JsonNode invitation,String email)throws Exception{return call(post("/api/public/team/accept"),null,acceptance(invitation,email),200);}
    String token(JsonNode account){return account.get("token").asText();}
    String accessPath(JsonNode member){return "/api/employer/team/members/"+member.at("/user/id").asText()+"/access";}
    Map<String,Object> access(String state,int version){return Map.of("status",state,"expectedVersion",version,"reason","Team responsibility changed after owner review.");}

    @Test void invitationCreatesRealScopedRecruiterAndStoresOnlyHash()throws Exception {
        var owner=register("EMPLOYER");var email=unique()+"@example.test";var invitation=invite(owner,email);var member=join(invitation,email);
        assertThat(member.at("/user/organizationId").asText()).isEqualTo(owner.at("/user/organizationId").asText());
        assertThat(member.at("/user/role").asText()).isEqualTo("EMPLOYER");
        var record=mongo.getCollection("team_invitations").find(new org.bson.Document("_id",invitation.at("/invitation/id").asText())).first();
        assertThat(record.getString("codeHash")).hasSize(64).isNotEqualTo(invitation.get("code").asText());
        assertThat(record.toJson()).doesNotContain(invitation.get("code").asText());
        assertThat(record.getString("status")).isEqualTo("Accepted");
        var board=call(get("/api/employer/team"),token(owner),null,200);
        assertThat(board.get("canManage").asBoolean()).isTrue();assertThat(board.get("members").size()).isEqualTo(2);
        assertThat(board.toString()).doesNotContain("codeHash",invitation.get("code").asText(),"passwordHash");
        var recruiter=call(get("/api/employer/team"),token(member),null,200);
        assertThat(recruiter.get("canManage").asBoolean()).isFalse();assertThat(recruiter.get("invitations").size()).isZero();
        call(get("/api/employer/jobs"),token(member),null,200);
        call(get("/api/employer/applications"),token(member),null,200);
        call(get("/api/candidate/profile"),token(member),null,403);
        assertThat(mongo.getCollection("account_verifications").countDocuments(new org.bson.Document("_id",member.at("/user/id").asText()))).isZero();
    }

    @Test void ownerBoundariesAndProtectedOwnerApplyOnTheServer()throws Exception {
        var owner=register("EMPLOYER");var other=register("EMPLOYER");var candidate=register("CANDIDATE");var email=unique()+"@example.test";var member=join(invite(owner,email),email);
        call(post("/api/employer/team/invitations"),token(member),Map.of("email",unique()+"@example.test"),403);
        call(post(accessPath(member)),token(other),access("Suspended",0),404);
        call(post(accessPath(owner)),token(owner),access("Suspended",0),409);
        call(post(accessPath(member)),token(member),access("Suspended",0),403);
        call(get("/api/employer/team"),token(candidate),null,403);call(get("/api/employer/team"),null,null,401);
        call(get("/api/employer/organization/evidence"),token(member),null,403);
        call(put("/api/employer/organization"),token(member),Map.of("name","Altered organization","industry","IT","location","Dhaka","website","","expectedVersion",0),403);
        assertThat(call(get("/api/employer/organization"),token(owner),null,200).get("name").asText()).isEqualTo("Synthetic Team Organization");
    }

    @Test void expiredWrongEmailReusedRevokedAndDuplicateInvitationsAreRejected()throws Exception {
        var owner=register("EMPLOYER");var email=unique()+"@example.test";var invitation=invite(owner,email);
        call(post("/api/employer/team/invitations"),token(owner),Map.of("email",email.toUpperCase(Locale.ROOT)),409);
        call(post("/api/public/team/accept"),null,acceptance(invitation,unique()+"@example.test"),400);
        var badRole=acceptance(invitation,email);badRole.put("role","ADMIN");call(post("/api/public/team/accept"),null,badRole,400);
        var joined=join(invitation,email);call(post("/api/public/team/accept"),null,acceptance(invitation,email),400);
        call(post("/api/employer/team/invitations"),token(owner),Map.of("email",joined.at("/user/contact").asText()),409);
        var nextEmail=unique()+"@example.test";var expired=invite(owner,nextEmail);
        mongo.updateFirst(Query.query(Criteria.where("_id").is(expired.at("/invitation/id").asText())),new Update().set("expiresAt",Instant.now().minusSeconds(60)),"team_invitations");
        call(post("/api/public/team/accept"),null,acceptance(expired,nextEmail),400);
        assertThat(call(get("/api/employer/team"),token(owner),null,200).toString()).contains("Expired");
        var revoked=invite(owner,nextEmail);var path="/api/employer/team/invitations/"+revoked.at("/invitation/id").asText()+"/revocation";
        call(post(path),token(owner),Map.of("expectedVersion",0),200);
        call(post(path),token(owner),Map.of("expectedVersion",0),409);
        call(post("/api/public/team/accept"),null,acceptance(revoked,nextEmail),400);
        var invalid=acceptance(invitation,email);invalid.put("code","invented");call(post("/api/public/team/accept"),null,invalid,400);
    }

    @Test void suspensionRevokesExistingTokensAndRestoreRequiresFreshLogin()throws Exception {
        var owner=register("EMPLOYER");var email=unique()+"@example.test";var member=join(invite(owner,email),email);var path=accessPath(member);
        call(post(path),token(owner),access("Suspended",0),200);
        call(get("/api/employer/jobs"),token(member),null,401);
        var login=Map.of("username",member.at("/user/username").asText(),"password",PASSWORD);
        call(post("/api/public/auth/login"),null,login,403);
        call(post(path),token(owner),access("Active",0),409);
        call(post(path),token(owner),access("Active",1),200);
        call(get("/api/account/me"),token(member),null,401);
        var fresh=call(post("/api/public/auth/login"),null,login,200);call(get("/api/employer/jobs"),token(fresh),null,200);
        assertThat(call(get("/api/employer/team"),token(owner),null,200).toString()).contains("Recruiter","Active");
        var events=mongo.getCollection("audit_events").find(new org.bson.Document("reference",member.at("/user/id").asText()).append("action","TEAM_ACCESS_CHANGED")).into(new ArrayList<>());
        assertThat(events).hasSize(2);
    }

    @Test void concurrentAcceptsCreateOneMemberAndDoNotConsumeCodeOnNameConflict()throws Exception {
        var owner=register("EMPLOYER");var email=unique()+"@example.test";var invitation=invite(owner,email);
        var wrong=acceptance(invitation,email);wrong.put("username",owner.at("/user/username").asText());
        call(post("/api/public/team/accept"),null,wrong,409);
        var start=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        try {
            List<Future<Integer>> results=new ArrayList<>();
            for(int n=0;n<2;n++){var body=acceptance(invitation,email);results.add(pool.submit(()->{start.await();return mvc.perform(post("/api/public/team/accept").with(r->{r.setRemoteAddr(UUID.randomUUID().toString());return r;}).contentType("application/json").content(json.writeValueAsString(body))).andReturn().getResponse().getStatus();}));}
            start.countDown();var statuses=List.of(results.get(0).get(30,TimeUnit.SECONDS),results.get(1).get(30,TimeUnit.SECONDS));
            assertThat(statuses.stream().filter(s->s==200).count()).isEqualTo(1);assertThat(statuses).allMatch(s->s==200||s==400||s==409);
            assertThat(mongo.getCollection("accounts").countDocuments(new org.bson.Document("contact",email))).isEqualTo(1);
        } finally {pool.shutdownNow();}
    }

    @Test void ownerAssignmentSurvivesJoinedAccountDateChanges()throws Exception {
        var owner=register("EMPLOYER");var email=unique()+"@example.test";var member=join(invite(owner,email),email);
        mongo.updateFirst(Query.query(Criteria.where("_id").is(member.at("/user/id").asText())),new Update().set("createdAt",Instant.EPOCH),"accounts");
        assertThat(call(get("/api/employer/team"),token(owner),null,200).get("canManage").asBoolean()).isTrue();
        assertThat(call(get("/api/employer/team"),token(member),null,200).get("canManage").asBoolean()).isFalse();
    }

    @Test void unsuccessfulAcceptAttemptsStillCountTowardRateLimit()throws Exception {
        var owner=register("EMPLOYER");var email=unique()+"@example.test";var invitation=invite(owner,email);
        var wrong=acceptance(invitation,unique()+"@example.test");var address=UUID.randomUUID().toString();
        for(int n=0;n<21;n++)mvc.perform(post("/api/public/team/accept").with(r->{r.setRemoteAddr(address);return r;}).contentType("application/json").content(json.writeValueAsString(wrong))).andExpect(status().is(n<20?400:429));
    }
}
