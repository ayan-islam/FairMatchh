package com.fairmatch.job;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;

public record JobRequest(
  @NotBlank @Size(max=160) String title,
  @NotNull @Size(max=120) String department,
  @NotNull @Size(max=160) String location,
  @NotNull @Pattern(regexp="On-site|Hybrid|Remote") String workplace,
  @NotNull @Size(max=120) String salary,
  @NotNull @Size(max=6000) String description,
  @NotNull @Size(max=20) List<@NotBlank @Size(max=240) String> requirements,
  @NotNull @Pattern(regexp="Active|Draft|Closed") String status,
  @NotNull LocalDate closes,
  boolean noFeeConfirmed
) {}
