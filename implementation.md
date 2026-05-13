Deadline Feature — Job Posting, OA Invite & Interview Invite
Overview
Add recruiter-specified expiry dates to three entities:

Job posting — applicationDeadline: once passed, the job auto-closes and disappears from the public listing.
OA (Assessment) invite — expiresAt: once passed, the candidate's invite card shows "Expired" and the link is blocked.
Interview invite — expiresAt: deadline to book a slot; once passed, the booking link is disabled on the candidate dashboard.
A Spring @Scheduled task in jobs-service runs every minute to auto-close PUBLISHED jobs whose applicationDeadline has elapsed.

Proposed Changes
Database
[NEW] V3__add_deadline_fields.sql
CREATE TABLE IF NOT EXISTS interview_invite — ensures the table exists (it's currently missing from migrations).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_deadline TIMESTAMP;
ALTER TABLE assessment_invite ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE interview_invite ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
Backend — jobs-service
[MODIFY] JobsServiceApplication.java
Add @EnableScheduling annotation to enable Spring's scheduling support.
[MODIFY] entity/Job.java
Add @Column(name = "application_deadline") private LocalDateTime applicationDeadline;
[MODIFY] entity/AssessmentInvite.java
Add @Column(name = "expires_at") private LocalDateTime expiresAt;
[MODIFY] entity/InterviewInvite.java
Add @Column(name = "expires_at") private LocalDateTime expiresAt;
[MODIFY] dto/CreateJobRequest.java
Add private LocalDateTime applicationDeadline;
[MODIFY] dto/UpdateJobRequest.java
Add private LocalDateTime applicationDeadline;
[MODIFY] dto/JobResponse.java
Add private LocalDateTime applicationDeadline;
[MODIFY] dto/SendAssessmentRequest.java
Add private LocalDateTime expiresAt; — recruiter picks the OA deadline datetime.
[MODIFY] dto/SendInterviewInviteRequest.java
Add private LocalDateTime expiresAt; — recruiter picks the interview booking deadline.
[MODIFY] dto/ReceivedAssessmentInviteResponse.java
Add private String expiresAt; — exposed to candidate dashboard.
[MODIFY] dto/ReceivedInterviewInviteResponse.java
Add private String expiresAt; — exposed to candidate dashboard.
[MODIFY] repository/JobRepository.java
Add: List<Job> findByStatusAndApplicationDeadlineBefore(JobStatus status, LocalDateTime deadline);
[MODIFY] repository/JobSpec.java
Extend withFilters(): when status == PUBLISHED, additionally filter out jobs where applicationDeadline IS NOT NULL AND applicationDeadline < NOW() — belt-and-suspenders in case scheduler hasn't run yet.
[MODIFY] service/JobService.java
createJob() — populate applicationDeadline from request.
updateJob() — update applicationDeadline if provided.
mapToResponse() — include applicationDeadline in the response.
[MODIFY] service/AssessmentInviteService.java
sendAssessmentToTopCandidates() — store request.getExpiresAt() on each AssessmentInvite.
getReceivedAssessments() (via controller) — include expiresAt in the mapped response.
[MODIFY] service/InterviewInviteService.java
sendInterviewInvites() — store request.getExpiresAt() on each InterviewInvite.
[MODIFY] controller/AssessmentInviteController.java
Map expiresAt field in the response.
[MODIFY] controller/InterviewInviteController.java
Map expiresAt field in the response.
[NEW] service/DeadlineSchedulerService.java
@Scheduled(fixedDelay = 60_000) — runs every 60 seconds.
Queries jobRepository.findByStatusAndApplicationDeadlineBefore(PUBLISHED, LocalDateTime.now()).
For each result: sets status = CLOSED, closedAt = now(), saves.
Logs each auto-close action.
Frontend — client
[MODIFY] lib/types.ts
Job — add applicationDeadline?: string;
CreateJobData — add applicationDeadline?: string;
SendAssessmentRequest — add expiresAt?: string;
SendInterviewInviteRequest — add expiresAt?: string;
ReceivedAssessmentInvite — add expiresAt?: string;
InterviewInvite — add expiresAt?: string;
[MODIFY] app/recruiter/jobs/[id]/page.tsx
OA invite panel: Add a datetime-local input for oaExpiresAt state. Pass it as expiresAt in the sendAssessmentInvites call.
Interview invite panel: Add a datetime-local input for interviewExpiresAt state. Pass it as expiresAt in the sendInterviewInvites call.
Job header: Show applicationDeadline badge if set (e.g. "Applications close: May 20, 2026 5:00 PM").
[MODIFY] app/recruiter/jobs/new/page.tsx
Add applicationDeadline datetime-local input to the job creation form. Wire it into createJob API call.
[MODIFY] lib/api.ts
jobsApi.createJob — forward applicationDeadline field.
rankingApi.sendAssessmentInvites — forward expiresAt field.
rankingApi.sendInterviewInvites — forward expiresAt field.
[MODIFY] app/dashboard/page.tsx (Candidate dashboard — OA & Interview invite sections)
For OA invites: check if expiresAt is set and < now → show "Expired" badge, disable the "Start Assessment" button.
For Interview invites: check if expiresAt is set and < now → show "Booking Closed" badge, disable the "Book Interview" button.
[MODIFY] components/JobCard.tsx (if it exists) / app/jobs/page.tsx
Display applicationDeadline on each job card if present (e.g. "Apply by May 20").
Verification Plan
Automated
docker compose up --build   # confirm jobs-service starts with V3 migration
Manual
Create a job with deadline → verify it appears in public listing.
Let deadline pass (or set to past) → scheduler closes it → verify it disappears from /jobs.
Send OA invites with an expiry → log in as candidate → verify expired invite shows "Expired" state.
Send interview invites with an expiry → verify expired invite shows "Booking Closed" state.



Deadline Feature — Task Tracker
Backend
 V3__add_deadline_fields.sql — DB migration
 @EnableScheduling on JobsServiceApplication
 Job.java — add applicationDeadline
 AssessmentInvite.java — add expiresAt
 InterviewInvite.java — add expiresAt
 CreateJobRequest.java — add applicationDeadline
 UpdateJobRequest.java — add applicationDeadline
 JobResponse.java — add applicationDeadline
 SendAssessmentRequest.java — add expiresAt
 SendInterviewInviteRequest.java — add expiresAt
 ReceivedAssessmentInviteResponse.java — add expiresAt
 ReceivedInterviewInviteResponse.java — add expiresAt
 JobRepository.java — add deadline query
 JobSpec.java — filter expired published jobs
 JobService.java — wire applicationDeadline
 AssessmentInviteService.java — wire expiresAt + map in response
 AssessmentInviteController.java — map expiresAt in response
 InterviewInviteService.java — wire expiresAt
 InterviewInviteController.java — map expiresAt in response
 DeadlineSchedulerService.java — NEW scheduler
Frontend
 lib/types.ts — add deadline fields
 lib/api.ts — forward deadline fields
 app/recruiter/jobs/[id]/page.tsx — OA + Interview deadline pickers, job deadline display
 app/recruiter/jobs/new/page.tsx — applicationDeadline picker
 Candidate dashboard — expired state for OA + interview invites
 Public jobs listing / JobCard — show applicationDeadline