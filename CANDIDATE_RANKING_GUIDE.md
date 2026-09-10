# Candidate ranking: operation and code guide

Open Employer > Candidate ranking. This is a comparison of human-reviewed evidence for one job and one hiring stage. CV extraction does not assign ratings. No score changes a hiring stage, rejects an applicant or sends an offer.

## 1. Set up a job and rubric

1. Create a job with clear, job-related requirements and save it as a draft.
2. In Jobs, click Ranking setup for that job, or select it in Candidate ranking.
3. Click Configure scoring rubric. Each job requirement is a separate scoring criterion.
4. Set integer weights from 1 to 100, totaling exactly 100%. For four suitable criteria, 40/30/20/10 is an example, not a validated default for every job.
5. Edit the five rating descriptions for each criterion. Define concrete evidence for 0, 1, 2, 3 and 4. Starter text is only a template; adapt it to the actual work.
6. If a criterion is essential, mark it and explain why it is necessary for the job. A rating below 3 or missing assessment is visibly flagged for clarification; this does not automatically reject the applicant.
7. Explain your rubric or change in at least 20 characters, confirm that it is job-related and consistently applied, and save.
8. Return to Jobs > Draft > Edit to publish when ready. Rubric setup works before applications arrive. Publishing existing jobs is not blocked merely because a rubric has not been configured, but those jobs cannot produce a ranking until a current rubric exists.

Avoid weights or scoring criteria based on names, photos, age, gender, religion, disability, home district, university prestige, CV decoration or repeated keywords. Relevant projects can demonstrate competencies for freshers. Human confirmation of a rubric does not prove that it is fair or predictive; review its suitability and reviewer agreement before relying on it.

## 2. Assess candidates

1. Select a job and hiring stage. New, Shortlisted and Interview are separate comparisons. Scores are never mixed across jobs or stages.
2. Open Assess candidate in the Assessment queue.
3. Read the rating definitions. Choose Not assessed for missing, unclear or unreviewed evidence. Choose 0 only after assessment establishes that the competency was not demonstrated.
4. For every positive rating, select a source and copy an exact quote. Sources include submitted work experience, education, skills, the work example and the latest 20 candidate clarification replies.
5. Explain each assigned rating in at least 15 characters. A quote proves where text came from, not whether it supports the rating or is true; the reviewer is responsible for that assessment.
6. Confirm your assessment and save. You may save an incomplete assessment. It remains in the queue without a numerical total or rank.
7. For missing information, open Applications > Supporting information and request clarification. A candidate can reply from their application. New replies invalidate that application's old score and become selectable sources for reassessment.

The current ranking uses submitted and clarified application evidence. It does not automatically import interview scores, run coding tests or create AI judgments. If candidates progress to another stage, conduct a consistent assessment there; the system asks for a current-stage review instead of silently reusing the old score.

## 3. Read the result

Java calculates score = sum(rating / 4 * weight). With weights 40, 30, 20 and 10 and ratings 4, 3, 3 and 2, the result is 82.50 / 100. This is a rubric score, not a probability of future performance.

- Completed assessments are ordered by descending score within the selected job and stage.
- Equal scores share a competition rank, for example 1, 1, 3. An internal application-reference order stabilizes the display within ties; it does not assign different ranks.
- Incomplete, unassessed and stale reviews appear separately. Missing values are not converted to zero and the remaining criteria are not reweighted.
- Essential criteria below the expected level are shown explicitly for recruiter clarification. The overall score does not hide them.
- Withdrawn and Not selected applications are outside active ranking. Changing an application's stage does not happen through this feature.
- Why this result? shows the rating, weight, points, source quote, reason, reviewer, time and versions.
- Export this comparison downloads a CSV of the selected job and stage, including completeness and essential-requirement flags.

## 4. Edits, refresh and history

Every rubric save creates a new version and invalidates earlier scores for every candidate on that job. Changing the job title, academic department, description or requirements invalidates the rubric. Even changing requirements and then restoring the old wording does not reactivate old scores.

