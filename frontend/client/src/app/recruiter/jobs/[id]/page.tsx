"use client";

import { useEffect, useState, useCallback, type DragEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  jobsApi,
  applicationsApi,
  rankingApi,
  assessmentsApi,
  interviewsApi,
  integrationsApi,
  offersApi,
} from "@/lib/api";
import type {
  Job,
  Application,
  RankingStatus,
  Assessment,
  CreateAssessmentData,
  AssessmentSubmission,
  InterviewSlot,
  InterviewBooking,
} from "@/lib/types";
import ProtectedRoute from "@/components/ProtectedRoute";
import StatusBadge from "@/components/StatusBadge";
import { formatDateTime, parseDate, toLocalInputValue, nowLocalInputValue, toBackendDatetime } from "@/lib/dateUtils";
import toast from "react-hot-toast";

type QuestionDraft = {
  type: "MCQ" | "SHORT_ANSWER";
  text: string;
  options: string[];
  correct_answer: string;
  max_score: number;
};

const emptyQuestion = (): QuestionDraft => ({
  type: "MCQ",
  text: "",
  options: ["", "", "", ""],
  correct_answer: "",
  max_score: 1,
});

type JobEditForm = {
  title: string;
  description: string;
  requirements: string;
  location: string;
  employmentType: string;
  experienceLevel: string;
  skills: string;
  skillsMatchWeight: string;
  experienceMatchWeight: string;
  educationMatchWeight: string;
  overallFitWeight: string;
  applicationDeadline: string;
};

const emptyJobEditForm = (): JobEditForm => ({
  title: "",
  description: "",
  requirements: "",
  location: "",
  employmentType: "",
  experienceLevel: "",
  skills: "",
  skillsMatchWeight: "25",
  experienceMatchWeight: "25",
  educationMatchWeight: "25",
  overallFitWeight: "25",
  applicationDeadline: "",
});

type ApplicationStatus = Application["status"];

type KanbanColumn = {
  id: string;
  title: string;
  description: string;
  statuses: ApplicationStatus[];
  dropStatus: ApplicationStatus;
  accentClass: string;
};

const APPLICATION_STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "APPLIED", label: "Applied" },
  { value: "SCREENED", label: "Screened" },
  { value: "OA_INVITED", label: "OA Invited" },
  { value: "OA_COMPLETED", label: "OA Completed" },
  { value: "INTERVIEW_INVITED", label: "Interview Invited" },
  { value: "INTERVIEW_SCHEDULED", label: "Interview Scheduled" },
  { value: "INTERVIEW_COMPLETED", label: "Interview Completed" },
  { value: "OFFERED", label: "Offered" },
  { value: "OFFER_SENT", label: "Offer Sent" },
  { value: "OFFER_ACCEPTED", label: "Hired" },
  { value: "OFFER_DECLINED", label: "Offer Declined" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: "applied",
    title: "Applied",
    description: "New applicants",
    statuses: ["APPLIED"],
    dropStatus: "APPLIED",
    accentClass: "from-slate-400 to-slate-600 border-slate-400/30",
  },
  {
    id: "screening",
    title: "Screening",
    description: "CV review and ranking",
    statuses: ["SCREENED"],
    dropStatus: "SCREENED",
    accentClass: "from-sky-400 to-blue-600 border-sky-400/30",
  },
  {
    id: "assessment",
    title: "Assessment",
    description: "OA invited or completed",
    statuses: ["OA_INVITED", "OA_COMPLETED"],
    dropStatus: "OA_INVITED",
    accentClass: "from-indigo-400 to-violet-600 border-indigo-400/30",
  },
  {
    id: "interview",
    title: "Interview",
    description: "Interview invite to review",
    statuses: ["INTERVIEW_INVITED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"],
    dropStatus: "INTERVIEW_INVITED",
    accentClass: "from-emerald-400 to-teal-600 border-emerald-400/30",
  },
  {
    id: "offer",
    title: "Offer",
    description: "Offer in progress",
    statuses: ["OFFERED", "OFFER_SENT"],
    dropStatus: "OFFERED",
    accentClass: "from-purple-400 to-fuchsia-600 border-purple-400/30",
  },
  {
    id: "hired",
    title: "Hired",
    description: "Accepted offers",
    statuses: ["OFFER_ACCEPTED"],
    dropStatus: "OFFER_ACCEPTED",
    accentClass: "from-lime-400 to-green-600 border-lime-400/30",
  },
  {
    id: "closed",
    title: "Closed",
    description: "Rejected or withdrawn",
    statuses: ["REJECTED", "OFFER_DECLINED", "WITHDRAWN"],
    dropStatus: "REJECTED",
    accentClass: "from-rose-400 to-red-600 border-rose-400/30",
  },
];

const formatApplicationStatus = (status: ApplicationStatus) =>
  APPLICATION_STATUS_OPTIONS.find((option) => option.value === status)?.label ||
  status.replace(/_/g, " ").toLowerCase();

