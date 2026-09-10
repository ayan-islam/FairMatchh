package com.fairmatch.application;

import java.time.Instant;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.CompoundIndex;

@Document("applications")
@CompoundIndex(name = "one_contact_per_job", def = "{'jobId':1,'normalizedContact':1}", unique = true)
@CompoundIndex(name = "organization_applied", def = "{'organizationId':1,'appliedAt':-1}")
record ApplicationDocument(@Id String id, String organizationId, String jobId, String name, String normalizedContact,
                           String role, String experience, String education, List<String> skills, String example,
                           String availability, String location, String stage, String band, String consentVersion,
                           Instant appliedAt, String stageReason, Instant stageChangedAt, String ownerId) {
}
