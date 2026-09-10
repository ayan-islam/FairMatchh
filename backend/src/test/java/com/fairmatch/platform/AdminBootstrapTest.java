package com.fairmatch.platform;

import com.fairmatch.audit.AuditService;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdminBootstrapTest {
    MongoTemplate mongo=mock(MongoTemplate.class);
    AuditService audit=mock(AuditService.class);
    ValidatorFactory validators=Validation.buildDefaultValidatorFactory();
    BCryptPasswordEncoder passwords=new BCryptPasswordEncoder();
    @AfterEach void close(){validators.close();}
    AdminBootstrap setup(String password){return new AdminBootstrap(mongo,passwords,audit,validators.getValidator(),"owner","owner@example.test","Platform owner",password);}
    @Test void rejectsIncompleteConfigurationBeforeCreatingAnything(){
        assertThatThrownBy(()->setup("").create()).isInstanceOf(IllegalStateException.class);
        verify(mongo,never()).insert(any(PlatformService.Account.class));
    }
    @Test void existingAdministratorIsNeverReset(){
        when(mongo.exists(any(Query.class),eq(PlatformService.Account.class))).thenReturn(true);
        setup("NewPassword!123").create();
        verify(mongo,never()).insert(any(PlatformService.Account.class));verifyNoInteractions(audit);
    }
    @Test void existingCandidateIsNeverPromoted(){
        when(mongo.exists(any(Query.class),eq(PlatformService.Account.class))).thenReturn(false,true);
        assertThatThrownBy(()->setup("NewPassword!123").create()).isInstanceOf(IllegalStateException.class);
        verify(mongo,never()).insert(any(PlatformService.Account.class));
    }
    @Test void firstOwnerGetsHashedCredentialsAndAudit(){
        when(mongo.insert(any(PlatformService.Account.class))).thenAnswer(invocation->invocation.getArgument(0));
        setup("NewPassword!123").create();
        var saved=org.mockito.ArgumentCaptor.forClass(PlatformService.Account.class);
        verify(mongo).insert(saved.capture());
        assertThat(saved.getValue().role()).isEqualTo("ADMIN");
        assertThat(passwords.matches("NewPassword!123",saved.getValue().passwordHash())).isTrue();
        verify(audit).record(eq("platform"),eq("ADMIN_INITIALIZED"),eq(saved.getValue().id()),anyString(),eq("owner"));
    }
}
