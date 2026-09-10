# Reviewing each job requirement

In Employer > Applications, open a candidate's evidence and choose **Review evidence**. The connected screen now reviews each published requirement individually.

For each requirement, select Supported, Partial or Needs evidence. Supported and Partial require an exact quote from the candidate's submitted work experience, education, skills or work example. Copy the quote from the displayed source and explain the assessment. Needs evidence can explicitly record that no supporting passage was found. Confirm that you reviewed all requirements, then save.

## What Java calculates

- All requirements marked Supported: **Strong evidence**.
- At least one Supported or Partial, with some requirements not fully supported: **Consider**.
- Every requirement marked Needs evidence: **Needs review**.

This is an explicit summary of human assessments, not automatic skill inference, candidate ranking, certificate verification or a hiring outcome. It treats requirements equally. It does not determine whether a quote actually proves a qualification; that remains the reviewer's responsibility. Hiring stage changes still require a separate action and reason.

## What gets saved

The backend checks organization ownership and all request fields. It rejects missing/duplicate criteria, invented quotes, missing reasoning and unconfirmed requests. It calculates the band itself; the browser cannot submit its own calculated result.

The record includes the requirements, exact source field/quote, reasoning, counts, band, reviewer, time and version. A SHA-256 snapshot identifies the submitted evidence and current requirements. A stale request receives a conflict if the criteria, review version or evidence band changed.

`criteria_reviews` holds the latest record; `criteria_review_history` preserves earlier versions. Saving the structured review, its history, the evidence band and audit entries uses one MongoDB transaction. These records survive reload and backend restart.

When an employer edits the job's requirements, a synchronous `JobService.CriteriaChanged` event invalidates existing structured summaries in the same transaction. Their application bands return to Needs review; their hiring stages do not change. The review screen keeps the historical record and asks for a review against the new requirements. Editing salary or location alone does not invalidate this criteria/evidence snapshot.

## Code map

- `frontend/src/components/fairmatch/criteria-review.tsx`: source display, per-requirement form, confirmation and save/error states. The unsaved preview uses the same visible band rule; Java is authoritative.
- `backend/src/main/java/com/fairmatch/application/CriteriaReviewController.java`: authenticated reads, source validation, deterministic summary, stale-write checks, history and invalidation event handler.
- `backend/src/main/java/com/fairmatch/job/JobService.java`: publishes the criteria-change event after changing requirements.
- `ApplicationService.review`: updates the application's evidence band and records its audit entry, leaving the stage unchanged.
- `CriteriaReviewTest.java`: exercises all three summaries, exact source validation, access boundaries, stale versions and criteria-change invalidation.

The old general evidence-review API remains for compatibility. The active employer UI uses the structured requirement-review endpoint. Candidate privacy exports do not expose internal reviewer reasoning or scores.

## Demonstrate it to your teacher

1. Publish a job with two clear requirements and apply using a candidate account.
2. Open Review evidence. Quote a relevant submitted passage for each requirement, explain the assessment, confirm and save.
3. Show the calculated evidence band and the unchanged hiring stage.
4. Refresh and reopen the review to show saved quotes, reasons, reviewer and version.
5. Edit one job requirement. Refresh Applications: the band returns to Needs review. Reopen the review to show why it is stale.

More sophisticated eligibility rules, weighting, detailed matching and demographic fairness analysis are still pending. Do not present this simple, transparent summary as a validated predictive hiring model.
