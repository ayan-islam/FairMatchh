package com.fairmatch.common;

import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Internal authenticated adapter. Browser authorization is enforced before calling this component. */
@Component
public class PrivateBusinessFiles {
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    public byte[] request(String id,String method,byte[] body) {
        try {
            var config=new Properties();try(var reader=Files.newBufferedReader(Path.of("../data/document-worker.properties"))){config.load(reader);}
            var response=http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:8090/business-documents/"+UUID.fromString(id)))
                .timeout(Duration.ofSeconds(35)).header("X-Worker-Key",config.getProperty("key"))
                .method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofByteArray(body)).build(),HttpResponse.BodyHandlers.ofByteArray());
            if(response.statusCode()==507)throw new ApiException(HttpStatus.INSUFFICIENT_STORAGE,"Document storage is full. Free space before uploading again.");
            if(response.statusCode()==422||response.statusCode()==413)throw new ApiException(HttpStatus.BAD_REQUEST,"Use an unencrypted PDF of at most 8 MB and ten pages.");
            if(response.statusCode()>=400)throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"Private document storage is unavailable. Start FairMatch and try again.");
            return response.body();
        }catch(ApiException e){throw e;}catch(InterruptedException e){Thread.currentThread().interrupt();throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"Document request interrupted.");}
        catch(Exception e){throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"Private document storage is unavailable. Start FairMatch and try again.");}
    }
}
