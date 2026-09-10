package com.fairmatch.audit;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
public class AuditService {
  private final MongoTemplate mongo;
  public AuditService(MongoTemplate mongo) { this.mongo=mongo; }
  public void record(String organizationId,String action,String reference) {
    record(organizationId,action,reference,null,null);
  }
  public void record(String organizationId,String action,String reference,String detail,String actor) {
    mongo.insert(new Entry(UUID.randomUUID().toString(),organizationId,action,reference,Instant.now(),detail,actor));
  }
  public List<Entry> list(String organizationId) { return mongo.find(Query.query(Criteria.where("organizationId").is(organizationId)).with(Sort.by(Sort.Direction.DESC,"at")).limit(100),Entry.class); }
  @Document("audit_events") public record Entry(@Id String id,String organizationId,String action,String reference,Instant at,String detail,String actor) {}
}
