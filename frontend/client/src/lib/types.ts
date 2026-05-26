export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "CANDIDATE" | "RECRUITER" | "ORG_ADMIN" | "ADMIN";
  orgId?: string;
  profileId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  role: "CANDIDATE" | "RECRUITER" | "ORG_ADMIN" | "ADMIN";
  orgId?: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: "CANDIDATE" | "RECRUITER";
}

export interface Profile {
  id: string;
  authUserId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  bio?: string;
  cvUrl?: string;
  role?: string;
  orgId?: string;
  yearsOfExperience?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Experience {
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: string;
}

export interface Education {
  institution: string;
  degree: string;
  field?: string;
  startDate: string;
  endDate?: string;
  gpa?: string;
}

export interface Job {
  id: string;
  orgId?: string;
  recruiterId?: string;
  createdBy?: string;
  organizationName?: string;
  title: string;
  description: string;
  requirements: string;
  location: string;
  employmentType:
    | "FULL_TIME"
    | "PART_TIME"
    | "CONTRACT"
    | "INTERNSHIP"
    | "REMOTE";
  experienceLevel: "ENTRY" | "MID" | "SENIOR" | "LEAD" | "EXECUTIVE";
  skills: string[];
  scoringWeights?: ScoringWeights;
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
  applicationCount?: number;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  closedAt?: string;
  assignedTo?: string;
  applicationDeadline?: string;
}

export interface ScoringWeights {
  skillsMatch: number;
  experienceMatch: number;
  educationMatch: number;
  overallFit: number;
}

export interface CreateJobData {
  title: string;
  description: string;
  requirements: string;
  location: string;
  employmentType: string;
  experienceLevel: string;
  skills: string[];
  scoringWeights?: ScoringWeights;
  applicationDeadline?: string;
}

export interface JobListResponse {
  content: Job[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface JobListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  location?: string;
  employmentType?: string;
  experienceLevel?: string;
  status?: string;
}

export interface Application {
  id: string;
  jobId: string;
  candidateAuthUserId?: string;
  job?: Job;
  candidateName: string;
  candidateEmail: string;
  contactPhone?: string;
  coverLetter?: string;
  portfolioLinks?: string[];
  originalFilename?: string;
  candidateProfileSnapshot?: Record<string, unknown>;
  status:
    | "APPLIED"
    | "SCREENED"
    | "OA_INVITED"
    | "OA_COMPLETED"
    | "INTERVIEW_INVITED"
    | "INTERVIEW_SCHEDULED"
    | "INTERVIEW_COMPLETED"
    | "OFFERED"
    | "OFFER_SENT"
    | "OFFER_ACCEPTED"
    | "OFFER_DECLINED"
    | "REJECTED"
    | "WITHDRAWN";
  compositeScore?: number;
  oaScore?: number;
  interviewScore?: number;
  finalRankingScore?: number;
  rankingPosition?: number;
  finalRank?: number;
  isWaitlisted?: boolean;
  rejectionReason?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProfileSnapshot {
  skills: string[];
  experience: Experience[];
  education: Education[];
  headline?: string;
  summary?: string;
}

export interface ScoreBreakdown {
  skillsMatch: number;
  experienceMatch: number;
  educationMatch: number;
  overallFit: number;
  totalScore: number;
}

export interface ApplicationListResponse {
  content: Application[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  last: boolean;
}

export interface ApplicationListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface Assessment {
  id: string;
  jobId: string;
  title: string;
  description?: string;
  timeLimitMinutes: number;
  questions: AssessmentQuestion[];
  accessToken: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssessmentQuestion {
  id: string;
  text: string;
  type: "MCQ" | "SHORT_ANSWER" | "CODE";
  options?: string[];
  correct_answer?: string;
  max_score: number;
}

export interface AssessmentAnswer {
  questionId: string;
  answer: string;
}

export interface AssessmentSubmission {
  id: string;
  assessmentId: string;
  candidateId?: string;
  score?: number;
  status: "IN_PROGRESS" | "SUBMITTED" | "SCORED";
  scoringDetails?: ScoreDetail[];
  answers?: AssessmentAnswer[];
  startedAt?: string;
  submittedAt?: string;
  scoredAt?: string;
}

export interface ScoreDetail {
  questionId: string;
  questionType: string;
  score: number;
  maxScore: number;
  rationale: string;
}

export interface CreateAssessmentData {
  jobId: string;
  title: string;
  description?: string;
  timeLimitMinutes?: number;
  questions: Omit<AssessmentQuestion, "id">[];
}

export interface RankingStatus {
  id: string;
  jobId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  progress?: number;
  results?: RankingResult[];
  completedAt?: string;
  error?: string;
}

export interface RankingResult {
  applicationId: string;
  candidateName: string;
  score: number;
  rank: number;
  scoreBreakdown: ScoreBreakdown;
}

export interface SendAssessmentRequest {
  assessmentToken: string;
  assessmentTitle: string;
  timeLimitMinutes?: number;
  topN?: number;
  /** ISO datetime string — deadline for candidate to complete the OA. */
  expiresAt?: string;
}

export interface SendAssessmentResponse {
  sent: number;
  skipped: number;
  sentTo: string[];
  skippedReasons: string[];
}

export interface ReceivedAssessmentInvite {
  id: string;
  jobId: string;
  jobTitle: string;
  organizationName?: string;
  assessmentToken: string;
  assessmentTitle?: string;
  timeLimitMinutes?: number;
  sentAt: string;
  /** ISO datetime string — when this invite expires (null = no deadline). */
  expiresAt?: string;
}

export interface InterviewInvite {
  id: string;
  jobId: string;
  jobTitle: string;
  organizationName?: string;
  oaScore?: number;
  schedulingUrl?: string;
  sentAt: string;
  /** ISO datetime string — deadline to book the interview slot. */
  expiresAt?: string;
}

export interface SendInterviewInviteRequest {
  assessmentId: string;
  topN?: number;
  minScore?: number;
  /** ISO datetime string — deadline for candidate to book an interview slot. */
  expiresAt?: string;
}

export interface SendInterviewInviteResponse {
  sent: number;
  skipped: number;
  sentTo: string[];
  skippedReasons: string[];
}

export interface InterviewSlot {
  id: string;
  jobId: string;
  recruiterAuthUserId: string;
  startTime: string;
  endTime: string;
  status: "AVAILABLE" | "BOOKED";
  createdAt: string;
}

export interface InterviewBooking {
  id: string;
  slotId: string;
  applicationId: string;
  candidateAuthUserId: string;
  meetingLink?: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  feedback?: string;
  rating?: number;
  technical?: number;
  problemSolving?: number;
  communication?: number;
  behavioral?: number;
  cultureFit?: number;
  recruiterSummary?: string;
  strengths?: string;
  weaknesses?: string;
  hireRecommendation?: string;
  finalScore?: number;
  createdAt: string;
}

export interface SubmitInterviewFeedbackRequest {
  rating: number;
  feedback: string;
  technical?: number;
  problemSolving?: number;
  communication?: number;
  behavioral?: number;
  cultureFit?: number;
  recruiterSummary?: string;
  strengths?: string;
  weaknesses?: string;
  hireRecommendation?: string;
}

export interface CandidateBookingResponse {
  id: string;
  jobId: string;
  jobTitle: string;
  startTime: string;
  endTime: string;
  meetingLink?: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
}

export interface CreateInterviewSlotsRequest {
  slots: {
    startTime: string;
    endTime: string;
  }[];
}

export interface BookInterviewRequest {
  slotId: string;
}

export type ContactMessageStatus =
  | "PENDING_APPROVAL"
  | "PENDING_RESPONSE"
  | "APPROVED"
  | "REJECTED";

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  hrAdminName?: string;
  companyDetails?: string;
  status: ContactMessageStatus;
  inquiryMessage?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  approvedAt?: string;
  approvedOrganizationId?: string;
  createdAt: string;
}

export interface VerificationDocument {
  id: string;
  filename: string;
  contentType: string;
  fileSize: number | null;
  uploadedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  organizationPolicies?: string;
  createdAt: string;
  isSuspended: boolean;
}

export interface CreateOrganizationRequest {
  name: string;
  organizationPolicies?: string;
}

export interface CreateOrgAdminRequest {
  email: string;
  orgId: string;
}

export interface RecruiterUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "RECRUITER";
  orgId: string;
  isSuspended: boolean;
  createdAt: string;
}

export interface InviteTokenResponse {
  token: string;
  email: string;
  role: "ORG_ADMIN" | "RECRUITER";
  orgId: string;
  firstName?: string;
  lastName?: string;
  expiresAt: string;
}

export interface AcceptInviteRequest {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface SendOfferRequest {
  offerMessage: string;
  salary?: string;
  startDate?: string; // YYYY-MM-DD
}

export interface DeclineOfferRequest {
  reason?: string;
}

export interface RejectRequest {
  reason?: string;
  applicationIds?: string[];
}

export interface RejectResponse {
  rejectedCount: number;
  sentTo: string[];
}

export interface OfferResponse {
  id: string;
  applicationId: string;
  token?: string;
  jobTitle: string;
  companyName: string;
  candidateName: string;
  offerMessage: string;
  salary?: string;
  startDate?: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  sentAt: string;
  acceptedAt?: string;
  declinedAt?: string;
}

export interface OrgAdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ORG_ADMIN";
  orgId: string;
  isSuspended: boolean;
  createdAt: string;
}

export interface OrgMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ORG_ADMIN" | "RECRUITER";
  orgId: string;
  isSuspended: boolean;
  createdAt: string;
}

