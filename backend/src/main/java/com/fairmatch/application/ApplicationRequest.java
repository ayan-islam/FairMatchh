package com.fairmatch.application;

import jakarta.validation.constraints.*;

import java.util.List;

public record ApplicationRequest(
        @NotBlank @Size(max = 160) String name,
        @NotBlank @Size(max = 254) String contact,
        @NotBlank @Size(max = 160) String role,
        @NotBlank @Size(min = 25, max = 6000) String experience,
        @NotNull @Size(max = 500) String education,
        @NotEmpty @Size(max = 20) List<@NotBlank @Size(max = 160) String> skills,
        @NotBlank @Size(min = 30, max = 6000) String example,
        @NotBlank @Size(max = 100) String availability,
        @NotBlank @Size(max = 200) String location,
        @AssertTrue boolean consent,
        @AssertTrue boolean evidenceConfirmed,
        @AssertTrue boolean finalConsent
) {
}
