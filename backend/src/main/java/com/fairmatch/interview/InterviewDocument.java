package com.fairmatch.interview;

import java.time.*;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("interviews")
@CompoundIndex(name="organization_schedule", def="{'organizationId':1,'date':1,'time':1}")
@CompoundIndex(name="one_candidate_slot", def="{'organizationId':1,'candidateId':1,'date':1,'time':1}", unique=true, partialFilter="{'status':'Scheduled'}")
record InterviewDocument(@Id String id, String organizationId, String candidateId, String jobId,
    LocalDate date, LocalTime time, String format, String location, String status,
    List<Integer> scores, String notes, String cancellationReason, Instant createdAt,
    Instant updatedAt, String updatedBy, @Version Long version) {
    InterviewView view() {
        return new InterviewView(id, candidateId, jobId, date, time.toString(), format, location,
            status, status.equals("Completed"), scores, notes, cancellationReason, updatedAt, version);
    }
}
