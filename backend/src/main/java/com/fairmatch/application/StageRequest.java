package com.fairmatch.application;

import jakarta.validation.constraints.*;

public record StageRequest(
        @NotNull @Pattern(regexp = "New|Shortlisted|Interview|Offer|Hired|Not selected") String stage,
        @NotNull @Pattern(regexp = "New|Shortlisted|Interview|Offer|Hired|Not selected|Withdrawn") String expectedStage,
        @NotBlank @Size(min = 15, max = 2000) String reason
) {
}
