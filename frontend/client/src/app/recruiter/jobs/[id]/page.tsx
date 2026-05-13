"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  jobsApi,
  applicationsApi,
  rankingApi,
  assessmentsApi,
  interviewsApi,
  integrationsApi,
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
  type: "MCQ" | "SHORT_ANSWER" | "CODE";
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

  // ── table state ───────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<"rank" | "score" | "oaScore" | "name">("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [sendingOAForApp, setSendingOAForApp] = useState<string | null>(null);
  const [sendingInterviewForApp, setSendingInterviewForApp] = useState<string | null>(null);

  // assessment form
  const [assessmentTitle, setAssessmentTitle] = useState(
    "Technical Assessment",
  );
  const [assessmentDescription, setAssessmentDescription] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60);
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
    setIsGenerating(true);
    try {
      const res = await assessmentsApi.generateAssessment(jobId);
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
        applicationDeadline: editJobDeadlineVal ? toBackendDatetime(editJobDeadlineVal) : undefined,
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
    setIsReviewModalOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!jobId || !selectedBooking) return;
    setIsSubmittingReview(true);
    try {
      await interviewsApi.completeBooking(jobId, selectedBooking.id, {
        rating: reviewRating,
        feedback: reviewFeedback,
      });
      toast.success("Interview marked as completed and feedback saved.");
      setIsReviewModalOpen(false);
      // refresh bookings
      const bRes = await interviewsApi.getJobBookings(jobId);
      setBookings(bRes);
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
    setOpenDropdownId(null);
    try {
      const res = await applicationsApi.sendInterviewInvite(app.id);
      if (res.sent > 0) {
        toast.success(`Interview invite sent to ${app.candidateName}!`);
        fetchApplications();
      } else {
        toast.error(res.skippedReasons?.[0] || "Could not send interview invite.");
      }
    } catch {
      toast.error("Failed to send interview invite");
    } finally {
      setSendingInterviewForApp(null);
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

  const addQuestion = () => setQuestions((prev) => [...prev, emptyQuestion()]);

  const removeQuestion = (idx: number) =>
    setQuestions((prev) => prev.filter((_, i) => i !== idx));

  // ── stats ─────────────────────────────────────────────────────────────────
  const statusCounts = applications.reduce(
    (acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // ── loading skeleton ──────────────────────────────────────────────────────
  if (isLoadingJob) {
    return (
      <ProtectedRoute requiredRole="RECRUITER">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="grid grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded-lg" />
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
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
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
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
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
          <span className="text-gray-900">{job.title}</span>
        </nav>

        {/* ── Job Header ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {job.title}
                </h1>
                <StatusBadge status={job.status} type="job" />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
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
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      (parseDate(job.applicationDeadline) || new Date()) < new Date()
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                      {(parseDate(job.applicationDeadline) || new Date()) < new Date()
                        ? `Closed — deadline was ${formatDateTime(job.applicationDeadline)}`
                        : `Applications close: ${formatDateTime(job.applicationDeadline)}`
                      }
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">No application deadline set</span>
                  )}
                  <button
                    onClick={() => {
                      const d = parseDate(job.applicationDeadline);
                      // Use local time so the datetime-local input pre-fills correctly
                      setEditJobDeadlineVal(d ? toLocalInputValue(d) : "");
                      setIsEditingJobDeadline(true);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
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
                    className="px-2 py-1 text-xs border border-gray-300 rounded"
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
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
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

        {/* ── Status Counts ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          {[
            {
              label: "Total",
              value: applications.length,
              color: "text-gray-900",
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
              className="bg-white rounded-lg border border-gray-200 p-4 text-center"
            >
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Online Assessment ────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Online Assessment
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                One assessment per job — share the link with any candidate.
              </p>
            </div>
            {!jobAssessment && !showCreateAssessment && (
              <button
                onClick={async () => {
                  if (questions.length === 1 && questions[0].text === "") {
                    await handleGenerateAI();
                  }
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
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-indigo-900">
                      {jobAssessment.title}
                    </p>
                    {jobAssessment.description && (
                      <p className="text-sm text-indigo-700 mt-0.5">
                        {jobAssessment.description}
                      </p>
                    )}
                    <p className="text-xs text-indigo-600 mt-1">
                      {jobAssessment.questions.length} question
                      {jobAssessment.questions.length !== 1
                        ? "s"
                        : ""} &middot; {jobAssessment.timeLimitMinutes} min time
                      limit
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleEditAssessment}
                        className="text-xs bg-white text-indigo-600 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-50 flex items-center gap-1"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={handleDeleteAssessment}
                        className="text-xs bg-white text-red-600 px-2 py-1 rounded border border-red-200 hover:bg-red-50 flex items-center gap-1"
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
                  <p className="text-xs font-medium text-indigo-700 mb-1">
                    Candidate link — share this with applicants:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 text-xs bg-white border border-indigo-200 rounded px-2 py-1.5 truncate text-indigo-900">
                      {assessmentLink}
                    </code>
                    <button
                      onClick={copyAssessmentLink}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-white border border-indigo-300 rounded hover:bg-indigo-50 transition-colors"
                    >
                      {copied ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-indigo-100 space-y-3">
                  {/* OA Deadline picker */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-indigo-900 whitespace-nowrap">
                      OA Deadline
                      <span className="ml-1 text-xs font-normal text-indigo-400">(optional)</span>
                    </span>
                    <input
                      type="datetime-local"
                      value={oaDeadline}
                      onChange={(e) => setOaDeadline(e.target.value)}
                      min={nowLocalInputValue()}
                      className="px-2 py-1 text-sm border border-indigo-200 rounded text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-400"
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
                    <span className="text-sm font-medium text-indigo-900">Send OA to top</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={inviteTopN}
                      onChange={(e) => setInviteTopN(Number(e.target.value))}
                      className="w-16 px-2 py-1 text-sm border border-indigo-200 rounded"
                    />
                    <span className="text-sm font-medium text-indigo-900">candidates</span>
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
            <div className="border border-gray-200 rounded-lg p-5 space-y-5">
              {/* Title + time limit
                    </p>
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button onClick={handleEditAssessment} className="text-xs bg-white text-indigo-600 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-50 flex items-center gap-1">✏️ Edit</button>
                      <button onClick={handleDeleteAssessment} className="text-xs bg-white text-red-600 px-2 py-1 rounded border border-red-200 hover:bg-red-50 flex items-center gap-1">🗑️ Delete</button>
                    </div> */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assessment Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={assessmentTitle}
                    onChange={(e) => setAssessmentTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g. Technical Screening"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <input
                  value={assessmentDescription}
                  onChange={(e) => setAssessmentDescription(e.target.value)}
                  placeholder="Describe what this assessment covers…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Questions */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Questions
                </p>
                <div className="space-y-4">
                  {questions.map((q, qi) => (
                    <div
                      key={qi}
                      className="border border-gray-200 rounded-lg p-4 space-y-3"
                    >
                      {/* Question meta row */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-semibold text-gray-400 w-6">
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
                          className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                        >
                          <option value="MCQ">Multiple Choice</option>
                          <option value="SHORT_ANSWER">Short Answer</option>
                          <option value="CODE">Code</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-gray-500">
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
                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />

                      {/* MCQ options */}
                      {q.type === "MCQ" && (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500">
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
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
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
              <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
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
                  className="px-5 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!jobAssessment && !showCreateAssessment && (
            <p className="text-sm text-gray-400">
              No assessment created yet. Create one to screen candidates with
              multiple-choice, short-answer, or coding questions.
            </p>
          )}
        </div>

        {/* ── Candidate Ranking ────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
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
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={rankingStatus.status} type="ranking" />
                {rankingStatus.progress !== undefined && (
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-2">
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
            <p className="text-sm text-gray-400">
              {job.status === "DRAFT"
                ? "Publish this job first to start receiving applications."
                : "No applications yet. Ranking will be available once candidates apply."}
            </p>
          )}
        </div>

        {/* ── OA Results & Interview Invites ───────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            OA Results & Interview Invites
          </h2>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Top N Candidates
              </label>
              <input
                type="number"
                min="1"
                value={interviewTopN}
                onChange={(e) => setInterviewTopN(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Score
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={interviewMinScore}
                onChange={(e) => setInterviewMinScore(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex-1 min-w-[220px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Booking Deadline
                <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={interviewDeadline}
                  onChange={(e) => setInterviewDeadline(e.target.value)}
                  min={nowLocalInputValue()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
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
            <p className="mt-2 text-sm text-gray-500">
              No assessment configured for this job yet.
            </p>
          )}
        </div>

        {/* ── Interview Scheduling ─────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Interview Scheduling
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Add Available Slots</h3>
              {!isGoogleConnected ? (
                <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mb-3">
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
                  className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    disabled={!isGoogleConnected}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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

              <h3 className="text-sm font-medium text-gray-700 mt-6 mb-3">Available Slots</h3>
              {slots.filter(s => s.status === "AVAILABLE").length === 0 ? (
                <p className="text-sm text-gray-500">No available slots.</p>
              ) : (
                <ul className="space-y-2 max-h-[200px] overflow-y-auto">
                  {slots.filter(s => s.status === "AVAILABLE").map(slot => (
                    <li key={slot.id} className="text-sm px-3 py-2 bg-gray-50 rounded-md border border-gray-200 text-gray-700">
                      {formatDateTime(slot.startTime)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <div className="md:col-span-2 mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Scheduled Interviews</h3>
              {bookings.length === 0 ? (
                <p className="text-sm text-gray-500">No interviews booked yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidate</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meeting</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {bookings.map((booking) => {
                        const slot = slots.find((s) => s.id === booking.slotId);
                        const app = applications.find((a) => a.id === booking.applicationId);
                        return (
                          <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Link href={`/recruiter/jobs/${jobId}/applications/${app?.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-900">
                                {app?.candidateName || "Candidate"}
                              </Link>
                              <div className="text-xs text-gray-500">{app?.candidateEmail}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                              {slot ? formatDateTime(slot.startTime) : "Unknown Time"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {booking.meetingLink ? (
                                <a href={booking.meetingLink} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-900 underline">
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
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                  {booking.status}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                              {booking.status === "SCHEDULED" && (
                                <button
                                  onClick={() => handleOpenReviewModal(booking)}
                                  className="text-indigo-600 hover:text-indigo-900 font-medium"
                                >
                                  Complete & Review
                                </button>
                              )}
                              {booking.status === "COMPLETED" && (
                                <button
                                  onClick={() => handleOpenReviewModal(booking)}
                                  className="text-gray-600 hover:text-gray-900 font-medium"
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

        {/* ── Applications Table ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Applications ({applications.length})
            </h2>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Filter Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="ALL">All</option>
                <option value="APPLIED">Applied</option>
                <option value="SCREENED">Screened</option>
                <option value="OA_INVITED">OA Invited</option>
                <option value="OA_COMPLETED">OA Completed</option>
                <option value="INTERVIEW_INVITED">Interview Invited</option>
                <option value="INTERVIEW_SCHEDULED">Interview Scheduled</option>
                <option value="INTERVIEW_COMPLETED">Interview Completed</option>
                <option value="OFFERED">Offered</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {isLoadingApps ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse border rounded-lg p-5 h-16 bg-gray-50" />
              ))}
            </div>
          ) : applications.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => { setSortField("rank"); setSortDir(sortDir === "asc" ? "desc" : "asc"); }}>
                      Rank {sortField === "rank" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => { setSortField("name"); setSortDir(sortDir === "asc" ? "desc" : "asc"); }}>
                      Candidate {sortField === "name" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => { setSortField("score"); setSortDir(sortDir === "asc" ? "desc" : "asc"); }}>
                      CV Score {sortField === "score" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => { setSortField("oaScore"); setSortDir(sortDir === "asc" ? "desc" : "asc"); }}>
                      OA Status / Score {sortField === "oaScore" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      App Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {applications
                    .filter((app) => statusFilter === "ALL" || app.status === statusFilter)
                    .sort((a, b) => {
                      const aSub = assessmentSubmissions.find((s) => s.candidateId === a.candidateAuthUserId);
                      const bSub = assessmentSubmissions.find((s) => s.candidateId === b.candidateAuthUserId);
                      const aOa = aSub?.score ?? -1;
                      const bOa = bSub?.score ?? -1;
                      const aRank = a.rankingPosition ?? 999999;
                      const bRank = b.rankingPosition ?? 999999;
                      const aScore = a.compositeScore ?? 0;
                      const bScore = b.compositeScore ?? 0;

                      let diff = 0;
                      if (sortField === "rank") diff = aRank - bRank;
                      else if (sortField === "score") diff = aScore - bScore;
                      else if (sortField === "oaScore") diff = aOa - bOa;
                      else if (sortField === "name") diff = (a.candidateName || "").localeCompare(b.candidateName || "");

                      return sortDir === "asc" ? diff : -diff;
                    })
                    .map((app) => {
                      const submission = assessmentSubmissions.find(
                        (s) => s.candidateId === app.candidateAuthUserId
                      );
                      const detailHref = `/recruiter/jobs/${jobId}/applications/${app.id}`;
                      
                      return (
                        <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {app.rankingPosition ? `#${app.rankingPosition}` : "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{app.candidateName}</div>
                            <div className="text-sm text-gray-500">{app.candidateEmail}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {app.compositeScore != null ? (
                              <span className="font-semibold text-primary-600">{Math.round(app.compositeScore)}</span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {submission ? (
                              <div className="flex flex-col items-start gap-1">
                                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                  {submission.status.replace("_", " ")}
                                </span>
                                {submission.score != null && (
                                  <span className="font-bold text-indigo-600 text-base">
                                    {Math.round(submission.score)}<span className="text-xs text-gray-400 font-normal">/100</span>
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
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
                                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40"
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
                                  className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1 animate-in fade-in zoom-in-95 duration-100"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {/* View Details */}
                                  <Link
                                    href={detailHref}
                                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    onClick={() => setOpenDropdownId(null)}
                                  >
                                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                                    </svg>
                                    View Details
                                  </Link>

                                  <div className="border-t border-gray-100 my-1" />

                                  {/* Send OA */}
                                  <button
                                    onClick={() => handleSendOAToApp(app)}
                                    disabled={!jobAssessment}
                                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
              <svg className="mx-auto w-12 h-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
              <h3 className="text-sm font-medium text-gray-900 mb-1">No applications yet</h3>
              <p className="text-sm text-gray-500">
                {job.status === "DRAFT" ? "Publish this job to start receiving applications." : "Applications will appear here once candidates apply."}
              </p>
            </div>
          )}
        </div>
      </div>
      {/* ── Feedback Modal ────────────────────────────────────────────────────── */}
      {isReviewModalOpen && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedBooking.status === "COMPLETED" ? "Interview Review" : "Complete & Review Interview"}
              </h2>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Candidate</p>
                <p className="font-medium text-gray-900">
                  {applications.find(a => a.id === selectedBooking.applicationId)?.candidateName || "Candidate"}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      disabled={selectedBooking.status === "COMPLETED"}
                      onClick={() => setReviewRating(star)}
                      className={`text-2xl focus:outline-none transition-colors ${
                        star <= reviewRating ? "text-yellow-400" : "text-gray-300 hover:text-yellow-200"
                      } ${selectedBooking.status === "COMPLETED" ? "cursor-default" : "cursor-pointer"}`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="ml-2 text-sm text-gray-500 font-medium">{reviewRating} / 5</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Detailed Feedback</label>
                <textarea
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  disabled={selectedBooking.status === "COMPLETED"}
                  placeholder="How did the interview go? What were their strengths and weaknesses?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 min-h-[120px] disabled:bg-gray-50 disabled:text-gray-700"
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
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
    </ProtectedRoute>
  );
}