export default function RecruiterJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  // ── core state ────────────────────────────────────────────────────────────
  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [rankingStatus, setRankingStatus] = useState<RankingStatus | null>(
    null,
  );
  const [isLoadingJob, setIsLoadingJob] = useState(true);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [isRanking, setIsRanking] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isEditingJobDetails, setIsEditingJobDetails] = useState(false);
  const [isSavingJobDetails, setIsSavingJobDetails] = useState(false);
  const [jobEditForm, setJobEditForm] = useState<JobEditForm>(emptyJobEditForm());

  // ── assessment state ──────────────────────────────────────────────────────
  const [jobAssessment, setJobAssessment] = useState<Assessment | null>(null);
  const [assessmentSubmissions, setAssessmentSubmissions] = useState<AssessmentSubmission[]>([]);
  const [showCreateAssessment, setShowCreateAssessment] = useState(false);
  const [isCreatingAssessment, setIsCreatingAssessment] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const [isSendingOA, setIsSendingOA] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [inviteTopN, setInviteTopN] = useState(10);

  // ── interview invite state ────────────────────────────────────────────────
  const [isSendingInterview, setIsSendingInterview] = useState(false);
  const [isRejectingInterview, setIsRejectingInterview] = useState(false);
  const [interviewTopN, setInterviewTopN] = useState(5);
  const [interviewMinScore, setInterviewMinScore] = useState(60);

  // ── deadline state ────────────────────────────────────────────────────────
  const [oaDeadline, setOaDeadline] = useState("");
  const [interviewDeadline, setInterviewDeadline] = useState("");
  const [isUpdatingOADeadline, setIsUpdatingOADeadline] = useState(false);
  const [isUpdatingInterviewDeadline, setIsUpdatingInterviewDeadline] = useState(false);
  const [isEditingJobDeadline, setIsEditingJobDeadline] = useState(false);
  const [editJobDeadlineVal, setEditJobDeadlineVal] = useState("");
  const [isSavingJobDeadline, setIsSavingJobDeadline] = useState(false);

  // ── interview scheduling state ────────────────────────────────────────────
  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [bookings, setBookings] = useState<InterviewBooking[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isCreatingSlot, setIsCreatingSlot] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(true);

  // ── review modal state ────────────────────────────────────────────────────
  const [selectedBooking, setSelectedBooking] = useState<InterviewBooking | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewTechnical, setReviewTechnical] = useState<number | undefined>(undefined);
  const [reviewProblemSolving, setReviewProblemSolving] = useState<number | undefined>(undefined);
  const [reviewCommunication, setReviewCommunication] = useState<number | undefined>(undefined);
  const [reviewBehavioral, setReviewBehavioral] = useState<number | undefined>(undefined);
  const [reviewCultureFit, setReviewCultureFit] = useState<number | undefined>(undefined);
  const [reviewRecruiterSummary, setReviewRecruiterSummary] = useState("");
  const [reviewStrengths, setReviewStrengths] = useState("");
  const [reviewWeaknesses, setReviewWeaknesses] = useState("");
  const [reviewHireRecommendation, setReviewHireRecommendation] = useState("Neutral");

  // ── table state ───────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<"rank" | "score" | "oaScore" | "name">("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [sendingOAForApp, setSendingOAForApp] = useState<string | null>(null);
  const [sendingInterviewForApp, setSendingInterviewForApp] = useState<string | null>(null);
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());
  const [isWaitlisting, setIsWaitlisting] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [draggingAppId, setDraggingAppId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [updatingKanbanAppId, setUpdatingKanbanAppId] = useState<string | null>(null);

  // ── offer state ──────────────────────────────────────────────────────────
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerApp, setOfferApp] = useState<Application | null>(null);
  const [offerMessage, setOfferMessage] = useState("");
  const [offerSalary, setOfferSalary] = useState("");
  const [offerStartDate, setOfferStartDate] = useState("");
  const [isSendingOffer, setIsSendingOffer] = useState(false);

  // ── rejection state ───────────────────────────────────────────────────────
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectApp, setRejectApp] = useState<Application | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isBulkReject, setIsBulkReject] = useState(false);
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // assessment form
  const [assessmentTitle, setAssessmentTitle] = useState(
    "Technical Assessment",
  );
  const [assessmentDescription, setAssessmentDescription] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60);
  const [aiQuestionCount, setAiQuestionCount] = useState(8);
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    emptyQuestion(),
  ]);

  // ── data fetching ─────────────────────────────────────────────────────────
  const fetchJob = useCallback(async () => {
    try {
      const data = await jobsApi.getJob(jobId);
      setJob(data);
    } catch {
      toast.error("Failed to load job");
    } finally {
      setIsLoadingJob(false);
    }
  }, [jobId]);

  const fetchApplications = useCallback(async () => {
    try {
      const response = await applicationsApi.listApplications(jobId, {
        pageSize: 100,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      setApplications(response.content || []);
    } catch {
      // silently ignore
    } finally {
      setIsLoadingApps(false);
    }
  }, [jobId]);

  const fetchJobAssessment = useCallback(async () => {
    try {
      const list = await assessmentsApi.getAssessmentsByJob(jobId);
      if (list.length > 0) {
        setJobAssessment(list[0]);
        try {
          const subs = await assessmentsApi.getSubmissions(list[0].id);
          setAssessmentSubmissions(subs);
        } catch (e) {
          // ignore submission fetch errors
        }
      }
    } catch {
      // no assessment yet — not an error
    }
  }, [jobId]);

  const fetchInterviewData = useCallback(async () => {
    try {
      const s = await interviewsApi.getJobSlots(jobId);
      const b = await interviewsApi.getJobBookings(jobId);
      setSlots(s);
      setBookings(b);
    } catch {
      // ignore
    }
  }, [jobId]);

  const fetchIntegrationStatus = useCallback(async () => {
    try {
      const res = await integrationsApi.getGoogleIntegrationStatus();
      setIsGoogleConnected(res.connected);
    } catch {
      setIsGoogleConnected(false);
    }
  }, []);

  useEffect(() => {
    if (jobId) {
      fetchJob();
      fetchApplications();
      fetchJobAssessment();
      fetchInterviewData();
      fetchIntegrationStatus();
    }
  }, [jobId, fetchJob, fetchApplications, fetchJobAssessment, fetchInterviewData, fetchIntegrationStatus]);

  // Close dropdown when clicking outside any app-menu element
  useEffect(() => {
    if (!openDropdownId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest(`#app-menu-${openDropdownId}`)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdownId]);

  // ── job actions ───────────────────────────────────────────────────────────
  const openJobDetailsEditor = () => {
    if (!job) return;
    const deadline = parseDate(job.applicationDeadline);
    setJobEditForm({
      title: job.title || "",
      description: job.description || "",
      requirements: job.requirements || "",
      location: job.location || "",
      employmentType: job.employmentType || "",
      experienceLevel: job.experienceLevel || "",
      skills: job.skills?.join(", ") || "",
      skillsMatchWeight: String(job.scoringWeights?.skillsMatch ?? 25),
      experienceMatchWeight: String(job.scoringWeights?.experienceMatch ?? 25),
      educationMatchWeight: String(job.scoringWeights?.educationMatch ?? 25),
      overallFitWeight: String(job.scoringWeights?.overallFit ?? 25),
      applicationDeadline: deadline ? toLocalInputValue(deadline) : "",
    });
    setIsEditingJobDetails(true);
  };

  const handleJobEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setJobEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const parseWeight = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const handleSaveJobDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobEditForm.title.trim()) {
      toast.error("Job title is required");
      return;
    }

    setIsSavingJobDetails(true);
    try {
      const updatedJob = await jobsApi.updateJob(jobId, {
        title: jobEditForm.title.trim(),
        description: jobEditForm.description,
        requirements: jobEditForm.requirements,
        location: jobEditForm.location,
        employmentType: jobEditForm.employmentType,
        experienceLevel: jobEditForm.experienceLevel,
        skills: jobEditForm.skills
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        scoringWeights: {
          skillsMatch: parseWeight(jobEditForm.skillsMatchWeight),
          experienceMatch: parseWeight(jobEditForm.experienceMatchWeight),
          educationMatch: parseWeight(jobEditForm.educationMatchWeight),
          overallFit: parseWeight(jobEditForm.overallFitWeight),
        },
        applicationDeadline: jobEditForm.applicationDeadline
          ? toBackendDatetime(jobEditForm.applicationDeadline)
          : null,
        clearApplicationDeadline: !jobEditForm.applicationDeadline,
      });
      setJob(updatedJob);
      setIsEditingJobDetails(false);
      toast.success("Job details updated!");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to update job details");
    } finally {
      setIsSavingJobDetails(false);
    }
  };

  const handlePublish = async () => {
    if (!job) return;
    setIsPublishing(true);
    try {
      await jobsApi.publishJob(job.id);
      toast.success("Job published successfully!");
      fetchJob();
    } catch {
      toast.error("Failed to publish job");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleClose = async () => {
    if (!job) return;
    setIsClosing(true);
    try {
      await jobsApi.closeJob(job.id);
      toast.success("Job closed");
      fetchJob();
    } catch {
      toast.error("Failed to close job");
    } finally {
      setIsClosing(false);
    }
  };

  const handleRankCandidates = async () => {
    setIsRanking(true);
    try {
      const { rankingJobId } = await rankingApi.triggerRanking(jobId);
      toast.success("Ranking started! This may take a moment…");

      const poll = async () => {
        try {
          const status = await rankingApi.getRankingStatus(rankingJobId);
          setRankingStatus(status);
          if (status.status === "PROCESSING" || status.status === "PENDING") {
            setTimeout(poll, 3000);
          } else if (status.status === "COMPLETED") {
            toast.success("Ranking completed!");
            fetchApplications();
            setIsRanking(false);
          } else {
            toast.error("Ranking failed: " + (status.error || "Unknown error"));
            setIsRanking(false);
          }
        } catch {
          setIsRanking(false);
        }
      };
      poll();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to start ranking");
      setIsRanking(false);
    }
  };

  // ── assessment actions ────────────────────────────────────────────────────

  const handleEditAssessment = () => {
    if (!jobAssessment) return;
    setEditingAssessmentId(jobAssessment.id);
    setAssessmentTitle(jobAssessment.title);
    setAssessmentDescription(jobAssessment.description || "");
    setTimeLimitMinutes(jobAssessment.timeLimitMinutes);
    setAiQuestionCount(Math.min(Math.max(jobAssessment.questions.length, 1), 30));
    setQuestions(
      jobAssessment.questions.map((q) => ({
        ...q,
        options: q.options || ["", "", "", ""],
        correct_answer: q.correct_answer || "",
      })) as any,
    );
    setShowCreateAssessment(true);
  };

  const handleDeleteAssessment = async () => {
    if (!jobAssessment) return;
    if (!confirm("Are you sure you want to delete this assessment?")) return;
    try {
      await assessmentsApi.deleteAssessment(jobAssessment.id);
      setJobAssessment(null);
      toast.success("Assessment deleted");
    } catch {
      toast.error("Failed to delete assessment");
    }
  };

  const handleGenerateAI = async () => {
    if (!jobId) return;
    const questionCount = Math.min(Math.max(aiQuestionCount, 1), 30);
    setAiQuestionCount(questionCount);
    setIsGenerating(true);
    try {
      const res = await assessmentsApi.generateAssessment({ jobId, questionCount });
      if (res.questions && res.questions.length > 0) {
        setQuestions(
          res.questions.map((q: any) => ({
            ...q,
            options: q.options || ["", "", "", ""],
            correct_answer: q.correct_answer || "",
          })),
        );
        toast.success("Questions generated successfully!");
      }
    } catch {
      toast.error("Failed to generate questions");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateAssessment = async () => {
    const validQuestions = questions.filter((q) => q.text.trim());
    if (validQuestions.length === 0) {
      toast.error("Add at least one question before creating the assessment.");
      return;
    }
    if (validQuestions.length > 30) {
      toast.error("Assessments can have at most 30 questions.");
      return;
    }

    setIsCreatingAssessment(true);
    try {
      const data: CreateAssessmentData = {
        jobId,
        title: assessmentTitle,
        description: assessmentDescription || undefined,
        timeLimitMinutes,
        questions: validQuestions.map((q, i) => ({
          id: `q${i + 1}`,
          type: q.type,
          text: q.text,
          options:
            q.type === "MCQ" ? q.options.filter((o) => o.trim()) : undefined,
          correct_answer: q.correct_answer || undefined,
          max_score: q.max_score,
        })),
      };

      if (editingAssessmentId) {
        const updated = await assessmentsApi.updateAssessment(
          editingAssessmentId,
          data,
        );
        setJobAssessment(updated);
        setEditingAssessmentId(null);
        toast.success("Assessment updated!");
      } else {
        const created = await assessmentsApi.createAssessment(data);
        setJobAssessment(created);
        toast.success("Assessment created!");
      }

      setShowCreateAssessment(false);
    } catch {
      toast.error("Failed to create assessment");
    } finally {
      setIsCreatingAssessment(false);
    }
  };

  const handleSendAssessment = async () => {
    if (!jobAssessment || !jobId) return;
    setIsSendingOA(true);
    try {
      const res = await rankingApi.sendAssessmentInvites(jobId, {
        assessmentToken: jobAssessment.accessToken,
        assessmentTitle: jobAssessment.title,
        timeLimitMinutes: jobAssessment.timeLimitMinutes,
        topN: inviteTopN,
        expiresAt: oaDeadline ? toBackendDatetime(oaDeadline) : undefined,
      });
      toast.success(
        `Sent invites to ${res.sent} candidates (skipped ${res.skipped})`,
      );
    } catch {
      toast.error("Failed to send assessment invites");
    } finally {
      setIsSendingOA(false);
    }
  };

  const handleUpdateOADeadline = async () => {
    if (!oaDeadline) {
      toast.error("Please select a deadline first");
      return;
    }
    setIsUpdatingOADeadline(true);
    try {
      await rankingApi.updateAssessmentDeadline(jobId, toBackendDatetime(oaDeadline));
      toast.success("OA deadline updated for sent invites!");
    } catch {
      toast.error("Failed to update OA deadline");
    } finally {
      setIsUpdatingOADeadline(false);
    }
  };

  const handleUpdateInterviewDeadline = async () => {
    if (!interviewDeadline) {
      toast.error("Please select a deadline first");
      return;
    }
    setIsUpdatingInterviewDeadline(true);
    try {
      await rankingApi.updateInterviewDeadline(jobId, toBackendDatetime(interviewDeadline));
      toast.success("Interview deadline updated for sent invites!");
    } catch {
      toast.error("Failed to update interview deadline");
    } finally {
      setIsUpdatingInterviewDeadline(false);
    }
  };

  const handleSaveJobDeadline = async () => {
    if (!job) return;
    setIsSavingJobDeadline(true);
    try {
      const updatedJob = await jobsApi.updateJob(jobId, {
        // Send Spring-safe LocalDateTime format (no Z, no milliseconds)
        applicationDeadline: editJobDeadlineVal ? toBackendDatetime(editJobDeadlineVal) : null,
        clearApplicationDeadline: !editJobDeadlineVal,
      });
      setJob(updatedJob);
      setIsEditingJobDeadline(false);
      toast.success("Application deadline updated!");
    } catch {
      toast.error("Failed to update application deadline");
    } finally {
      setIsSavingJobDeadline(false);
    }
  };

  const handleRejectUninvited = async () => {
    if (!jobId) return;
    if (!window.confirm("Are you sure you want to reject all candidates who haven't received an assessment invite? This action cannot be undone.")) return;

    setIsRejecting(true);
    try {
      const res = await rankingApi.rejectUninvited(jobId);
      toast.success(
        `Successfully rejected ${res.rejectedCount} candidate(s) and sent notification emails.`,
      );
      fetchApplications(); // refresh statuses
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reject candidates");
    } finally {
      setIsRejecting(false);
    }
  };

  const handleSendInterviewInvites = async () => {
    if (!jobAssessment || !jobId) return;
    setIsSendingInterview(true);
    try {
      const res = await rankingApi.sendInterviewInvites(jobId, {
        assessmentId: jobAssessment.id,
        topN: interviewTopN,
        minScore: interviewMinScore,
        expiresAt: interviewDeadline ? toBackendDatetime(interviewDeadline) : undefined,
      });
      toast.success(
        `Interview invites sent to ${res.sent} candidate(s) (skipped ${res.skipped})`,
      );
      fetchApplications(); // refresh statuses
    } catch {
      toast.error("Failed to send interview invites");
    } finally {
      setIsSendingInterview(false);
    }
  };

  const handleRejectUninvitedInterview = async () => {
    if (!jobId) return;
    if (!window.confirm("Are you sure you want to reject candidates who completed the OA but weren't selected for an interview? This action cannot be undone.")) return;

    setIsRejectingInterview(true);
    try {
      const res = await rankingApi.rejectUninvitedInterview(jobId);
      toast.success(
        `Successfully rejected ${res.rejectedCount} candidate(s) and sent notification emails.`,
      );
      fetchApplications(); // refresh statuses
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reject candidates");
    } finally {
      setIsRejectingInterview(false);
    }
  };

  const handleCreateSlot = async () => {
    if (!scheduleDate || !scheduleTime) {
      toast.error("Please select a date and time");
      return;
    }
    setIsCreatingSlot(true);
    try {
      const start = new Date(`${scheduleDate}T${scheduleTime}:00`);
      const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour slots
      await interviewsApi.createSlots(jobId, {
        slots: [{ startTime: start.toISOString(), endTime: end.toISOString() }]
      });
      toast.success("Interview slot created");
      fetchInterviewData();
      setScheduleTime(""); // reset time after adding
    } catch {
      toast.error("Failed to create slot");
    } finally {
      setIsCreatingSlot(false);
    }
  };

  const handleOpenReviewModal = (booking: InterviewBooking) => {
    setSelectedBooking(booking);
    setReviewRating(booking.rating ?? 5);
    setReviewFeedback(booking.feedback ?? "");
    // populate metric fields if present on booking (backend may return them)
    setReviewTechnical(typeof booking.technical === 'number' ? booking.technical : undefined);
    setReviewProblemSolving(typeof booking.problemSolving === 'number' ? booking.problemSolving : undefined);
    setReviewCommunication(typeof booking.communication === 'number' ? booking.communication : undefined);
    setReviewBehavioral(typeof booking.behavioral === 'number' ? booking.behavioral : undefined);
    setReviewCultureFit(typeof booking.cultureFit === 'number' ? booking.cultureFit : undefined);
    setReviewRecruiterSummary(booking.recruiterSummary || "");
    setReviewStrengths(booking.strengths || "");
    setReviewWeaknesses(booking.weaknesses || "");
    setReviewHireRecommendation(booking.hireRecommendation || "Neutral");
    setIsReviewModalOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!jobId || !selectedBooking) return;
    setIsSubmittingReview(true);
    try {
      await interviewsApi.completeBooking(jobId, selectedBooking.id, {
        rating: reviewRating,
        feedback: reviewFeedback,
        technical: reviewTechnical,
        problemSolving: reviewProblemSolving,
        communication: reviewCommunication,
        behavioral: reviewBehavioral,
        cultureFit: reviewCultureFit,
        recruiterSummary: reviewRecruiterSummary,
        strengths: reviewStrengths,
        weaknesses: reviewWeaknesses,
        hireRecommendation: reviewHireRecommendation,
      });
      toast.success("Interview marked as completed and feedback saved.");
      setIsReviewModalOpen(false);
      // refresh bookings
      const bRes = await interviewsApi.getJobBookings(jobId);
      setBookings(bRes);
      fetchApplications();
    } catch (err) {
      toast.error("Failed to submit feedback");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // ── per-application invite handlers ─────────────────────────────────────
  const handleSendOAToApp = async (app: Application) => {
    if (!jobAssessment) {
      toast.error("No assessment configured for this job. Create one first.");
      return;
    }
    setSendingOAForApp(app.id);
    setOpenDropdownId(null);
    try {
      const res = await applicationsApi.sendOA(app.id, {
        assessmentToken: jobAssessment.accessToken,
        assessmentTitle: jobAssessment.title,
        timeLimitMinutes: jobAssessment.timeLimitMinutes,
      });
      if (res.sent > 0) {
        toast.success(`OA invite sent to ${app.candidateName}!`);
        fetchApplications();
      } else {
        toast.error(res.skippedReasons?.[0] || "Could not send OA invite.");
      }
    } catch {
      toast.error("Failed to send OA invite");
    } finally {
      setSendingOAForApp(null);
    }
  };

  const handleSendInterviewToApp = async (app: Application) => {
    setSendingInterviewForApp(app.id);
    setUpdatingKanbanAppId(app.id);
    setOpenDropdownId(null);
    try {
      const res = await applicationsApi.sendInterviewInvite(app.id);
      if (res.sent > 0) {
        setApplications((prev) =>
          prev.map((item) =>
            item.id === app.id ? { ...item, status: "INTERVIEW_INVITED" } : item,
          ),
        );
        toast.success(`Interview invite sent to ${app.candidateName}!`);
        fetchApplications();
      } else {
        toast.error(res.skippedReasons?.[0] || "Could not send interview invite.");
      }
    } catch {
      toast.error("Failed to send interview invite");
    } finally {
      setSendingInterviewForApp(null);
      setUpdatingKanbanAppId((current) => (current === app.id ? null : current));
    }
  };

  const handleCloseOfferModal = () => {
    setIsOfferModalOpen(false);
    setOfferApp(null);
    setOfferMessage("");
    setOfferSalary("");
    setOfferStartDate("");
  };

  const handleOpenOfferModal = (app: Application) => {
    setOfferApp(app);
    setOfferMessage(`We are excited to offer you the position of ${job?.title} at our company!`);
    setOfferSalary("");
    setOfferStartDate("");
    setIsOfferModalOpen(true);
    setOpenDropdownId(null);
  };

  const handleSendOfferSubmit = async () => {
    if (!offerApp || !jobId || !offerMessage.trim()) return;
    setIsSendingOffer(true);
    try {
      await offersApi.sendOffer(jobId, offerApp.id, {
        offerMessage: offerMessage.trim(),
        salary: offerSalary || undefined,
        startDate: offerStartDate || undefined,
      });
      setApplications((prev) =>
        prev.map((app) =>
          app.id === offerApp.id ? { ...app, status: "OFFER_SENT" } : app,
        ),
      );
      toast.success(`Offer sent to ${offerApp.candidateName}!`);
      handleCloseOfferModal();
      fetchApplications();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string; detail?: string } } };
      toast.error(err.response?.data?.message || err.response?.data?.detail || "Failed to send offer");
    } finally {
      setIsSendingOffer(false);
    }
  };

  const handleOpenRejectModal = (app: Application) => {
    setRejectApp(app);
    setRejectReason("");
    setIsBulkReject(false);
    setIsRejectModalOpen(true);
    setOpenDropdownId(null);
  };

  const handleCloseRejectModal = () => {
    setIsRejectModalOpen(false);
    setRejectApp(null);
    setRejectReason("");
    setIsBulkReject(false);
  };

  const handleOpenBulkRejectModal = () => {
    if (selectedAppIds.size === 0) return;
    setRejectApp(null);
    setRejectReason("");
    setIsBulkReject(true);
    setIsRejectModalOpen(true);
  };

  const handleSubmitReject = async () => {
    setIsSubmittingReject(true);
    try {
      if (isBulkReject) {
        const res = await applicationsApi.bulkReject(jobId, {
          applicationIds: Array.from(selectedAppIds),
        });
        const sentCount = res.sentTo?.length ?? 0;
        if (sentCount === res.rejectedCount) {
          toast.success(`Rejected ${res.rejectedCount} candidate(s) and sent notification emails.`);
        } else {
          toast.error(`Rejected ${res.rejectedCount} candidate(s), but only ${sentCount} notification email(s) were sent.`);
        }
        setSelectedAppIds(new Set());
      } else if (rejectApp) {
        const rejected = await applicationsApi.rejectApplication(rejectApp.id, {
          reason: rejectReason.trim() || undefined,
        });
        if (rejected.rejectionEmailSent === false) {
          toast.error(`${rejectApp.candidateName} was rejected, but the email could not be sent.`);
        } else {
          toast.success(`${rejectApp.candidateName} has been rejected and notified via email.`);
        }
      }
      handleCloseRejectModal();
      fetchApplications();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reject candidate(s)");
    } finally {
      setIsSubmittingReject(false);
    }
  };

  const copyAssessmentLink = () => {
    if (!jobAssessment) return;
    const link =
      typeof window !== "undefined"
        ? `${window.location.origin}/assessments/${jobAssessment.accessToken}`
        : `/assessments/${jobAssessment.accessToken}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const assessmentLink =
    jobAssessment && typeof window !== "undefined"
      ? `${window.location.origin}/assessments/${jobAssessment.accessToken}`
      : jobAssessment
        ? `/assessments/${jobAssessment.accessToken}`
        : "";

  // ── question helpers ──────────────────────────────────────────────────────
  const updateQuestion = (
    idx: number,
    field: keyof QuestionDraft,
    value: unknown,
  ) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)),
    );
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const opts = [...q.options];
        opts[oIdx] = value;
        return { ...q, options: opts };
      }),
    );
  };

  const addQuestion = () =>
    setQuestions((prev) => {
      if (prev.length >= 30) {
        toast.error("Assessments can have at most 30 questions.");
        return prev;
      }
      return [...prev, emptyQuestion()];
    });

  const removeQuestion = (idx: number) =>
    setQuestions((prev) => prev.filter((_, i) => i !== idx));

  const handleWaitlist = async () => {
    if (selectedAppIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to waitlist ${selectedAppIds.size} candidates?`)) return;
    setIsWaitlisting(true);
    try {
      await applicationsApi.waitlist(jobId, Array.from(selectedAppIds));
      toast.success("Candidates waitlisted!");
      setSelectedAppIds(new Set());
      fetchApplications();
    } catch {
      toast.error("Failed to waitlist candidates");
    } finally {
      setIsWaitlisting(false);
    }
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await applicationsApi.recalculateRanking(jobId);
      toast.success("Final ranking recalculated!");
      fetchApplications();
    } catch {
      toast.error("Failed to recalculate ranking");
    } finally {
      setIsRecalculating(false);
    }
  };

  const updateApplicationPipelineStatus = useCallback(
    async (app: Application, newStatus: ApplicationStatus) => {
      if (app.status === newStatus) return;

      const previousStatus = app.status;
      setUpdatingKanbanAppId(app.id);
      setApplications((prev) =>
        prev.map((item) =>
          item.id === app.id
            ? { ...item, status: newStatus, updatedAt: new Date().toISOString() }
            : item,
        ),
      );

      try {
        const updated = await applicationsApi.updateStatus(app.id, newStatus);
        setApplications((prev) =>
          prev.map((item) => (item.id === app.id ? { ...item, ...updated } : item)),
        );
        toast.success(`${app.candidateName} moved to ${formatApplicationStatus(newStatus)}`);
      } catch {
        setApplications((prev) =>
          prev.map((item) =>
            item.id === app.id ? { ...item, status: previousStatus } : item,
          ),
        );
        toast.error("Failed to update candidate status");
      } finally {
        setUpdatingKanbanAppId((current) => (current === app.id ? null : current));
      }
    },
    [],
  );

  const handleKanbanDrop = (
    event: DragEvent<HTMLDivElement>,
    column: KanbanColumn,
  ) => {
    event.preventDefault();
    const appId = event.dataTransfer.getData("application/id") || draggingAppId;
    setDragOverColumn(null);
    setDraggingAppId(null);

    const app = applications.find((item) => item.id === appId);
    if (!app) return;

    if (column.dropStatus === "OFFERED" && app.status !== "OFFER_SENT" && app.status !== "OFFER_ACCEPTED") {
      handleOpenOfferModal(app);
      return;
    }

    if (column.dropStatus === "INTERVIEW_INVITED" && !column.statuses.includes(app.status)) {
      void handleSendInterviewToApp(app);
      return;
    }

    void updateApplicationPipelineStatus(app, column.dropStatus);
  };

  const toggleSelectApp = (id: string) => {
    const next = new Set(selectedAppIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedAppIds(next);
  };

  const toggleSelectAll = () => {
    const filterStatusApps = applications.filter((app) => statusFilter === "ALL" || app.status === statusFilter);
    const allFilteredSelected =
      filterStatusApps.length > 0 && filterStatusApps.every((app) => selectedAppIds.has(app.id));

    setSelectedAppIds((prev) => {
      const next = new Set(prev);
      filterStatusApps.forEach((app) => {
        if (allFilteredSelected) next.delete(app.id);
        else next.add(app.id);
      });
      return next;
    });
  };

  // ── stats ─────────────────────────────────────────────────────────────────
  const statusCounts = applications.reduce(
    (acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const kanbanColumns = KANBAN_COLUMNS.map((column) => ({
    ...column,
    applications: applications
      .filter((app) => column.statuses.includes(app.status))
      .sort((a, b) => {
        const rankDiff = (a.finalRank ?? 999999) - (b.finalRank ?? 999999);
        if (rankDiff !== 0) return rankDiff;
        return (b.compositeScore ?? 0) - (a.compositeScore ?? 0);
      }),
  }));

  const filteredApplications = applications.filter(
    (app) => statusFilter === "ALL" || app.status === statusFilter,
  );

  // ── loading skeleton ──────────────────────────────────────────────────────
  if (isLoadingJob) {
    return (
      <ProtectedRoute requiredRole="RECRUITER">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/10 rounded w-1/3" />
            <div className="h-4 bg-white/10 rounded w-1/2" />
            <div className="grid grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-20 bg-white/10 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!job) {
    return (
      <ProtectedRoute requiredRole="RECRUITER">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-xl font-semibold text-white mb-4">
            Job Not Found
          </h2>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-primary-600 hover:text-primary-500 font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="RECRUITER">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-white/50 mb-6">
          <Link
            href="/dashboard"
            className="hover:text-primary-600 transition-colors"
          >
            Dashboard
          </Link>
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m8.25 4.5 7.5 7.5-7.5 7.5"
            />
          </svg>
          <span className="text-white">{job.title}</span>
        </nav>

        {/* ── Job Header ──────────────────────────────────────────────────── */}
        <div className="bg-white/5 backdrop-blur-xl rounded-xl shadow-sm border border-white/10 p-6 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-white">
                  {job.title}
                </h1>
                <StatusBadge status={job.status} type="job" />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/50">
                {job.location && <span>{job.location}</span>}
                {job.employmentType && (
                  <span>{job.employmentType.replace("_", " ")}</span>
                )}
                {job.experienceLevel && (
                  <span>{job.experienceLevel} Level</span>
                )}
              </div>
              {/* ── Application Deadline display + edit ─────────────────── */}
              {!isEditingJobDeadline && (
                <div className="flex items-center gap-2 mt-2">
                  {job.applicationDeadline ? (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${(parseDate(job.applicationDeadline) || new Date()) < new Date()
                        ? "bg-red-500/10 text-red-400"
                        : "bg-amber-500/10 text-amber-400"
                      }`}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                      {(parseDate(job.applicationDeadline) || new Date()) < new Date()
                        ? `Closed — deadline was ${formatDateTime(job.applicationDeadline)}`
                        : `Applications close: ${formatDateTime(job.applicationDeadline)}`
                      }
                    </div>
                  ) : (
                    <span className="text-xs text-white/40 italic">No application deadline set</span>
                  )}
                  <button
                    onClick={() => {
                      const d = parseDate(job.applicationDeadline);
                      // Use local time so the datetime-local input pre-fills correctly
                      setEditJobDeadlineVal(d ? toLocalInputValue(d) : "");
                      setIsEditingJobDeadline(true);
                    }}
                    className="text-xs text-white/50 hover:text-white/70 underline"
                  >
                    {job.applicationDeadline ? "Edit" : "Add deadline"}
                  </button>
                </div>
              )}
              {isEditingJobDeadline && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={editJobDeadlineVal}
                    onChange={(e) => setEditJobDeadlineVal(e.target.value)}
                    min={nowLocalInputValue()}
                    className="px-2 py-1 text-xs border border-white/20 bg-white/5 rounded"
                  />
                  <button
                    onClick={handleSaveJobDeadline}
                    disabled={isSavingJobDeadline}
                    className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSavingJobDeadline ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setIsEditingJobDeadline(false)}
                    className="px-2 py-1 text-xs text-white/50 hover:text-white/70"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={openJobDetailsEditor}
                className="px-4 py-2 bg-white/10 text-white text-sm font-medium rounded-lg hover:bg-white/15 transition-colors border border-white/10"
              >
                Edit Details
              </button>
              {job.status === "DRAFT" && (
                <button
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isPublishing ? "Publishing…" : "Publish Job"}
                </button>
              )}
              {job.status === "PUBLISHED" && (
                <button
                  onClick={handleClose}
                  disabled={isClosing}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isClosing ? "Closing…" : "Close Job"}
                </button>
              )}
            </div>
          </div>

          {job.skills && job.skills.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {job.skills.map((skill, i) => (
                <span
                  key={i}
                  className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>

        {isEditingJobDetails && (
          <form onSubmit={handleSaveJobDetails} className="bg-white/5 backdrop-blur-xl rounded-xl shadow-sm border border-white/10 p-6 mb-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Edit Job Details</h2>
                <p className="text-sm text-white/50 mt-1">Update the posting content recruiters and candidates see.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingJobDetails(false)}
                className="text-sm text-white/50 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white/70 mb-1">Job Title</label>
                <input
                  name="title"
                  value={jobEditForm.title}
                  onChange={handleJobEditChange}
                  className="w-full px-4 py-2.5 border border-white/20 bg-white/5 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Senior Software Engineer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Location</label>
                <input
                  name="location"
                  value={jobEditForm.location}
                  onChange={handleJobEditChange}
                  className="w-full px-4 py-2.5 border border-white/20 bg-white/5 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Remote, city, or region"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Employment Type</label>
                <select
                  name="employmentType"
                  value={jobEditForm.employmentType}
                  onChange={handleJobEditChange}
                  className="w-full px-4 py-2.5 border border-white/20 bg-white/5 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select type</option>
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="REMOTE">Remote</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Experience Level</label>
                <select
                  name="experienceLevel"
                  value={jobEditForm.experienceLevel}
                  onChange={handleJobEditChange}
                  className="w-full px-4 py-2.5 border border-white/20 bg-white/5 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select level</option>
                  <option value="ENTRY">Entry Level</option>
                  <option value="MID">Mid Level</option>
                  <option value="SENIOR">Senior</option>
                  <option value="LEAD">Lead</option>
                  <option value="EXECUTIVE">Executive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Application Deadline</label>
                <input
                  name="applicationDeadline"
                  type="datetime-local"
                  value={jobEditForm.applicationDeadline}
                  onChange={handleJobEditChange}
                  min={nowLocalInputValue()}
                  className="w-full px-4 py-2.5 border border-white/20 bg-white/5 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white/70 mb-1">Required Skills</label>
                <input
                  name="skills"
                  value={jobEditForm.skills}
                  onChange={handleJobEditChange}
                  className="w-full px-4 py-2.5 border border-white/20 bg-white/5 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="React, TypeScript, PostgreSQL"
                />
                <p className="mt-1 text-xs text-white/40">Separate skills with commas.</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white/70 mb-1">Job Description</label>
                <textarea
                  name="description"
                  rows={7}
                  value={jobEditForm.description}
                  onChange={handleJobEditChange}
                  className="w-full px-4 py-2.5 border border-white/20 bg-white/5 rounded-lg text-white placeholder-white/40 resize-y focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-white/70 mb-1">Requirements</label>
                <textarea
                  name="requirements"
                  rows={5}
                  value={jobEditForm.requirements}
                  onChange={handleJobEditChange}
                  className="w-full px-4 py-2.5 border border-white/20 bg-white/5 rounded-lg text-white placeholder-white/40 resize-y focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-5">
              <h3 className="text-sm font-semibold text-white mb-3">Scoring Weights</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  ["skillsMatchWeight", "Skills Match"],
                  ["experienceMatchWeight", "Experience"],
                  ["educationMatchWeight", "Education"],
                  ["overallFitWeight", "Overall Fit"],
                ].map(([name, label]) => (
                  <div key={name}>
                    <label className="block text-xs font-medium text-white/60 mb-1">{label}</label>
                    <input
                      name={name}
                      type="number"
                      min="0"
                      max="100"
                      value={jobEditForm[name as keyof JobEditForm]}
                      onChange={handleJobEditChange}
                      className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-lg text-sm text-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={() => setIsEditingJobDetails(false)}
                className="px-5 py-2.5 text-sm text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingJobDetails}
                className="px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {isSavingJobDetails ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        )}

        {/* ── Status Counts ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          {[
            {
              label: "Total",
              value: applications.length,
              color: "text-white",
            },
            {
              label: "Applied",
              value: statusCounts["APPLIED"] || 0,
              color: "text-blue-600",
            },
            {
              label: "Screened",
              value: statusCounts["SCREENED"] || 0,
              color: "text-violet-600",
            },
            {
              label: "OA Invited",
              value: statusCounts["OA_INVITED"] || 0,
              color: "text-amber-600",
            },
            {
              label: "OA Done",
              value: statusCounts["OA_COMPLETED"] || 0,
              color: "text-teal-600",
            },
            {
              label: "Interview",
              value: (statusCounts["INTERVIEW_INVITED"] || 0) + (statusCounts["INTERVIEW_SCHEDULED"] || 0) + (statusCounts["INTERVIEW_COMPLETED"] || 0),
              color: "text-indigo-600",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-white/5 backdrop-blur-lg rounded-lg border border-white/10 p-4 text-center"
            >
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-white/50 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Online Assessment ────────────────────────────────────────────── */}
        <div className="bg-white/5 backdrop-blur-xl rounded-xl shadow-sm border border-white/10 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Online Assessment
              </h2>
              <p className="text-sm text-white/50 mt-0.5">
                One assessment per job — share the link with any candidate.
              </p>
            </div>
            {!jobAssessment && !showCreateAssessment && (
              <button
                onClick={() => {
                  setShowCreateAssessment(true);
                }}
                disabled={isGenerating}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <svg
                  className="w-4 h-4 mr-1.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                {isGenerating ? "Generating..." : "Create Assessment"}
              </button>
            )}
          </div>

          {/* Existing assessment */}
          {jobAssessment && (
            <div className="space-y-3">
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-indigo-300">
                      {jobAssessment.title}
                    </p>
                    {jobAssessment.description && (
                      <p className="text-sm text-indigo-300 mt-0.5">
                        {jobAssessment.description}
                      </p>
                    )}
                    <p className="text-xs text-indigo-400 mt-1">
                      {jobAssessment.questions.length} question
                      {jobAssessment.questions.length !== 1
                        ? "s"
                        : ""} &middot; {jobAssessment.timeLimitMinutes} min time
                      limit
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleEditAssessment}
                        className="text-xs bg-indigo-600/20 text-indigo-300 px-2 py-1 rounded border border-indigo-500/30 hover:bg-indigo-500/20 flex items-center gap-1"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={handleDeleteAssessment}
                        className="text-xs bg-red-500/10 text-red-400 px-2 py-1 rounded border border-red-500/20 hover:bg-red-500/20 flex items-center gap-1"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                  <StatusBadge
                    status={jobAssessment.status}
                    type="assessment"
                  />
                </div>

                <div className="mt-3">
                  <p className="text-xs font-medium text-indigo-400 mb-1">
                    Candidate link — share this with applicants:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 text-xs bg-white/5 border border-indigo-500/30 rounded px-2 py-1.5 truncate text-indigo-300">
                      {assessmentLink}
                    </code>
                    <button
                      onClick={copyAssessmentLink}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 rounded hover:bg-indigo-500/20 transition-colors"
                    >
                      {copied ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-indigo-100 space-y-3">
                  {/* OA Deadline picker */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-indigo-300 whitespace-nowrap">
                      OA Deadline
                      <span className="ml-1 text-xs font-normal text-indigo-400">(optional)</span>
                    </span>
                    <input
                      type="datetime-local"
                      value={oaDeadline}
                      onChange={(e) => setOaDeadline(e.target.value)}
                      min={nowLocalInputValue()}
                      className="px-2 py-1 text-sm border border-indigo-500/30 rounded text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    {oaDeadline && (
                      <span className="text-xs flex items-center gap-2">
                        <span className="text-amber-600 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                          Expires {formatDateTime(oaDeadline)}
                        </span>
                        <button
                          onClick={handleUpdateOADeadline}
                          disabled={isUpdatingOADeadline}
                          className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {isUpdatingOADeadline ? "Updating..." : "Update sent invites"}
                        </button>
                      </span>
                    )}
                  </div>
                  {/* Send controls */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-indigo-300">Send OA to top</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={inviteTopN}
                      onChange={(e) => setInviteTopN(Number(e.target.value))}
                      className="w-16 px-2 py-1 text-sm bg-white/5 border border-indigo-500/30 rounded text-white"
                    />
                    <span className="text-sm font-medium text-indigo-300">candidates</span>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={handleSendAssessment}
                        disabled={isSendingOA || applications.length === 0}
                        className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {isSendingOA ? "Sending..." : "Send Assessment"}
                      </button>
                      <button
                        onClick={handleRejectUninvited}
                        disabled={isRejecting || applications.length === 0}
                        className="px-4 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {isRejecting ? "Rejecting..." : "Reject Remaining"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Assessment creation form */}
          {!jobAssessment && showCreateAssessment && (
            <div className="border border-white/10 rounded-lg p-5 space-y-5">
              {/* Title + time limit
                    </p>
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button onClick={handleEditAssessment} className="text-xs bg-indigo-600/20 text-indigo-300 px-2 py-1 rounded border border-indigo-500/30 hover:bg-indigo-500/20 flex items-center gap-1">✏️ Edit</button>
                      <button onClick={handleDeleteAssessment} className="text-xs bg-red-500/10 text-red-400 px-2 py-1 rounded border border-red-500/20 hover:bg-red-500/20 flex items-center gap-1">🗑️ Delete</button>
                    </div> */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">
                    Assessment Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={assessmentTitle}
                    onChange={(e) => setAssessmentTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. Technical Screening"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">
                    Time Limit (minutes)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={timeLimitMinutes}
                    onChange={(e) =>
                      setTimeLimitMinutes(Number(e.target.value))
                    }
                    className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">
                    AI Question Count
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={aiQuestionCount}
                    onChange={(e) =>
                      setAiQuestionCount(
                        Math.min(Math.max(Number(e.target.value) || 1, 1), 30),
                      )
                    }
                    className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="mt-1 text-xs text-white/40">1 to 30 questions.</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">
                  Description (optional)
                </label>
                <input
                  value={assessmentDescription}
                  onChange={(e) => setAssessmentDescription(e.target.value)}
                  placeholder="Describe what this assessment covers…"
                  className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-lg text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Questions */}
              <div>
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium text-white/70">
                    Questions
                  </p>
                  <button
                    onClick={handleGenerateAI}
                    disabled={isGenerating}
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isGenerating
                      ? "Generating..."
                      : `Generate ${aiQuestionCount} with AI`}
                  </button>
                </div>
                <div className="space-y-4">
                  {questions.map((q, qi) => (
                    <div
                      key={qi}
                      className="border border-white/10 rounded-lg p-4 space-y-3"
                    >
                      {/* Question meta row */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-semibold text-white/40 w-6">
                          Q{qi + 1}
                        </span>
                        <select
                          value={q.type}
                          onChange={(e) =>
                            updateQuestion(
                              qi,
                              "type",
                              e.target.value as QuestionDraft["type"],
                            )
                          }
                          className="px-2 py-1 border border-white/20 bg-white/5 rounded text-sm text-white"
                        >
                          <option value="MCQ">Multiple Choice</option>
                          <option value="SHORT_ANSWER">Short Answer</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-white/50">
                            Points:
                          </label>
                          <input
                            type="number"
                            min={0.5}
                            step={0.5}
                            value={q.max_score}
                            onChange={(e) =>
                              updateQuestion(
                                qi,
                                "max_score",
                                Number(e.target.value),
                              )
                            }
                            className="w-16 px-2 py-1 border border-white/20 bg-white/5 rounded text-sm text-white"
                          />
                        </div>
                        {questions.length > 1 && (
                          <button
                            onClick={() => removeQuestion(qi)}
                            className="ml-auto text-sm text-red-400 hover:text-red-600"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      {/* Question text */}
                      <textarea
                        value={q.text}
                        rows={2}
                        onChange={(e) =>
                          updateQuestion(qi, "text", e.target.value)
                        }
                        placeholder="Question text…"
                        className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />

                      {/* MCQ options */}
                      {q.type === "MCQ" && (
                        <div className="space-y-2">
                          <p className="text-xs text-white/50">
                            Options — select the radio button next to the
                            correct answer:
                          </p>
                          {q.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`q${qi}-correct`}
                                checked={
                                  q.correct_answer === opt && opt.trim() !== ""
                                }
                                onChange={() =>
                                  updateQuestion(qi, "correct_answer", opt)
                                }
                                className="w-4 h-4 text-indigo-600"
                              />
                              <input
                                value={opt}
                                onChange={(e) =>
                                  updateOption(qi, oi, e.target.value)
                                }
                                placeholder={`Option ${oi + 1}`}
                                className="flex-1 px-2 py-1 border border-white/20 bg-white/5 rounded text-sm text-white"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={addQuestion}
                  className="mt-3 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                  Add Question
                </button>
              </div>

              {/* Form actions */}
              <div className="flex items-center gap-3 pt-1 border-t border-white/10">
                <button
                  onClick={handleCreateAssessment}
                  disabled={isCreatingAssessment}
                  className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {isCreatingAssessment ? "Creating…" : "Create Assessment"}
                </button>
                <button
                  onClick={() => {
                    setShowCreateAssessment(false);
                    setQuestions([emptyQuestion()]);
                  }}
                  className="px-5 py-2 text-sm text-white/60 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!jobAssessment && !showCreateAssessment && (
            <p className="text-sm text-white/40">
              No assessment created yet. Create one to screen candidates with
              multiple-choice or short-answer questions.
            </p>
          )}
        </div>

        {/* ── Candidate Ranking ────────────────────────────────────────────── */}
        <div className="bg-white/5 backdrop-blur-xl rounded-xl shadow-sm border border-white/10 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Candidate Ranking
            </h2>
            <button
              onClick={handleRankCandidates}
              disabled={isRanking || applications.length === 0}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRanking ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Ranking…
                </span>
              ) : (
                <>
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
                    />
                  </svg>
                  Rank Candidates
                </>
              )}
            </button>
          </div>

          {rankingStatus && (
            <div className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={rankingStatus.status} type="ranking" />
                {rankingStatus.progress !== undefined && (
                  <div className="flex-1">
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all"
                        style={{ width: `${rankingStatus.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!rankingStatus && applications.length === 0 && (
            <p className="text-sm text-white/40">
              {job.status === "DRAFT"
                ? "Publish this job first to start receiving applications."
                : "No applications yet. Ranking will be available once candidates apply."}
            </p>
          )}
        </div>

        {/* ── OA Results & Interview Invites ───────────────────────────────── */}
        <div className="bg-white/5 backdrop-blur-xl rounded-xl shadow-sm border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            OA Results & Interview Invites
          </h2>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-white/70 mb-1">
                Top N Candidates
              </label>
              <input
                type="number"
                min="1"
                value={interviewTopN}
                onChange={(e) => setInterviewTopN(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-white/70 mb-1">
                Minimum Score
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={interviewMinScore}
                onChange={(e) => setInterviewMinScore(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex-1 min-w-[220px]">
              <label className="block text-sm font-medium text-white/70 mb-1">
                Booking Deadline
                <span className="ml-1 text-xs font-normal text-white/40">(optional)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={interviewDeadline}
                  onChange={(e) => setInterviewDeadline(e.target.value)}
                  min={nowLocalInputValue()}
                  className="flex-1 px-3 py-2 border border-white/20 bg-white/5 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              {interviewDeadline && (
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                    Booking closes {formatDateTime(interviewDeadline)}
                  </p>
                  <button
                    onClick={handleUpdateInterviewDeadline}
                    disabled={isUpdatingInterviewDeadline}
                    className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {isUpdatingInterviewDeadline ? "Updating..." : "Update sent invites"}
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSendInterviewInvites}
                disabled={isSendingInterview || !jobAssessment || assessmentSubmissions.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSendingInterview ? "Sending..." : "Send Interview Invites"}
              </button>
              <button
                onClick={handleRejectUninvitedInterview}
                disabled={isRejectingInterview || !jobAssessment || assessmentSubmissions.length === 0}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRejectingInterview ? "Rejecting..." : "Reject Remaining"}
              </button>
            </div>
          </div>
          {!jobAssessment && (
            <p className="mt-2 text-sm text-white/50">
              No assessment configured for this job yet.
            </p>
          )}
        </div>

        {/* ── Interview Scheduling ─────────────────────────────────────────── */}
        <div className="bg-white/5 backdrop-blur-xl rounded-xl shadow-sm border border-white/10 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Interview Scheduling
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-medium text-white/70 mb-3">Add Available Slots</h3>
              {!isGoogleConnected ? (
                <div className="bg-red-500/10 text-red-400 border border-red-500/20 p-3 rounded-md text-sm mb-3">
                  You must connect your Google Calendar in Settings before creating interview slots.
                  <Link href="/recruiter/settings" className="underline ml-1">Go to Settings</Link>
                </div>
              ) : null}
              <div className="flex flex-col gap-3">
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  disabled={!isGoogleConnected}
                  className="px-3 py-2 border border-white/20 bg-white/5 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 disabled:bg-white/10 disabled:cursor-not-allowed"
                />
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    disabled={!isGoogleConnected}
                    className="flex-1 px-3 py-2 border border-white/20 bg-white/5 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 disabled:bg-white/10 disabled:cursor-not-allowed"
                  />
                  <button
                    onClick={handleCreateSlot}
                    disabled={isCreatingSlot || !scheduleDate || !scheduleTime || !isGoogleConnected}
                    className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    {isCreatingSlot ? "Adding..." : "Add"}
                  </button>
                </div>
              </div>

              <h3 className="text-sm font-medium text-white/70 mt-6 mb-3">Your Available Slots</h3>
              {slots.filter(s => s.status === "AVAILABLE").length === 0 ? (
                <p className="text-sm text-white/50">No available slots.</p>
              ) : (
                <ul className="space-y-2 max-h-[200px] overflow-y-auto">
                  {slots.filter(s => s.status === "AVAILABLE").map(slot => (
                    <li key={slot.id} className="text-sm px-3 py-2 bg-white/5 rounded-md border border-white/10 text-white/70">
                      {formatDateTime(slot.startTime)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="md:col-span-2 mt-4">
              <h3 className="text-sm font-medium text-white/70 mb-3">Your Scheduled Interviews</h3>
              {bookings.length === 0 ? (
                <p className="text-sm text-white/50">No interviews booked yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 border border-white/10 rounded-lg">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Candidate</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Meeting</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-white/50 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-transparent divide-y divide-white/10">
                      {bookings.map((booking) => {
                        const slot = slots.find((s) => s.id === booking.slotId);
                        const app = applications.find((a) => a.id === booking.applicationId);
                        return (
                          <tr key={booking.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Link href={`/recruiter/jobs/${jobId}/applications/${app?.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-300">
                                {app?.candidateName || "Candidate"}
                              </Link>
                              <div className="text-xs text-white/50">{app?.candidateEmail}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-white/70">
                              {slot ? formatDateTime(slot.startTime) : "Unknown Time"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {booking.meetingLink ? (
                                <a href={booking.meetingLink} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-300 underline">
                                  Join Link
                                </a>
                              ) : "-"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {booking.status === "COMPLETED" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                                  Completed
                                </span>
                              ) : booking.status === "SCHEDULED" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  Scheduled
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-white/80">
                                  {booking.status}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                              {booking.status === "SCHEDULED" && (
                                <button
                                  onClick={() => handleOpenReviewModal(booking)}
                                  className="text-indigo-600 hover:text-indigo-300 font-medium"
                                >
                                  Complete & Review
                                </button>
                              )}
                              {booking.status === "COMPLETED" && (
                                <button
                                  onClick={() => handleOpenReviewModal(booking)}
                                  className="text-white/60 hover:text-white font-medium"
                                >
                                  View Review
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Pipeline Kanban ──────────────────────────────────────────────── */}
        <div className="mb-8 bg-white/5 backdrop-blur-xl rounded-[2rem] shadow-sm border border-white/10 overflow-hidden">
          <div className="p-6 border-b border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-white">Pipeline Kanban</h2>
                <span className="px-2.5 py-1 rounded-full bg-white/10 text-xs font-bold text-white/60 uppercase tracking-widest">
                  {applications.length} candidates
                </span>
              </div>
              <p className="text-sm text-white/50 mt-1">
                Drag cards between stages to update pipeline status. Moving into Offer opens the offer sender.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-white/50">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                Applied <span className="text-white font-bold">{statusCounts.APPLIED || 0}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                Assessment <span className="text-white font-bold">{(statusCounts.OA_INVITED || 0) + (statusCounts.OA_COMPLETED || 0)}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                Interview <span className="text-white font-bold">{(statusCounts.INTERVIEW_INVITED || 0) + (statusCounts.INTERVIEW_SCHEDULED || 0) + (statusCounts.INTERVIEW_COMPLETED || 0)}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                Hired <span className="text-white font-bold">{statusCounts.OFFER_ACCEPTED || 0}</span>
              </div>
            </div>
          </div>

          {isLoadingApps ? (
            <div className="p-6 flex gap-4 overflow-hidden">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-80 shrink-0 animate-pulse rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="h-5 bg-white/10 rounded w-1/2 mb-4" />
                  <div className="space-y-3">
                    <div className="h-28 bg-white/10 rounded-2xl" />
                    <div className="h-28 bg-white/10 rounded-2xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : applications.length > 0 ? (
            <div className="overflow-x-auto p-4">
              <div className="flex min-w-max gap-4 pb-2">
                {kanbanColumns.map((column) => (
                  <div
                    key={column.id}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      if (dragOverColumn !== column.id) setDragOverColumn(column.id);
                    }}
                    onDrop={(event) => handleKanbanDrop(event, column)}
                    className={`flex max-h-[70vh] w-80 shrink-0 flex-col rounded-[1.5rem] border bg-black/20 p-4 transition-all ${column.accentClass} ${
                      dragOverColumn === column.id ? "ring-2 ring-white/50 bg-white/10" : ""
                    }`}
                  >
                    <div className={`mb-4 h-1.5 rounded-full bg-gradient-to-r ${column.accentClass}`} />
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-white">
                          {column.title}
                        </h3>
                        <p className="text-xs text-white/45 mt-1">{column.description}</p>
                      </div>
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-black text-white/70">
                        {column.applications.length}
                      </span>
                    </div>

                    <div className="min-h-[180px] space-y-3 overflow-y-auto pr-1">
                      {column.applications.length === 0 ? (
                        <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] text-center text-xs text-white/35">
                          Drop candidates here
                        </div>
                      ) : (
                        column.applications.map((app) => {
                          const initials = (app.candidateName || "?")
                            .split(" ")
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase();
                          const isUpdating = updatingKanbanAppId === app.id;

                          return (
                            <div
                              key={app.id}
                              draggable={!isUpdating}
                              onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("application/id", app.id);
                                setDraggingAppId(app.id);
                              }}
                              onDragEnd={() => {
                                setDraggingAppId(null);
                                setDragOverColumn(null);
                              }}
                              className={`group rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-lg transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-slate-900/90 ${
                                draggingAppId === app.id ? "opacity-50 scale-[0.98]" : ""
                              } ${isUpdating ? "opacity-60" : "cursor-grab active:cursor-grabbing"}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-xs font-black text-white">
                                  {initials}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <Link
                                    href={`/recruiter/jobs/${jobId}/applications/${app.id}`}
                                    className="block truncate text-sm font-bold text-white hover:text-indigo-300"
                                  >
                                    {app.candidateName || "Unknown Candidate"}
                                  </Link>
                                  <p className="truncate text-xs text-white/45">{app.candidateEmail}</p>
                                </div>
                                {app.finalRank && (
                                  <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black text-white/60">
                                    #{app.finalRank}
                                  </span>
                                )}
                              </div>

                              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] uppercase tracking-widest text-white/40">
                                <div className="rounded-xl bg-white/5 px-2 py-2">
                                  CV
                                  <div className="mt-1 text-sm font-black text-white">
                                    {app.compositeScore != null ? Math.round(app.compositeScore) : "-"}
                                  </div>
                                </div>
                                <div className="rounded-xl bg-white/5 px-2 py-2">
                                  OA
                                  <div className="mt-1 text-sm font-black text-white">
                                    {app.oaScore != null ? Math.round(app.oaScore) : "-"}
                                  </div>
                                </div>
                                <div className="rounded-xl bg-white/5 px-2 py-2">
                                  INT
                                  <div className="mt-1 text-sm font-black text-white">
                                    {app.interviewScore != null ? app.interviewScore : "-"}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 flex items-center justify-between gap-3">
                                <StatusBadge status={app.status} type="application" />
                                {app.isWaitlisted && (
                                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-400">
                                    Waitlisted
                                  </span>
                                )}
                              </div>

                              <div className="mt-3 flex items-center gap-2">
                                <select
                                  value={app.status}
                                  disabled={isUpdating}
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => {
                                    const nextStatus = event.target.value as ApplicationStatus;
                                    if (nextStatus === "OFFERED" || nextStatus === "OFFER_SENT") {
                                      handleOpenOfferModal(app);
                                      return;
                                    }
                                    if (
                                      nextStatus === "INTERVIEW_INVITED" &&
                                      !(["INTERVIEW_INVITED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"] as ApplicationStatus[]).includes(app.status)
                                    ) {
                                      void handleSendInterviewToApp(app);
                                      return;
                                    }
                                    void updateApplicationPipelineStatus(app, nextStatus);
                                  }}
                                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none transition-colors focus:border-indigo-400 disabled:opacity-50"
                                >
                                  {APPLICATION_STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleOpenOfferModal(app);
                                  }}
                                  disabled={isUpdating || app.status === "OFFER_SENT" || app.status === "OFFER_ACCEPTED"}
                                  className="rounded-xl border border-purple-400/30 bg-purple-500/10 px-3 py-2 text-xs font-black uppercase tracking-widest text-purple-200 transition-colors hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Offer
                                </button>
                                <Link
                                  href={`/recruiter/jobs/${jobId}/applications/${app.id}`}
                                  className="rounded-xl bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-950 transition-colors hover:bg-indigo-100"
                                >
                                  View
                                </Link>
                              </div>

                              {isUpdating && (
                                <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                                  Saving status...
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-white/50">
              Applications will appear in the pipeline once candidates apply.
            </div>
          )}
        </div>

        {/* ── Applications Table ───────────────────────────────────────────── */}
        <div className="bg-white/5 backdrop-blur-xl rounded-xl shadow-sm border border-white/10 overflow-hidden">
          <div className="p-6 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-white">
              Applications ({applications.length})
            </h2>
            <div className="flex items-center gap-3">
              {selectedAppIds.size > 0 && (
                <>
                  <button
                    onClick={handleWaitlist}
                    disabled={isWaitlisting}
                    className="px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-sm font-medium rounded hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                  >
                    {isWaitlisting ? "Waitlisting..." : `Waitlist Selected (${selectedAppIds.size})`}
                  </button>
                  <button
                    onClick={handleOpenBulkRejectModal}
                    className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-medium rounded hover:bg-red-500/20 transition-colors"
                  >
                    Reject Selected ({selectedAppIds.size})
                  </button>
                </>
              )}
              <button
                onClick={handleRecalculate}
                disabled={isRecalculating}
                className="px-3 py-1.5 border border-indigo-500/30 text-indigo-700 bg-white text-sm font-medium rounded hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
              >
                {isRecalculating ? "Recalculating..." : "Recalculate Final Ranking"}
              </button>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-white/70">Filter Status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 border border-white/20 bg-white/5 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                >
                <option value="ALL">All</option>
                {APPLICATION_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          </div>

          {isLoadingApps ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse border rounded-lg p-5 h-16 bg-white/5" />
              ))}
            </div>
          ) : applications.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white/5">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left">
                      <input type="checkbox" checked={filteredApplications.length > 0 && filteredApplications.every((app) => selectedAppIds.has(app.id))} onChange={toggleSelectAll} className="w-4 h-4 text-primary-600 rounded" />
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider cursor-pointer" onClick={() => { setSortField("rank"); setSortDir(sortDir === "asc" ? "desc" : "asc"); }}>
                      Final Rank {sortField === "rank" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider cursor-pointer" onClick={() => { setSortField("name"); setSortDir(sortDir === "asc" ? "desc" : "asc"); }}>
                      Candidate {sortField === "name" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider cursor-pointer" onClick={() => { setSortField("score"); setSortDir(sortDir === "asc" ? "desc" : "asc"); }}>
                      CV Score {sortField === "score" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider cursor-pointer" onClick={() => { setSortField("oaScore"); setSortDir(sortDir === "asc" ? "desc" : "asc"); }}>
                      OA Score {sortField === "oaScore" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">
                      Interview
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">
                      App Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-white/50 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-transparent divide-y divide-white/10">
                  {filteredApplications
                    .sort((a, b) => {
                      const aRank = a.finalRank ?? 999999;
                      const bRank = b.finalRank ?? 999999;
                      const aScore = a.compositeScore ?? 0;
                      const bScore = b.compositeScore ?? 0;
                      const aOa = a.oaScore ?? -1;
                      const bOa = b.oaScore ?? -1;

                      let diff = 0;
                      if (sortField === "rank") diff = aRank - bRank;
                      else if (sortField === "score") diff = aScore - bScore;
                      else if (sortField === "oaScore") diff = aOa - bOa;
                      else if (sortField === "name") diff = (a.candidateName || "").localeCompare(b.candidateName || "");

                      return sortDir === "asc" ? diff : -diff;
                    })
                    .map((app) => {
                      const detailHref = `/recruiter/jobs/${jobId}/applications/${app.id}`;

                      return (
                        <tr key={app.id} className={`hover:bg-white/5 transition-colors ${app.isWaitlisted ? "bg-amber-50/30" : ""}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input type="checkbox" checked={selectedAppIds.has(app.id)} onChange={() => toggleSelectApp(app.id)} className="w-4 h-4 text-primary-600 rounded" />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                            {app.finalRank ? `#${app.finalRank}` : "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-white">{app.candidateName} {app.isWaitlisted && <span className="ml-2 text-[10px] uppercase font-bold text-amber-400 border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 rounded">Waitlisted</span>}</div>
                            <div className="text-sm text-white/50">{app.candidateEmail}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white/50">
                            {app.compositeScore != null ? (
                              <span className="font-semibold text-primary-600">{Math.round(app.compositeScore)}</span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white/50">
                            {app.oaScore != null ? (
                              <span className="font-bold text-indigo-600">{Math.round(app.oaScore)}</span>
                            ) : (
                              <span className="text-white/40">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white/50">
                            {app.interviewScore != null ? (
                              <span className="font-bold text-emerald-600">{app.interviewScore} <span className="font-normal text-xs text-white/40">/50</span></span>
                            ) : "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={app.status} type="application" />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="relative inline-block text-left" id={`app-menu-${app.id}`}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdownId(openDropdownId === app.id ? null : app.id);
                                }}
                                disabled={sendingOAForApp === app.id || sendingInterviewForApp === app.id}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white/50 hover:text-white/70 hover:bg-white/10 transition-colors disabled:opacity-40"
                                title="Actions"
                              >
                                {(sendingOAForApp === app.id || sendingInterviewForApp === app.id) ? (
                                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <circle cx="12" cy="5" r="1.5" />
                                    <circle cx="12" cy="12" r="1.5" />
                                    <circle cx="12" cy="19" r="1.5" />
                                  </svg>
                                )}
                              </button>

                              {openDropdownId === app.id && (
                                <div
                                  className="absolute right-0 mt-1 w-52 bg-slate-900 border border-white/10 backdrop-blur-xl rounded-lg shadow-lg z-30 py-1 animate-in fade-in zoom-in-95 duration-100"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {/* View Details */}
                                  <Link
                                    href={detailHref}
                                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors"
                                    onClick={() => setOpenDropdownId(null)}
                                  >
                                    <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                                    </svg>
                                    View Details
                                  </Link>

                                  <div className="border-t border-white/10 my-1" />

                                  {/* Send OA */}
                                  <button
                                    onClick={() => handleSendOAToApp(app)}
                                    disabled={!jobAssessment}
                                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={!jobAssessment ? "Create an assessment first" : `Send OA invite to ${app.candidateName}`}
                                  >
                                    <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
                                    </svg>
                                    Send OA Invite
                                  </button>

                                  {/* Send Interview Invite */}
                                  <button
                                    onClick={() => handleSendInterviewToApp(app)}
                                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50 transition-colors"
                                    title={`Send interview invite to ${app.candidateName}`}
                                  >
                                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                                    </svg>
                                    Send Interview Invite
                                  </button>

                                  {/* Send Offer */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleOpenOfferModal(app);
                                    }}
                                    disabled={app.status === "OFFER_SENT" || app.status === "OFFER_ACCEPTED"}
                                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-purple-300 hover:bg-purple-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={`Send offer to ${app.candidateName}`}
                                  >
                                    <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                                    </svg>
                                    {app.status === "OFFER_SENT" || app.status === "OFFER_ACCEPTED"
                                      ? "Offer Sent"
                                      : "Send Offer"}
                                  </button>

                                  {/* Reject */}
                                  {app.status !== "REJECTED" && app.status !== "WITHDRAWN" && (
                                    <>
                                      <div className="border-t border-white/10 my-1" />
                                      <button
                                        onClick={() => handleOpenRejectModal(app)}
                                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                        title={`Reject ${app.candidateName}`}
                                      >
                                        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                        </svg>
                                        Reject Candidate
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="mx-auto w-12 h-12 text-white/30 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
              <h3 className="text-sm font-medium text-white mb-1">No applications yet</h3>
              <p className="text-sm text-white/50">
                {job.status === "DRAFT" ? "Publish this job to start receiving applications." : "Applications will appear here once candidates apply."}
              </p>
            </div>
          )}
        </div>
      </div>
      {/* ── Feedback Modal ────────────────────────────────────────────────────── */}
      {isReviewModalOpen && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white/5 backdrop-blur-xl rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {selectedBooking.status === "COMPLETED" ? "Interview Review" : "Complete & Review Interview"}
              </h2>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="text-white/40 hover:text-white/60 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6 bg-white/5 rounded-lg p-4 border border-white/10">
                <p className="text-sm text-white/50 mb-1">Candidate</p>
                <p className="font-medium text-white">
                  {applications.find(a => a.id === selectedBooking.applicationId)?.candidateName || "Candidate"}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-white/70 mb-2">Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      disabled={selectedBooking.status === "COMPLETED"}
                      onClick={() => setReviewRating(star)}
                      className={`text-2xl focus:outline-none transition-colors ${star <= reviewRating ? "text-yellow-400" : "text-white/30 hover:text-yellow-200"
                        } ${selectedBooking.status === "COMPLETED" ? "cursor-default" : "cursor-pointer"}`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-white/50 font-medium">{reviewRating} / 5</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Technical Skills (0-10)</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={reviewTechnical ?? ""}
                    onChange={(e) => setReviewTechnical(e.target.value === "" ? undefined : Number(e.target.value))}
                    disabled={selectedBooking.status === "COMPLETED"}
                    className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Problem Solving (0-10)</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={reviewProblemSolving ?? ""}
                    onChange={(e) => setReviewProblemSolving(e.target.value === "" ? undefined : Number(e.target.value))}
                    disabled={selectedBooking.status === "COMPLETED"}
                    className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Communication (0-10)</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={reviewCommunication ?? ""}
                    onChange={(e) => setReviewCommunication(e.target.value === "" ? undefined : Number(e.target.value))}
                    disabled={selectedBooking.status === "COMPLETED"}
                    className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Behavioral & Professionalism (0-10)</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={reviewBehavioral ?? ""}
                    onChange={(e) => setReviewBehavioral(e.target.value === "" ? undefined : Number(e.target.value))}
                    disabled={selectedBooking.status === "COMPLETED"}
                    className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Culture Fit (0-10)</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={reviewCultureFit ?? ""}
                    onChange={(e) => setReviewCultureFit(e.target.value === "" ? undefined : Number(e.target.value))}
                    disabled={selectedBooking.status === "COMPLETED"}
                    className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Recruiter Summary</label>
                  <textarea
                    value={reviewRecruiterSummary}
                    onChange={(e) => setReviewRecruiterSummary(e.target.value)}
                    disabled={selectedBooking.status === "COMPLETED"}
                    className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 min-h-[80px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Detailed Feedback</label>
                  <textarea
                    value={reviewFeedback}
                    onChange={(e) => setReviewFeedback(e.target.value)}
                    disabled={selectedBooking.status === "COMPLETED"}
                    placeholder="How did the interview go?"
                    className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 min-h-[80px] disabled:bg-white/5 disabled:text-white/70"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Strengths</label>
                  <textarea
                    value={reviewStrengths}
                    onChange={(e) => setReviewStrengths(e.target.value)}
                    disabled={selectedBooking.status === "COMPLETED"}
                    placeholder="Comma-separated or bulleted"
                    className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 min-h-[80px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Weaknesses</label>
                  <textarea
                    value={reviewWeaknesses}
                    onChange={(e) => setReviewWeaknesses(e.target.value)}
                    disabled={selectedBooking.status === "COMPLETED"}
                    placeholder="Comma-separated or bulleted"
                    className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 min-h-[80px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Hire Recommendation</label>
                  <select
                    value={reviewHireRecommendation}
                    onChange={(e) => setReviewHireRecommendation(e.target.value)}
                    disabled={selectedBooking.status === "COMPLETED"}
                    className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="Strong Hire">Strong Hire</option>
                    <option value="Hire">Hire</option>
                    <option value="Neutral">Neutral</option>
                    <option value="No Hire">No Hire</option>
                    <option value="Strong No Hire">Strong No Hire</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white/5 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-white/70 bg-transparent border border-white/20 rounded-lg hover:bg-white/5"
              >
                {selectedBooking.status === "COMPLETED" ? "Close" : "Cancel"}
              </button>
              {selectedBooking.status !== "COMPLETED" && (
                <button
                  onClick={handleSubmitReview}
                  disabled={isSubmittingReview || !reviewFeedback.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmittingReview ? "Submitting..." : "Submit Review"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Offer Modal ──────────────────────────────────────────────────────── */}
      {isOfferModalOpen && offerApp && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md"
          onClick={handleCloseOfferModal}
        >
          <div
            className="bg-slate-950 border border-white/10 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                Send Offer to {offerApp.candidateName}
              </h2>
              <button
                onClick={handleCloseOfferModal}
                className="text-white/40 hover:text-white/60 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Offer Message *</label>
                <textarea
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                  placeholder="We are thrilled to offer you..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Salary (Optional)</label>
                  <input
                    type="text"
                    value={offerSalary}
                    onChange={(e) => setOfferSalary(e.target.value)}
                    className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                    placeholder="$100,000 / year"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Start Date (Optional)</label>
                  <input
                    type="date"
                    value={offerStartDate}
                    onChange={(e) => setOfferStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-lg text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 bg-white/5 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={handleCloseOfferModal}
                className="px-4 py-2 text-sm font-medium text-white/70 bg-transparent border border-white/20 rounded-lg hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendOfferSubmit}
                disabled={isSendingOffer || !offerMessage.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
              >
                {isSendingOffer ? "Sending..." : "Send Offer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rejection Modal ──────────────────────────────────────────────────── */}
      {isRejectModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md"
          onClick={handleCloseRejectModal}
        >
          <div
            className="bg-slate-950 border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {isBulkReject ? `Reject ${selectedAppIds.size} Candidates?` : `Reject ${rejectApp?.candidateName}?`}
                  </h2>
                  <p className="text-sm text-white/50 mt-0.5">
                    {isBulkReject
                      ? "A rejection email will be sent to each selected candidate."
                      : `A rejection email will be sent to ${rejectApp?.candidateEmail}.`}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseRejectModal}
                className="text-white/40 hover:text-white/60 transition-colors flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Warning banner */}
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-200">
                  This action cannot be undone. The candidate{isBulkReject ? "s" : ""} will be notified by email.
                </p>
              </div>

              {isBulkReject ? (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/60">
                  Selected candidates will receive the standard rejection email. Reject candidates individually if you want to add a personal message.
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1.5">
                    Message to Candidate
                    <span className="ml-1.5 text-xs font-normal text-white/40">(optional — included in the rejection email)</span>
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={4}
                    placeholder="e.g. We were impressed by your profile, however we are looking for candidates with more experience in..."
                    className="w-full px-3 py-2 text-sm border border-white/20 bg-white/5 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none transition-all resize-none"
                  />
                  <p className="mt-1 text-xs text-white/40">Personalized feedback helps candidates grow professionally and reflects well on your company.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-white/5 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={handleCloseRejectModal}
                className="px-4 py-2 text-sm font-medium text-white/70 bg-transparent border border-white/20 rounded-lg hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReject}
                disabled={isSubmittingReject}
                id="confirm-reject-btn"
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
              >
                {isSubmittingReject ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Rejecting...
                  </>
                ) : (
                  isBulkReject ? `Reject ${selectedAppIds.size} Candidates` : "Reject & Notify"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
