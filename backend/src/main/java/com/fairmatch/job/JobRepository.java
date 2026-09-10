package com.fairmatch.job;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

interface JobRepository extends MongoRepository<JobDocument,String> {
  List<JobDocument> findByOrganizationIdOrderByCreatedAtDesc(String organizationId);
  List<JobDocument> findByStatusOrderByCreatedAtDesc(String status);
  Optional<JobDocument> findByIdAndOrganizationId(String id,String organizationId);
}
