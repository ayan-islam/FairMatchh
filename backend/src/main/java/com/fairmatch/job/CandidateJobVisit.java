package com.fairmatch.job;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("candidate_job_visits")
record CandidateJobVisit(
    @Id String id,
    @Indexed String ownerId,
    @Indexed String jobId,
    Instant firstVisitedAt,
    Instant lastVisitedAt
) {}
