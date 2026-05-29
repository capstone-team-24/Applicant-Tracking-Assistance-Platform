"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { applicationsApi, assessmentsApi, jobsApi, offersApi } from "@/lib/api";
import type {
  Application,
  Assessment,
  AssessmentSubmission,
  ProctoringEvent,
  Job,
} from "@/lib/types";
import ProtectedRoute from "@/components/ProtectedRoute";
import StatusBadge from "@/components/StatusBadge";
import toast from "react-hot-toast";
import { formatDate, formatDateTime } from "@/lib/dateUtils";

const STATUS_ACTIONS: {
  label: string;
  status: string;
  colorClass: string;
  description: string;
}[] = [
    {
      label: "Make Offer",
      status: "OFFERED",
      colorClass: "bg-green-600 hover:bg-green-700 text-white",
      description: "Extend a job offer to this candidate",
    },
    {
      label: "Reject",
      status: "REJECTED",
      colorClass: "bg-red-600 hover:bg-red-700 text-white",
      description: "Decline this application",
    },
  ];

export default function ApplicationDetailPage() {
  const params = useParams();
  const appId = params.appId as string;
  const jobId = params.id as string;

  const [application, setApplication] = useState<Application | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [jobAssessment, setJobAssessment] = useState<Assessment | null>(null);
  const [candidateSubmission, setCandidateSubmission] =
    useState<AssessmentSubmission | null>(null);
  const [proctoringEvents, setProctoringEvents] = useState<ProctoringEvent[]>([]);
  const [isProofOpen, setIsProofOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [isSendingOA, setIsSendingOA] = useState(false);
  const [isSendingInterview, setIsSendingInterview] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerMessage, setOfferMessage] = useState("");
  const [offerSalary, setOfferSalary] = useState("");
  const [offerStartDate, setOfferStartDate] = useState("");
  const [isSendingOffer, setIsSendingOffer] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectMessage, setRejectMessage] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setProctoringEvents([]);
        setCandidateSubmission(null);
        setIsProofOpen(false);
        const app = await applicationsApi.getApplication(appId);
        setApplication(app);

        try {
          const jobData = await jobsApi.getJob(jobId);
          setJob(jobData);
        } catch {
          // Job details are only needed to prefill offer copy.
        }

        // Load the job's assessment and find this candidate's submission
        try {
          const assessments = await assessmentsApi.getAssessmentsByJob(jobId);
          if (assessments.length > 0) {
            const assessment = assessments[0];
            setJobAssessment(assessment);

            const submissions = await assessmentsApi.getSubmissions(
              assessment.id,
            );
            const mine = submissions.find(
              (s) => s.candidateId === app.candidateAuthUserId,
            );
            if (mine) {
              setCandidateSubmission(mine);
              try {
                const events = await assessmentsApi.getProctoringEvents(mine.id);
                setProctoringEvents(events);
              } catch {
                // Proctoring evidence is optional for older submissions.
              }
            }
          }
        } catch {
          // assessment data is optional — don't fail the page
        }
      } catch {
        toast.error("Failed to load application details");
      } finally {
        setIsLoading(false);
      }
    };

    if (appId && jobId) load();
  }, [appId, jobId]);

  const handleStatusUpdate = async (newStatus: string) => {
    if (!application) return;
    setUpdatingStatus(newStatus);
    try {
      const updated = await applicationsApi.updateStatus(appId, newStatus);
      setApplication((prev) =>
        prev ? { ...prev, status: updated.status } : null,
      );
      toast.success(
        `Status updated to ${newStatus.replace(/_/g, " ").toLowerCase()}`,
      );
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleOpenOfferModal = () => {
    if (!application) return;
    const title = job?.title ? ` of ${job.title}` : "";
    setOfferMessage(
      `We are excited to offer you the position${title}. We were impressed by your application and would like to move forward with you.`,
    );
    setOfferSalary("");
    setOfferStartDate("");
    setIsOfferModalOpen(true);
  };

  const handleSendOffer = async () => {
    if (!application || !offerMessage.trim()) return;

    setIsSendingOffer(true);
    try {
      await offersApi.sendOffer(jobId, application.id, {
        offerMessage: offerMessage.trim(),
        salary: offerSalary || undefined,
        startDate: offerStartDate || undefined,
      });

      setApplication((prev) =>
        prev ? { ...prev, status: "OFFER_SENT" } : prev,
      );
      setIsOfferModalOpen(false);
      toast.success(`Offer sent to ${application.candidateName}!`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string; detail?: string } } };
      toast.error(err.response?.data?.message || err.response?.data?.detail || "Failed to send offer");
    } finally {
      setIsSendingOffer(false);
    }
  };

  const handleOpenRejectModal = () => {
    setRejectMessage("");
    setIsRejectModalOpen(true);
  };

  const handleCloseRejectModal = () => {
    setIsRejectModalOpen(false);
    setRejectMessage("");
  };

  const handleRejectApplication = async () => {
    if (!application) return;

    setIsRejecting(true);
    try {
      const rejected = await applicationsApi.rejectApplication(appId, {
        reason: rejectMessage.trim() || undefined,
      });

      setApplication((prev) =>
        prev
          ? {
              ...prev,
              status: rejected.status,
              rejectionReason: rejected.rejectionReason,
              rejectedAt: rejected.rejectedAt,
              rejectedBy: rejected.rejectedBy,
            }
          : null,
      );
      handleCloseRejectModal();

      if (rejected.rejectionEmailSent === false) {
        toast.error(`${application.candidateName} was rejected, but the email could not be sent.`);
      } else {
        toast.success(`${application.candidateName} has been rejected and notified via email.`);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string; message?: string } } };
      toast.error(err.response?.data?.detail || err.response?.data?.message || "Failed to reject candidate");
    } finally {
      setIsRejecting(false);
    }
  };

  const handleSendOA = async () => {
    if (!jobAssessment) {
      toast.error("No assessment configured for this job.");
      return;
    }
    setIsSendingOA(true);
    try {
      const res = await applicationsApi.sendOA(appId, {
        assessmentToken: jobAssessment.accessToken,
        assessmentTitle: jobAssessment.title,
        timeLimitMinutes: jobAssessment.timeLimitMinutes,
      });
      if (res.sent > 0) {
        toast.success(
          isAssessmentDisqualified
            ? "Disqualification cleared and OA invite sent successfully!"
            : "OA invite sent successfully!",
        );
        const updated = await applicationsApi.getApplication(appId);
        setApplication(updated);
        if (isAssessmentDisqualified) {
          setCandidateSubmission((prev) =>
            prev
              ? {
                  ...prev,
                  answers: [],
                  score: undefined,
                  scoringDetails: undefined,
                  status: "IN_PROGRESS",
                  strikeCount: 0,
                  disqualifiedAt: undefined,
                  submittedAt: undefined,
                  scoredAt: undefined,
                }
              : prev,
          );
          setProctoringEvents([]);
          setIsProofOpen(false);
        }
      } else {
        toast.error(res.skippedReasons?.[0] || "Could not send OA invite.");
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string; message?: string } } };
      toast.error(err.response?.data?.detail || err.response?.data?.message || "Failed to send OA invite");
    } finally {
      setIsSendingOA(false);
    }
  };

  const handleSendInterviewInvite = async () => {
    setIsSendingInterview(true);
    try {
      const res = await applicationsApi.sendInterviewInvite(appId);
      if (res.sent > 0) {
        toast.success("Interview invite sent successfully!");
        const updated = await applicationsApi.getApplication(appId);
        setApplication(updated);
      } else {
        toast.error(res.skippedReasons?.[0] || "Could not send interview invite.");
      }
    } catch {
      toast.error("Failed to send interview invite");
    } finally {
      setIsSendingInterview(false);
    }
  };

  const handleDownload = async () => {
    if (!application?.originalFilename) return;
    try {
      const blob = await applicationsApi.downloadFile(appId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = application.originalFilename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download file");
    }
  };

  const isAssessmentDisqualified =
    candidateSubmission?.status === "DISQUALIFIED" ||
    Boolean(candidateSubmission?.disqualifiedAt);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <ProtectedRoute requiredRole="RECRUITER">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-white/10 rounded w-48" />
            <div className="h-8 bg-white/10 rounded w-1/3" />
            <div className="grid grid-cols-3 gap-6 mt-6">
              <div className="col-span-2 space-y-4">
                <div className="h-40 bg-white/10 rounded-xl" />
                <div className="h-32 bg-white/10 rounded-xl" />
              </div>
              <div className="space-y-4">
                <div className="h-32 bg-white/10 rounded-xl" />
                <div className="h-48 bg-white/10 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!application) {
    return (
      <ProtectedRoute requiredRole="RECRUITER">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <svg
            className="mx-auto w-16 h-16 text-white/30 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
          <p className="text-white/60 mb-4">Application not found.</p>
          <Link
            href={`/recruiter/jobs/${jobId}`}
            className="text-primary-600 font-medium hover:text-primary-500"
          >
            Back to job
          </Link>
        </div>
      </ProtectedRoute>
    );
  }

  const snapshot = application.candidateProfileSnapshot as
    | Record<string, unknown>
    | undefined;

  const initials = (application.candidateName || "?")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <ProtectedRoute requiredRole="RECRUITER">
      <div
        className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 transition-all duration-500"
        style={{ backgroundImage: `url(/bk2.jpg)` }}
      >
        {/* Liquid Overlays */}
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-[2px]" />
        <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-6xl">
          {/* ── Breadcrumb ── */}
          <nav className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40 mb-8 ml-2">
            <Link
              href="/dashboard"
              className="hover:text-blue-400 transition-colors"
            >
              Dashboard
            </Link>
            <span className="text-white/60">/</span>
            <Link
              href={`/recruiter/jobs/${jobId}`}
              className="hover:text-blue-400 transition-colors"
            >
              Job
            </Link>
            <span className="text-white/60">/</span>
            <span className="text-white truncate max-w-[200px]">
              {application.candidateName || "Application"}
            </span>
          </nav>

          {/* ── Candidate Header ── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 px-2">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-2xl shadow-lg shadow-blue-900/20 backdrop-blur-md">
                {initials}
              </div>
              <div className="min-w-0">
                <h1 className="text-4xl font-bold text-white tracking-tight drop-shadow-md">
                  {application.candidateName || "Unknown Candidate"}
                </h1>
                <p className="text-white/40 font-medium mt-1">
                  {application.candidateEmail}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-xl">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                Status
              </span>
              <StatusBadge status={application.status} type="application" />
            </div>
          </div>

          {/* ── Two-column Layout ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT COLUMN */}
            <div className="lg:col-span-2 space-y-8">
              {/* Contact Information */}
              <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-3xl shadow-xl">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-6 border-b border-white/10 pb-4">
                  Contact Information
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <dt className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">
                      Email Address
                    </dt>
                    <dd className="text-white font-medium break-all">
                      {application.candidateEmail}
                    </dd>
                  </div>
                  {application.contactPhone && (
                    <div className="space-y-1">
                      <dt className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">
                        Phone Number
                      </dt>
                      <dd className="text-white font-medium">
                        {application.contactPhone}
                      </dd>
                    </div>
                  )}
                  {application.createdAt && (
                    <div className="space-y-1">
                      <dt className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">
                        Applied On
                      </dt>
                      <dd className="text-white font-medium">
                        {formatDate(application.createdAt)}
                      </dd>
                    </div>
                  )}
                  {snapshot?.yearsOfExperience != null && (
                    <div className="space-y-1">
                      <dt className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">
                        Experience
                      </dt>
                      <dd className="text-white font-medium">
                        {String(snapshot.yearsOfExperience)} year
                        {snapshot.yearsOfExperience !== 1 ? "s" : ""}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Cover Letter */}
              {application.coverLetter && (
                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-3xl shadow-xl">
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
                    Cover Letter
                  </h3>
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                    <p className="text-sm text-white/30 whitespace-pre-wrap leading-relaxed italic">
                      "{application.coverLetter}"
                    </p>
                  </div>
                </div>
              )}

              {/* Portfolio Links */}
              {application.portfolioLinks &&
                application.portfolioLinks.filter(Boolean).length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-3xl shadow-xl">
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
                      Portfolio / Links
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {application.portfolioLinks
                        .filter(Boolean)
                        .map((link, i) => (
                          <a
                            key={i}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs font-bold text-blue-400 hover:bg-blue-500/20 transition-all"
                          >
                            {link.replace(/^https?:\/\//, "")}
                          </a>
                        ))}
                    </div>
                  </div>
                )}

              {/* Assessment Score */}
              {jobAssessment && (
                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-3xl shadow-xl">
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-6">
                    Assessment:{" "}
                    <span className="text-white">{jobAssessment.title}</span>
                  </h3>

                  {candidateSubmission ? (
                    <div className="space-y-8">
                      <div className="flex items-center gap-8 bg-white/5 p-6 rounded-2xl border border-white/5">
                        <div className="text-center">
                          <p
                            className={`text-5xl font-black ${(candidateSubmission.score ?? 0) >= 70
                                ? "text-emerald-400"
                                : (candidateSubmission.score ?? 0) >= 40
                                  ? "text-amber-400"
                                  : "text-rose-400"
                              }`}
                          >
                            {candidateSubmission.score != null
                              ? `${Math.round(candidateSubmission.score)}%`
                              : "—"}
                          </p>
                          <p className="text-[10px] font-bold text-white/50 uppercase mt-1">
                            Final Score
                          </p>
                        </div>
                        <div className="h-12 w-px bg-white/10" />
                        <div className="flex-1">
                          <StatusBadge
                            status={candidateSubmission.status}
                            type="assessment"
                          />
                          {candidateSubmission.submittedAt && (
                            <p className="text-xs text-white/50 mt-2 font-medium">
                              Submitted{" "}
                              {formatDateTime(candidateSubmission.submittedAt)}
                            </p>
                          )}
                        </div>
                      </div>

                      {candidateSubmission.scoringDetails &&
                        candidateSubmission.scoringDetails.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest ml-1">
                              Score Breakdown
                            </p>
                            {candidateSubmission.scoringDetails.map((d, i) => (
                              <div
                                key={d.questionId}
                                className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5 transition-hover hover:bg-white/10"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-bold text-white/50">
                                    Q{i + 1}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md font-bold uppercase tracking-tighter border border-blue-500/20">
                                    {d.questionType}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <div className="w-32 bg-white/10 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className="bg-blue-500 h-full rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                      style={{
                                        width: `${(d.score / d.maxScore) * 100}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold text-white w-12 text-right">
                                    {d.score}/{d.maxScore}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                      {isAssessmentDisqualified && (
                        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-black uppercase tracking-tight text-red-200">
                                Candidate disqualified
                              </p>
                              <p className="mt-1 text-xs font-medium text-white/55">
                                Review the proctoring offenses and captured evidence used for this decision.
                              </p>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <button
                                type="button"
                                onClick={() => setIsProofOpen((open) => !open)}
                                className="rounded-xl bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-950 transition hover:bg-white/90 active:scale-95"
                              >
                                {isProofOpen ? "Hide Proof" : "View Proof"}
                              </button>
                              <button
                                type="button"
                                onClick={handleSendOA}
                                disabled={isSendingOA || !jobAssessment}
                                className="rounded-xl bg-indigo-500 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-indigo-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {isSendingOA ? "Sending..." : "Clear & Resend OA"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {isAssessmentDisqualified && isProofOpen && (
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest ml-1">
                            Proctoring Offense Log
                          </p>
                          {proctoringEvents.length > 0 ? (
                            proctoringEvents.map((event) => (
                              <div
                                key={event.id}
                                className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-black text-red-200 uppercase tracking-tight">
                                      {event.reason || event.eventType}
                                    </p>
                                    <p className="text-[10px] text-white/45 font-bold uppercase tracking-widest mt-1">
                                      {event.strikeType || event.eventType}
                                      {event.strikeCount ? ` · Strike ${event.strikeCount}` : ""}
                                    </p>
                                  </div>
                                  <p className="text-[10px] text-white/45 font-bold uppercase tracking-widest">
                                    {formatDateTime(event.timestamp)}
                                  </p>
                                </div>

                                {(event.evidence?.webcamPhoto || event.evidence?.screenCapture) && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                                    {event.evidence.webcamPhoto && (
                                      <div>
                                        <p className="text-[9px] text-white/40 font-black uppercase tracking-widest mb-2">
                                          Webcam
                                        </p>
                                        <img
                                          src={event.evidence.webcamPhoto.dataUrl}
                                          alt="Candidate webcam evidence"
                                          className="w-full rounded-xl border border-white/10 bg-black/30"
                                        />
                                      </div>
                                    )}
                                    {event.evidence.screenCapture && (
                                      <div>
                                        <p className="text-[9px] text-white/40 font-black uppercase tracking-widest mb-2">
                                          Screen
                                        </p>
                                        <img
                                          src={event.evidence.screenCapture.dataUrl}
                                          alt="Candidate screen evidence"
                                          className="w-full rounded-xl border border-white/10 bg-black/30"
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}

                                {(event.evidence?.webcamUnavailableReason ||
                                  event.evidence?.screenCaptureUnavailableReason) && (
                                  <div className="mt-3 space-y-1 text-[10px] text-white/45 font-medium">
                                    {event.evidence.webcamUnavailableReason && (
                                      <p>{event.evidence.webcamUnavailableReason}</p>
                                    )}
                                    {event.evidence.screenCaptureUnavailableReason && (
                                      <p>{event.evidence.screenCaptureUnavailableReason}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/50">
                              No proctoring proof was recorded for this attempt.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 text-sm text-white/40 bg-white/5 p-6 rounded-2xl border border-white/5 border-dashed">
                      <svg
                        className="w-6 h-6 text-white/60"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                        />
                      </svg>
                      Assessment pending candidate action.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-8">
              {/* Ranking & Composite */}
              {(application.compositeScore != null ||
                application.rankingPosition != null) && (
                  <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-3xl shadow-xl text-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {application.rankingPosition != null && (
                      <div className="mb-6">
                        <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">
                          Ranking Position
                        </p>
                        <p className="text-6xl font-black text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                          #{application.rankingPosition}
                        </p>
                      </div>
                    )}
                    {application.compositeScore != null && (
                      <div
                        className={
                          application.rankingPosition != null
                            ? "pt-6 border-t border-white/10"
                            : ""
                        }
                      >
                        <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">
                          Composite Score
                        </p>
                        <p className="text-4xl font-bold text-white">
                          {Math.round(application.compositeScore)}
                          <span className="text-lg font-medium text-white/50 ml-1">
                            /100
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                )}

              {/* Submitted File */}
              {application.originalFilename && (
                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-3xl shadow-xl">
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
                    Submitted File
                  </h3>
                  <button
                    onClick={handleDownload}
                    className="w-full flex items-center gap-3 px-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-blue-400 hover:bg-blue-600/10 hover:border-blue-500/50 transition-all group"
                  >
                    <svg
                      className="w-5 h-5 flex-shrink-0 text-blue-500 group-hover:scale-110 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                      />
                    </svg>
                    <span className="truncate">{application.originalFilename}</span>
                  </button>
                </div>
              )}

              {/* Status Actions */}
              <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-3xl shadow-xl">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
                  Update Status
                </h3>
                <div className="space-y-3">
                  {STATUS_ACTIONS.map(
                    ({ label, status, colorClass, description }) => {
                      const isOfferAction = status === "OFFERED";
                      const isRejectAction = status === "REJECTED";
                      const isCurrent = isOfferAction
                        ? application.status === "OFFER_SENT" || application.status === "OFFER_ACCEPTED"
                        : application.status === status;
                      const isUpdating = updatingStatus === status;
                      const isDisabled = isCurrent || updatingStatus !== null || isSendingOffer || isRejecting;

                      return (
                        <button
                          key={status}
                          onClick={() => {
                            if (isCurrent || updatingStatus) return;
                            if (isOfferAction) {
                              handleOpenOfferModal();
                              return;
                            }
                            if (isRejectAction) {
                              handleOpenRejectModal();
                              return;
                            }
                            handleStatusUpdate(status);
                          }}
                          disabled={isDisabled}
                          title={description}
                          className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-bold transition-all border
                            ${isCurrent ? "bg-white/10 border-white/20 text-white cursor-default" : "bg-white/5 border-white/5 text-white/40 hover:bg-white/15 hover:text-white cursor-pointer"}
                            ${isDisabled && !isCurrent ? "opacity-20 grayscale" : ""}`}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${colorClass.split(" ")[0]}`}
                            />
                            {label}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-black uppercase text-blue-400 tracking-tighter">
                              Active
                            </span>
                          )}
                          {isUpdating && (
                            <svg
                              className="animate-spin h-4 w-4 text-blue-500"
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
                          )}
                        </button>
                      );
                    },
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-white/10">
                  <button
                    onClick={() => handleStatusUpdate("WITHDRAWN")}
                    disabled={
                      application.status === "WITHDRAWN" ||
                      updatingStatus !== null
                    }
                    className="w-full px-4 py-3 rounded-xl text-xs font-bold text-white/50 border border-white/5 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 disabled:opacity-20 transition-all uppercase tracking-widest"
                  >
                    {application.status === "WITHDRAWN"
                      ? "Withdrawn"
                      : "Withdraw Application"}
                  </button>
                </div>
              </div>

              {/* Manual Invites */}
              <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-3xl shadow-xl">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">
                  Manual Invites
                </h3>
                <p className="text-[10px] text-white/50 mb-5 leading-relaxed">
                  Override AI ranking to manually send invites to this candidate.
                </p>

                <div className="space-y-3">
                  {/* Send OA */}
                  <button
                    id="send-oa-btn"
                    onClick={handleSendOA}
                    disabled={isSendingOA || !jobAssessment || updatingStatus !== null}
                    title={
                      !jobAssessment
                        ? "No assessment configured for this job"
                        : isAssessmentDisqualified
                          ? "Clear disqualification and send a fresh OA invite"
                          : "Send OA invite to this candidate"
                    }
                    className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-bold bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/25 hover:border-indigo-400/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center gap-2">
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
                          d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"
                        />
                      </svg>
                      {isAssessmentDisqualified ? "Clear & Resend OA" : "Send OA Invite"}
                    </span>
                    {isSendingOA && (
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
                    )}
                  </button>

                  {!jobAssessment && (
                    <p className="text-[10px] text-amber-500/80 flex items-center gap-1.5 pl-1">
                      <svg
                        className="w-3.5 h-3.5 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                        />
                      </svg>
                      Create an assessment first
                    </p>
                  )}

                  {/* Send Interview Invite */}
                  <button
                    id="send-interview-btn"
                    onClick={handleSendInterviewInvite}
                    disabled={isSendingInterview || updatingStatus !== null}
                    title="Send interview invite to this candidate"
                    className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-400/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <span className="flex items-center gap-2">
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
                          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                        />
                      </svg>
                      Send Interview Invite
                    </span>
                    {isSendingInterview && (
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
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isOfferModalOpen && application && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-950/95 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Make Offer to {application.candidateName}
                </h2>
                <p className="text-sm text-white/50 mt-1">
                  This sends an offer email and moves the candidate to Offer Sent.
                </p>
              </div>
              <button
                onClick={() => setIsOfferModalOpen(false)}
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
                  onChange={(event) => setOfferMessage(event.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-white"
                  placeholder="We are thrilled to offer you..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Salary</label>
                  <input
                    type="text"
                    value={offerSalary}
                    onChange={(event) => setOfferSalary(event.target.value)}
                    className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-white"
                    placeholder="$100,000 / year"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={offerStartDate}
                    onChange={(event) => setOfferStartDate(event.target.value)}
                    className="w-full px-3 py-2 border border-white/20 bg-white/5 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-white"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-white/5 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => setIsOfferModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-white/70 bg-transparent border border-white/20 rounded-lg hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendOffer}
                disabled={isSendingOffer || !offerMessage.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSendingOffer ? "Sending..." : "Send Offer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isRejectModalOpen && application && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md"
          onClick={handleCloseRejectModal}
        >
          <div
            className="bg-slate-950 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-6 border-b border-white/10 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                  <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Reject {application.candidateName}?
                  </h2>
                  <p className="text-sm text-white/50 mt-0.5">
                    A rejection email will be sent to {application.candidateEmail}.
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

            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-200">
                  This action cannot be undone. The candidate will be notified by email.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1.5">
                  Message to Candidate
                  <span className="ml-1.5 text-xs font-normal text-white/40">(optional — included in the rejection email)</span>
                </label>
                <textarea
                  value={rejectMessage}
                  onChange={(event) => setRejectMessage(event.target.value)}
                  rows={4}
                  placeholder="e.g. We were impressed by your profile, however we are looking for candidates with more experience in..."
                  className="w-full px-3 py-2 text-sm border border-white/20 bg-white/5 rounded-lg text-white placeholder-white/40 focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none transition-all resize-none"
                />
                <p className="mt-1 text-xs text-white/40">
                  Personalized feedback helps candidates grow professionally and reflects well on your company.
                </p>
              </div>
            </div>

            <div className="p-4 bg-white/5 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={handleCloseRejectModal}
                className="px-4 py-2 text-sm font-medium text-white/70 bg-transparent border border-white/20 rounded-lg hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectApplication}
                disabled={isRejecting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
              >
                {isRejecting ? "Rejecting..." : "Reject & Notify"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
