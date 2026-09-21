package com.fairmatch.document;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class AiCvReviewServiceTest {
    @Test
    void acceptsOnlyEvidenceThatCanBeLocatedOnTheClaimedPage() throws Exception {
        var received = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/chat", exchange -> {
            received.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            var content = """
                {"summary":"Backend developer with a documented Java project.",
                 "skills":[
                   {"label":"Java","sourcePage":1,"evidence":"Built Java APIs with Spring Boot","confidence":0.96},
                   {"label":"Kubernetes","sourcePage":1,"evidence":"Managed Kubernetes clusters","confidence":0.91}],
                 "courses":[],"projects":[],"experience":[],"warnings":[]}
                """;
            var body = new ObjectMapper().writeValueAsBytes(java.util.Map.of("message", java.util.Map.of("content", content)));
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            var service = new AiCvReviewService(new ObjectMapper(), true,
                "http://127.0.0.1:" + server.getAddress().getPort(), "qwen3:4b-instruct", HttpClient.newHttpClient());
            var result = service.review(List.of(new DocumentController.SourcePage(1,
                "Projects\nBuilt Java APIs with Spring Boot\n", "embedded-text", false)));

            assertThat(result.status()).isEqualTo("Ready for candidate review");
            assertThat(result.review().skills()).extracting(AiCvReviewService.Evidence::label).containsExactly("Java");
            assertThat(result.review().summary()).isEqualTo("Skills: Java.");
            assertThat(result.review().warnings()).contains("One AI suggestion was omitted because its source quotation could not be verified.");
            assertThat(received.get()).contains("\"format\"").contains("Return JSON matching the supplied schema");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void disabledReviewNeverCallsOllama() {
        var service = new AiCvReviewService(new ObjectMapper(), false, "http://127.0.0.1:1",
            "qwen3:4b-instruct", HttpClient.newHttpClient());
        var result = service.review(List.of(new DocumentController.SourcePage(1, "Skills: Java", "embedded-text", false)));
        assertThat(result.review()).isNull();
        assertThat(result.status()).isEqualTo("Not configured");
    }
}
