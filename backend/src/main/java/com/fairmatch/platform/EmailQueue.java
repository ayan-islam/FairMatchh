package com.fairmatch.platform;

import java.time.Instant;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class EmailQueue {
    private final MongoTemplate mongo;private final MailDelivery delivery;private final boolean enabled;
    public EmailQueue(MongoTemplate mongo,MailDelivery delivery,@Value("${fairmatch.mail.dispatch:true}") boolean enabled){this.mongo=mongo;this.delivery=delivery;this.enabled=enabled;}
    @Document("email_outbox") record Email(@Id String id,String recipient,String subject,String body,String status,int attempts,Instant dueAt,Instant validUntil,@Indexed(expireAfter="0s") Instant purgeAt){}
    public boolean configured(){return delivery.configured();}
    public void enqueue(String recipient,String subject,String body,Instant validUntil){delivery.requireConfigured();insert(recipient,subject,body,validUntil);}
    /** Recruitment actions must still succeed when an installation has no SMTP account. */
    public boolean enqueueIfConfigured(String recipient,String subject,String body,Instant validUntil){
        if(!delivery.configured())return false;
        insert(recipient,subject,body,validUntil);return true;
    }
    private void insert(String recipient,String subject,String body,Instant validUntil){
        var now=Instant.now();
        if(recipient==null||!recipient.trim().matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")||recipient.length()>254)
            throw new IllegalArgumentException("A valid email recipient is required.");
        var safeSubject=subject==null?"":subject.replaceAll("[\\r\\n]+"," ").trim();
        if(safeSubject.isBlank()||safeSubject.length()>200||body==null||body.isBlank()||body.length()>12000||validUntil==null)
            throw new IllegalArgumentException("Email subject, body or delivery window is invalid.");
        mongo.insert(new Email(UUID.randomUUID().toString(),recipient.trim().toLowerCase(java.util.Locale.ROOT),safeSubject,body,"Pending",0,now,validUntil,validUntil.plusSeconds(86400)));
    }
    @Scheduled(fixedDelay=15000)
    public void dispatch(){
        if(!enabled||!delivery.configured())return;
        // A crash during the final attempt must not leave the item permanently in Retry.
        mongo.updateMulti(Query.query(Criteria.where("status").in("Pending","Retry").and("dueAt").lte(Instant.now()).and("attempts").gte(5)),new Update().set("status","Failed").set("body",""),Email.class);
        for(int count=0;count<10;count++) {
            var now=Instant.now();
            // A lease permits recovery after a worker restart and prevents normal concurrent delivery.
            var email=mongo.findAndModify(Query.query(Criteria.where("status").in("Pending","Retry").and("dueAt").lte(now).and("attempts").lt(5)),new Update().set("status","Retry").set("dueAt",now.plusSeconds(60)).inc("attempts",1),FindAndModifyOptions.options().returnNew(true),Email.class);
            if(email==null)return;
            if(email.validUntil().isBefore(now)){update(email.id(),"Expired",true);continue;}
            try {delivery.send(email.recipient(),email.subject(),email.body());update(email.id(),"Sent",true);}
            catch(RuntimeException exception){if(email.attempts()>=5)update(email.id(),"Failed",true);}
        }
    }
    private void update(String id,String status,boolean clearBody){var change=new Update().set("status",status);if(clearBody)change.set("body","");mongo.updateFirst(Query.query(Criteria.where("_id").is(id)),change,Email.class);}
}
