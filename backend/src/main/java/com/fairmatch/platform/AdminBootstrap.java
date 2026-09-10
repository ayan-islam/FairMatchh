package com.fairmatch.platform;

import com.fairmatch.audit.AuditService;
import jakarta.annotation.PostConstruct;
import jakarta.validation.Validator;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Explicit first-install setup, disabled by default. Never resets an existing administrator. */
@Component
@ConditionalOnProperty(name="fairmatch.bootstrap.admin-enabled",havingValue="true")
class AdminBootstrap {
    private final MongoTemplate mongo; private final PasswordEncoder passwords;
    private final AuditService audit; private final Validator validator; private final Input input;
    record Input(@Pattern(regexp="[a-zA-Z0-9_.-]{3,60}") String username,
        @NotBlank @Email @Size(max=160) String contact,@NotBlank @Size(max=160) String name,
        @NotBlank @Size(min=10,max=72) String password) {}
    AdminBootstrap(MongoTemplate mongo,PasswordEncoder passwords,AuditService audit,Validator validator,
        @Value("${fairmatch.bootstrap.admin-username:}") String username,
        @Value("${fairmatch.bootstrap.admin-email:}") String email,
        @Value("${fairmatch.bootstrap.admin-name:}") String name,
        @Value("${fairmatch.bootstrap.admin-password:}") String password) {
        this.mongo=mongo;this.passwords=passwords;this.audit=audit;this.validator=validator;
        this.input=new Input(username.trim().toLowerCase(Locale.ROOT),email.trim().toLowerCase(Locale.ROOT),name.trim(),password);
    }
    @PostConstruct void create() {
        if(mongo.exists(Query.query(Criteria.where("role").is("ADMIN")),PlatformService.Account.class))return;
        if(!validator.validate(input).isEmpty()||input.password().getBytes(StandardCharsets.UTF_8).length>72)
            throw new IllegalStateException("First-admin configuration is incomplete or invalid. Supply a username, real email, name and password of 10 characters to 72 UTF-8 bytes.");
        if(mongo.exists(Query.query(new Criteria().orOperator(Criteria.where("username").is(input.username()),Criteria.where("contact").is(input.contact()))),PlatformService.Account.class))
            throw new IllegalStateException("First-admin username or email is already registered. Existing accounts are never promoted by bootstrap.");
        var account=mongo.insert(new PlatformService.Account(UUID.randomUUID().toString(),input.username(),input.contact(),input.name(),"ADMIN",null,passwords.encode(input.password()),Instant.now()));
        audit.record("platform","ADMIN_INITIALIZED",account.id(),"Owner-configured first administrator",account.username());
    }
}
