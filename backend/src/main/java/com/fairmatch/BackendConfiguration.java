package com.fairmatch;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
class BackendConfiguration {
  @Bean MongoTransactionManager transactions(MongoDatabaseFactory factory) { return new MongoTransactionManager(factory); }
  @Bean org.springframework.security.crypto.password.PasswordEncoder encoder() { return new BCryptPasswordEncoder(); }
  @Bean SecurityFilterChain security(HttpSecurity http,@Value("${fairmatch.auth.basic-enabled:false}") boolean basicEnabled) throws Exception {
    http.csrf(csrf -> csrf.disable())
      .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .authorizeHttpRequests(a -> a.requestMatchers("/api/public/**", "/actuator/health", "/error").permitAll()
        .requestMatchers("/api/employer/**").hasRole("EMPLOYER")
        .requestMatchers("/api/candidate/**").hasRole("CANDIDATE")
        .requestMatchers("/api/admin/**").hasRole("ADMIN")
        .requestMatchers("/api/account/**").authenticated().anyRequest().denyAll())
      .oauth2ResourceServer(o -> o.jwt(j -> {
        var converter=new org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter();
        var roles=new org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter();
        roles.setAuthoritiesClaimName("roles");roles.setAuthorityPrefix("ROLE_");
        converter.setJwtGrantedAuthoritiesConverter(roles);j.jwtAuthenticationConverter(converter);
      }))
      .httpBasic(b -> { if (!basicEnabled) b.disable(); });
    return http.build();
  }
  @Bean javax.crypto.SecretKey jwtKey(@Value("${fairmatch.jwt.key-file:../data/jwt.key}") String filename) throws java.io.IOException {
    var path=java.nio.file.Path.of(filename).toAbsolutePath();java.nio.file.Files.createDirectories(path.getParent());
    if(!java.nio.file.Files.exists(path)) {
      byte[] bytes=new byte[32];new java.security.SecureRandom().nextBytes(bytes);
      try { java.nio.file.Files.writeString(path,java.util.Base64.getEncoder().encodeToString(bytes),java.nio.file.StandardOpenOption.CREATE_NEW); }
      catch(java.nio.file.FileAlreadyExistsException ignored) { /* Another startup created it. */ }
    }
    return new javax.crypto.spec.SecretKeySpec(java.util.Base64.getDecoder().decode(java.nio.file.Files.readString(path).trim()),"HmacSHA256");
  }
  @Bean org.springframework.security.oauth2.jwt.JwtEncoder jwtEncoder(javax.crypto.SecretKey key) {
    return new org.springframework.security.oauth2.jwt.NimbusJwtEncoder(new com.nimbusds.jose.jwk.source.ImmutableSecret<>(key));
  }
  @Bean org.springframework.security.oauth2.jwt.JwtDecoder jwtDecoder(javax.crypto.SecretKey key,com.fairmatch.platform.AccountSecurityService sessions) {
    var decoder=org.springframework.security.oauth2.jwt.NimbusJwtDecoder.withSecretKey(key).macAlgorithm(org.springframework.security.oauth2.jose.jws.MacAlgorithm.HS256).build();
    decoder.setJwtValidator(new org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator<>(org.springframework.security.oauth2.jwt.JwtValidators.createDefaultWithIssuer("fairmatch-local"),sessions));return decoder;
  }
}
