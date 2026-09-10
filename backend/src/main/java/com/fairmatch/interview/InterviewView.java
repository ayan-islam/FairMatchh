package com.fairmatch.interview;
import java.time.*;
import java.util.List;

public record InterviewView(String id, String candidateId, String jobId, LocalDate date, String time,
    String format, String location, String status, boolean completed, List<Integer> scores,
    String notes, String cancellationReason, Instant updatedAt, Long version) {}
