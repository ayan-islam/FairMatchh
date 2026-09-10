package com.fairmatch.interview;
import java.util.*;
import org.springframework.data.mongodb.repository.MongoRepository;

interface InterviewRepository extends MongoRepository<InterviewDocument,String> {
    List<InterviewDocument> findByCandidateIdInOrderByDateAscTimeAsc(List<String> ids);
    List<InterviewDocument> findByOrganizationIdOrderByDateAscTimeAsc(String organizationId);
    Optional<InterviewDocument> findByIdAndOrganizationId(String id, String organizationId);
}