A stage change, evidence change or new candidate clarification also invalidates the relevant assessment. A changed record stays out of the numbered comparison until reassessed. The old decisions remain in history. Salary/deadline edits alone do not invalidate competency scoring.

If a save reports a conflict, use Reload and discard edits, inspect the latest record and assess it again. Two concurrent saves using the same review version cannot both overwrite the record. The backend does not accept a score calculated by the browser; it recalculates from validated ratings and weights.

## 5. Backend structure

- application/RankingController.java: rubric endpoints, validation, ownership, snapshots, weighted scoring, board construction, history and transaction handling.
- job/JobService.java: publishes a criteria-change event for relevant job edits; the ranking listener invalidates the rubric and records history.
- application/ApplicationService.java: explicit hiring-stage actions remain separate. Candidate replies are serialized with concurrent ranking saves.
- common/ApiErrors.java: concurrent database conflicts return a recoverable response; uncertain database outcomes ask the user to refresh before retrying.
- application.properties: fractional JSON values cannot silently become integer ratings or weights.

MongoDB collections: ranking_rubrics, ranking_rubric_history, ranking_reviews and ranking_review_history. Each review is identified by application and stage. It stores rubric version, source snapshot, entered items, completion, score units, reviewer and timestamp. scoreUnits stores sum(rating * weight); dividing by four gives exact quarter-point totals.

Job and application document writes serialize rubric/review saves with related updates. Snapshot hashes bind assessments to relevant job criteria, rubric version, application stage and available evidence. Read transactions provide a consistent board snapshot. Business changes, saved review history and audit events commit together. Rankings, rubrics and histories persist in the existing local MongoDB data folder.

API prefix: /api/employer/jobs/{jobId}/ranking

- GET: board; optional stage query (default New).
- PUT /rubric: save current-job rubric using snapshot and expectedVersion.
- GET /applications/{id}: current rubric, evidence, prior review and history.
- POST /applications/{id}: save reviewed ratings with snapshot, expectedVersion, items and confirmed=true.

Endpoints require the employer role and ownership of both job and application. Response projections omit account names and contact fields. Free-text candidate evidence can still contain identifying details; this is not guaranteed anonymization. Reviewer notes and ranking history are internal employer records, not public candidate profiles.

## 6. Frontend structure

frontend/src/components/fairmatch/candidate-ranking.tsx contains CandidateRanking (job/stage selection and board), RubricEditor (weights/anchors), RankingReview (quotes/ratings) and RankingRows (explanations). recruiter-workspace.tsx adds navigation and job-row shortcuts. platform.css provides responsive panels and scrolling dialogs with persistent action buttons.

The existing Supported / Partial / Needs evidence review is retained as a separate evidence-band summary. It is not silently converted into numerical ratings. Recruiters must explicitly assess the new rubric.

## 7. Explain it to your teacher

“FairMatch ranks completed human assessments against a job-specific weighted rubric. Every positive rating cites submitted evidence, and the backend calculates the total. Missing evidence stays unranked, equal scores share a rank, and changes invalidate stale comparisons. The recruiter can inspect every contribution to the score and makes the hiring decision separately.”

Tests are in backend/src/test/java/com/fairmatch/RankingTest.java. They cover the worked calculation, ties, null versus zero, essential flags, unchanged stages, invalid inputs, access control, rubric invalidation, stage changes, clarification evidence and simultaneous saves. Test fixtures use separate databases rather than assigning ratings to real applications.

## 8. Verified operation

On September 10, the full 46-test backend suite passed. The seven ranking tests passed again after final input-validation fixes. Frontend lint, TypeScript and the production build passed.

Browser verification created a rubric and two assessments in an isolated database: one completed 75/100 result and one incomplete assessment with no rank. Their quotes, reasons, rubric and histories survived browser reload and a packaged Spring Boot restart. Desktop and 390px mobile dialogs kept their action buttons visible and content internally scrollable. See logs/ranking-ui-result.json. No ratings were assigned to your real applicants during these checks.
