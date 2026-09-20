package com.fairmatch.application;

import jakarta.validation.constraints.*;

import java.util.List;

public record ApplicationRequest(
        @NotBlank(message = "Name is required.") @Size(max = 160, message = "Name must be at most 160 characters.") String name,
        @NotBlank(message = "Contact information is required.") @Size(max = 254, message = "Contact information must be at most 254 characters.") String contact,
        @NotBlank(message = "Current or recent position is required.") @Size(max = 160, message = "Position must be at most 160 characters.") String role,
        @NotBlank(message = "Work experience is required.") @Size(min = 25, max = 6000, message = "Work experience must contain 25–6000 characters.") String experience,
        @NotNull @Size(max = 500, message = "Education must be at most 500 characters.") String education,
        @NotEmpty(message = "Add at least one relevant skill.") @Size(max = 20, message = "Add no more than 20 skills.") List<@NotBlank(message = "Remove empty skills.") @Size(max = 160, message = "Each skill must be at most 160 characters.") String> skills,
        @NotBlank(message = "A specific work example is required.") @Size(min = 30, max = 6000, message = "The work example must contain 30–6000 characters.") String example,
        @NotBlank(message = "Availability is required.") @Size(max = 100, message = "Availability must be at most 100 characters.") String availability,
        @NotBlank(message = "Work location or arrangements are required.") @Size(max = 200, message = "Work location or arrangements must be at most 200 characters.") String location,
        @AssertTrue(message = "Confirm that the application may be shared with the employer.") boolean consent,
        @AssertTrue(message = "Confirm that you reviewed your experience and skill claims.") boolean evidenceConfirmed,
        @AssertTrue(message = "Confirm that the application is accurate and ready to submit.") boolean finalConsent,
        boolean shareCvSummary
) {
}
