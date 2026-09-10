package com.fairmatch.interview;
import java.time.*;
import jakarta.validation.constraints.*;

public record InterviewRequest(@NotBlank @Size(max=100) String candidateId,
    @NotNull LocalDate date, @NotNull LocalTime time,
    @NotBlank @Pattern(regexp="Video interview|On-site interview|Phone interview") String format,
    @NotBlank @Size(max=500) String location, @PositiveOrZero Long expectedVersion) {}
