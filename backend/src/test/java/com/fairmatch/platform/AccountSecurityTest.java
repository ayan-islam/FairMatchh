package com.fairmatch.platform;

import com.fasterxml.jackson.databind.*;
import com.fairmatch.common.ApiException;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** SMTP is mocked only in tests. Each run owns a new database, never the user's records. */
@SpringBootTest(properties={"fairmatch.seed=false","fairmatch.bootstrap.demo-enabled=false","fairmatch.mail.dispatch=false"})
@AutoConfigureMockMvc
class AccountSecurityTest {
    static final String DATABASE="fairmatch_security_test_"+UUID.randomUUID().toString().replace("-","");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("spring.data.mongodb.uri",()->"mongodb://127.0.0.1:27018/"+DATABASE+"?replicaSet=fairmatch-rs");
    }
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired MongoTemplate mongo;
    @MockitoBean MailDelivery delivery;
    @BeforeEach void setup() { reset(delivery); when(delivery.configured()).thenReturn(true); }
    JsonNode call(MockHttpServletRequestBuilder method,String token,Object body,int expected)throws Exception {
        if(token!=null)method.header("Authorization","Bearer "+token);
        if(body!=null)method.contentType("application/json").content(json.writeValueAsString(body));
        String result=mvc.perform(method).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
        return result.isBlank()?json.nullNode():json.readTree(result);
    }
    JsonNode register()throws Exception {
        String username="security_"+UUID.randomUUID().toString().replace("-","");
        return call(post("/api/public/auth/register"),null,Map.of("username",username,"name","Security test","contact",username+"@example.test","password","OriginalPass!123","role","CANDIDATE"),200);
    }
    String login(String username,String password)throws Exception {
        return call(post("/api/public/auth/login"),null,Map.of("username",username,"password",password),200).get("token").asText();
    }
    EmailQueue.Email queued(String recipient) {
        return mongo.findOne(Query.query(Criteria.where("recipient").is(recipient)).with(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC,"validUntil")),EmailQueue.Email.class);
    }
    String code(String recipient) { return queued(recipient).body().split("code is: ")[1].substring(0,6); }

    @Test void logoutRevokesOnlyItsTokenAndBasicCannotBypassSessionAuthentication()throws Exception {
        var a=register();String user=a.at("/user/username").asText(),first=a.get("token").asText(),second=login(user,"OriginalPass!123");
        call(post("/api/account/logout"),first,Map.of(),200);
        call(get("/api/account/me"),first,null,401);
        call(get("/api/account/me"),second,null,200);
        mvc.perform(get("/api/account/me").with(httpBasic(user,"OriginalPass!123"))).andExpect(status().isUnauthorized());
        call(post("/api/account/logout-all"),second,Map.of(),200);
        call(get("/api/account/me"),second,null,401);
    }
    @Test void passwordChangeRequiresCurrentPasswordAndRevokesEverySession()throws Exception {
        var a=register();String token=a.get("token").asText(),user=a.at("/user/username").asText(),other=login(user,"OriginalPass!123");
        call(post("/api/account/password"),token,Map.of("currentPassword","incorrect","newPassword","Replacement!123"),400);
        call(get("/api/account/me"),token,null,200);
        call(post("/api/account/password"),token,Map.of("currentPassword","OriginalPass!123","newPassword","Replacement!123"),200);
        call(get("/api/account/me"),token,null,401);call(get("/api/account/me"),other,null,401);
        call(post("/api/public/auth/login"),null,Map.of("username",user,"password","OriginalPass!123"),401);
        call(get("/api/account/me"),login(user,"Replacement!123"),null,200);
    }
    @Test void verificationIsOwnedAndSingleUseAndNeverReturnsTheCode()throws Exception {
        var a=register();var b=register();String token=a.get("token").asText();
        var challenge=call(post("/api/account/verification"),token,Map.of(),200);
        String secret=code(a.at("/user/contact").asText());
        assertThat(challenge.toString()).doesNotContain(secret);
        var body=Map.of("challengeId",challenge.get("challengeId").asText(),"code",secret);
        call(post("/api/account/verification/confirm"),b.get("token").asText(),body,400);
        call(post("/api/account/verification/confirm"),token,body,200);
        call(post("/api/account/verification/confirm"),token,body,400);
        assertThat(call(get("/api/account/security"),token,null,200).get("verified").asBoolean()).isTrue();
    }
    @Test void resetRevokesSessionsAndDoesNotRevealWhetherAnAccountExists()throws Exception {
        var a=register();String token=a.get("token").asText(),user=a.at("/user/username").asText();
        var challenge=call(post("/api/public/auth/recovery"),null,Map.of("identity",user),200);
        var unknown=call(post("/api/public/auth/recovery"),null,Map.of("identity","missing_"+UUID.randomUUID()),200);
        assertThat(challenge.get("message")).isEqualTo(unknown.get("message"));
        var body=Map.of("challengeId",challenge.get("challengeId").asText(),"code",code(a.at("/user/contact").asText()),"password","RecoveredPass!123");
        call(post("/api/public/auth/reset"),null,body,200);call(post("/api/public/auth/reset"),null,body,400);
        call(get("/api/account/me"),token,null,401);
        call(get("/api/account/me"),login(user,"RecoveredPass!123"),null,200);
    }
    @Test void fiveWrongAttemptsExhaustCodeAndExpiredCodesCannotBeUsed()throws Exception {
        var a=register();String user=a.at("/user/username").asText(),contact=a.at("/user/contact").asText();
        var c=call(post("/api/public/auth/recovery"),null,Map.of("identity",user),200);String secret=code(contact);
        String wrong=secret.equals("000000")?"111111":"000000";
        for(int i=0;i<5;i++)call(post("/api/public/auth/reset"),null,Map.of("challengeId",c.get("challengeId").asText(),"code",wrong,"password","RecoveredPass!123"),400);
        call(post("/api/public/auth/reset"),null,Map.of("challengeId",c.get("challengeId").asText(),"code",secret,"password","RecoveredPass!123"),400);
        var next=call(post("/api/public/auth/recovery"),null,Map.of("identity",user),200);
        mongo.updateFirst(Query.query(Criteria.where("_id").is(next.get("challengeId").asText())),new Update().set("expiresAt",Instant.now().minusSeconds(1)),AccountSecurityService.Challenge.class);
        call(post("/api/public/auth/reset"),null,Map.of("challengeId",next.get("challengeId").asText(),"code",code(contact),"password","RecoveredPass!123"),400);
    }
    @Test void missingSmtpCannotClaimToSendAndSuccessfulQueueDeliveryClearsBody()throws Exception {
        var real=new MailDelivery("",587,"","","",false);
        assertThat(real.configured()).isFalse();assertThatThrownBy(real::requireConfigured).isInstanceOf(ApiException.class);
        doThrow(new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"Email delivery is not configured.")).when(delivery).requireConfigured();
        call(post("/api/public/auth/recovery"),null,Map.of("identity","anyone"),503);
        reset(delivery);when(delivery.configured()).thenReturn(true);
        var queue=new EmailQueue(mongo,delivery,true);
        String recipient=UUID.randomUUID()+"@example.test";
        queue.enqueue(recipient,"Verification","Test-only message",Instant.now().plusSeconds(600));
        queue.dispatch();
        verify(delivery).send(recipient,"Verification","Test-only message");
        assertThat(queued(recipient).status()).isEqualTo("Sent");assertThat(queued(recipient).body()).isEmpty();
    }
    @Test void smtpFailureIsRetriedAndExpiredMessagesAreNotSent() {
        var queue=new EmailQueue(mongo,delivery,true);String recipient=UUID.randomUUID()+"@example.test";
        doThrow(new IllegalStateException("Test-only delivery failure")).when(delivery).send(eq(recipient),anyString(),anyString());
        queue.enqueue(recipient,"Verification","Sensitive test-only code",Instant.now().plusSeconds(600));
        queue.dispatch();assertThat(queued(recipient).status()).isEqualTo("Retry");
        for(int i=0;i<4;i++) {
            mongo.updateFirst(Query.query(Criteria.where("recipient").is(recipient)),new Update().set("dueAt",Instant.now().minusSeconds(1)),EmailQueue.Email.class);
            queue.dispatch();
        }
        assertThat(queued(recipient).status()).isEqualTo("Failed");assertThat(queued(recipient).body()).isEmpty();
        String expired=UUID.randomUUID()+"@example.test";
        queue.enqueue(expired,"Verification","Expired code",Instant.now().minusSeconds(1));queue.dispatch();
        verify(delivery,never()).send(eq(expired),anyString(),anyString());assertThat(queued(expired).status()).isEqualTo("Expired");
    }
    @Test void repeatedLoginAttemptsAreThrottledAndDefaultInstallationHasNoSampleAccounts()throws Exception {
        String unknown="unknown_"+UUID.randomUUID();
        for(int i=0;i<12;i++)call(post("/api/public/auth/login"),null,Map.of("username",unknown,"password","incorrect"),401);
        call(post("/api/public/auth/login"),null,Map.of("username",unknown,"password","incorrect"),429);
        assertThat(mongo.exists(Query.query(Criteria.where("username").in("admin","recruiter")),PlatformService.Account.class)).isFalse();
    }
}
