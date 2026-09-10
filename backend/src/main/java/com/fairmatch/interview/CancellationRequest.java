package com.fairmatch.interview;
import jakarta.validation.constraints.*;

public record CancellationRequest(@NotBlank @Size(min=15,max=2000) String reason,
    @NotNull @PositiveOrZero Long expectedVersion) {}
