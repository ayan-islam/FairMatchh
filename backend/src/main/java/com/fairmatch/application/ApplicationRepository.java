package com.fairmatch.application;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

interface ApplicationRepository extends MongoRepository<ApplicationDocument, String> {
    List<ApplicationDocument> findByOwnerIdOrderByAppliedAtDesc(String ownerId);
    java.util.Optional<ApplicationDocument> findByIdAndOwnerId(String id,String ownerId);
    java.util.Optional<ApplicationDocument> findByIdAndOrganizationId(String id, String organizationId);
    List<ApplicationDocument> findByOrganizationIdOrderByAppliedAtDesc(String organizationId);

    boolean existsByJobIdAndNormalizedContact(String jobId, String normalizedContact);
}
