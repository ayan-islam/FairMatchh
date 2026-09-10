package com.fairmatch.interview;
import java.util.List;
import jakarta.validation.constraints.*;

public record EvaluationRequest(@NotNull @Size(min=4,max=4) List<@NotNull @Min(1) @Max(5) Integer> scores,
    @NotBlank @Size(min=15,max=5000) String notes, @NotNull @PositiveOrZero Long expectedVersion) {}
