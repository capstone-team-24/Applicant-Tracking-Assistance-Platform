"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { jobsApi, profilesApi, applicationsApi, assessmentsApi, interviewsApi, integrationsApi } from "@/lib/api";
import type { Job, Application, Profile, ReceivedAssessmentInvite, InterviewInvite, CandidateBookingResponse } from "@/lib/types";
import ProtectedRoute from "@/components/ProtectedRoute";
import JobCard from "@/components/JobCard";
import StatusBadge from "@/components/StatusBadge";
import FileUpload from "@/components/FileUpload";
import toast from "react-hot-toast";
import { formatDate, formatDateTime } from "@/lib/dateUtils";

function CandidateDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [invites, setInvites] = useState<ReceivedAssessmentInvite[]>([]);
  const [interviewInvites, setInterviewInvites] = useState<InterviewInvite[]>([]);
  const [myBookings, setMyBookings] = useState<CandidateBookingResponse[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [isLoadingInvites, setIsLoadingInvites] = useState(true);
  const [isLoadingInterviews, setIsLoadingInterviews] = useState(true);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await profilesApi.getMe();
      setProfile(data);
    } catch {
      // Profile might not exist yet
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    // Fetch candidate's applications
    const fetchApps = async () => {
      try {
        const response = await applicationsApi.getMyApplications({ pageSize: 50 });
        setApplications(response.content || []);
      } catch (error) {
        console.error("Failed to load applications:", error);
      } finally {
        setIsLoadingApps(false);
      }
    };
    fetchApps();

    const fetchInvites = async () => {
      try {
        const data = await assessmentsApi.getReceivedInvites();
        setInvites(data || []);
      } catch (error) {
        console.error("Failed to load assessment invites:", error);
      } finally {
        setIsLoadingInvites(false);
      }
    };
    fetchInvites();

    const fetchInterviewInvites = async () => {
      try {
        const data = await assessmentsApi.getReceivedInterviewInvites();
        setInterviewInvites(data || []);
      } catch (error) {
        console.error("Failed to load interview invites:", error);
      } finally {
        setIsLoadingInterviews(false);
      }
    };
    fetchInterviewInvites();

    const fetchBookings = async () => {
      try {
        const data = await interviewsApi.getMyBookings();
        setMyBookings(data || []);
      } catch (error) {
        console.error("Failed to load bookings:", error);
      } finally {
        setIsLoadingBookings(false);
      }
    };
    fetchBookings();

    const fetchIntegrationStatus = async () => {
      try {
        const res = await integrationsApi.getGoogleIntegrationStatus();
        setIsGoogleConnected(res.connected);
      } catch (error) {
        console.error("Failed to fetch integration status:", error);
      }
    };
    fetchIntegrationStatus();
  }, [fetchProfile]);

  const handleCvUpload = async (file: File) => {
    if (!profile?.id) {
      toast.error("Please complete your profile first");
      return;
    }
    try {
      await profilesApi.uploadCv(profile.id, file);
      toast.success("CV uploaded successfully!");
      setShowUpload(false);
      fetchProfile();
    } catch {
      toast.error("Failed to upload CV");
    }
  };

  const handleConnectCalendar = async () => {
    setIsConnectingGoogle(true);
    try {
      const response = await integrationsApi.getGoogleAuthUrl();
      window.location.href = response.url;
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch Google Auth URL");
      setIsConnectingGoogle(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="text-gray-600 mt-1">
          Here is an overview of your candidate profile and applications.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Profile Summary
            </h2>
            {isLoadingProfile ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
              </div>
            ) : profile ? (
              <div className="space-y-3">
                {profile.bio && (
                  <p className="text-sm font-medium text-gray-900">
                    {profile.bio}
                  </p>
                )}
                {profile.yearsOfExperience != null && (
                  <p className="text-sm text-gray-600">
                    Experience: {profile.yearsOfExperience} year{profile.yearsOfExperience !== 1 ? 's' : ''}
                  </p>
                )}
                {profile.cvUrl ? (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    CV uploaded
                  </div>
                ) : (
                  <p className="text-sm text-yellow-600">No CV uploaded yet</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No profile data yet. Complete your profile to improve your applications.
              </p>
            )}

            <div className="mt-6 space-y-3">
              <button
                onClick={() => setShowUpload(!showUpload)}
                className="w-full py-2 px-4 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                {showUpload ? "Cancel Upload" : "Upload CV"}
              </button>
              {showUpload && (
                <div className="mt-3">
                  <FileUpload
                    onFileSelect={handleCvUpload}
                    label="Upload your CV"
                    hint="PDF, DOC, or DOCX up to 10MB"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Integrations */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Integrations
            </h2>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Connect your Google Calendar to automatically add scheduled interviews to your personal calendar.
              </p>
              <button
                onClick={handleConnectCalendar}
                disabled={isConnectingGoogle || isGoogleConnected === true}
                className={`w-full py-2 px-4 text-sm font-medium rounded-lg shadow-sm transition flex justify-center items-center gap-2 disabled:opacity-50 ${
                  isGoogleConnected
                    ? "bg-green-100 text-green-700 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {isConnectingGoogle ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                ) : isGoogleConnected ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                )}
                {isGoogleConnected ? "Connected" : "Connect Google Calendar"}
              </button>
            </div>
          </div>
        </div>

        {/* My Applications */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                My Applications
              </h2>
              <Link
                href="/jobs"
                className="text-sm font-medium text-primary-600 hover:text-primary-500"
              >
                Browse Jobs
              </Link>
            </div>

            {isLoadingApps ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse border rounded-lg p-4">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                  </div>
                ))}
              </div>
            ) : applications.length > 0 ? (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {app.job?.title || "Job Application"}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                          Applied{" "}
                          {app.createdAt
                            ? formatDate(app.createdAt)
                            : "Recently"}
                        </p>
                      </div>
                      <StatusBadge status={app.status} type="application" />
                    </div>
                    {app.compositeScore !== undefined && app.compositeScore !== null && (
                      <div className="mt-2 text-sm text-gray-600">
                        Score: <span className="font-semibold">{Math.round(app.compositeScore)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="mx-auto w-12 h-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                <h3 className="text-sm font-medium text-gray-900 mb-1">
                  No applications yet
                </h3>
                <p className="text-sm text-gray-500">
                  Start browsing jobs and submit your first application.
                </p>
                <Link
                  href="/jobs"
                  className="inline-flex items-center mt-4 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Browse Jobs
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Interviews */}
        {myBookings.length > 0 && (
          <div className="lg:col-span-3 mt-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Upcoming Interviews
              </h2>
              {isLoadingBookings ? (
                <div className="space-y-3">
                  {[1].map((i) => (
                    <div key={i} className="animate-pulse border border-gray-200 rounded-lg p-4">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {myBookings.filter(b => b.status === "SCHEDULED").map((booking) => (
                    <div
                      key={booking.id}
                      className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-4 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-medium text-emerald-900">
                            Interview: {booking.jobTitle}
                          </h4>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-emerald-700">
                            <span>
                              Scheduled for {formatDateTime(booking.startTime)}
                            </span>
                          </div>
                        </div>

                        {booking.meetingLink && (
                          <a
                            href={booking.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 shadow-sm transition-colors whitespace-nowrap"
                          >
                            Join Meeting
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  {myBookings.filter(b => b.status === "SCHEDULED").length === 0 && (
                    <p className="text-sm text-gray-500">No upcoming interviews scheduled.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Interview Invites */}
        {applications.length > 0 && (() => {
          const isInterviewBooked = (jobId: string) => {
            return myBookings.some(b => b.jobId === jobId && (b.status === "SCHEDULED" || b.status === "COMPLETED"));
          };
          const pendingInterviews = interviewInvites.filter(invite => !isInterviewBooked(invite.jobId));
          
          if (pendingInterviews.length === 0 && !isLoadingInterviews) return null;

          return (
            <div className="lg:col-span-3 mt-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Interview Invitations
                </h2>

                {isLoadingInterviews ? (
                  <div className="space-y-3">
                    {[1].map((i) => (
                      <div key={i} className="animate-pulse border border-gray-200 rounded-lg p-4">
                        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingInterviews.map((invite) => (
                    <div
                      key={invite.id}
                      className="border border-indigo-200 bg-indigo-50/50 rounded-lg p-4 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-medium text-indigo-900">
                            Interview: {invite.jobTitle}
                          </h4>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-indigo-700">
                            {invite.oaScore != null && (
                              <span className="font-semibold">
                                OA Score: {Math.round(invite.oaScore)}
                              </span>
                            )}
                            {invite.sentAt && (
                              <span>
                                Invited {formatDate(invite.sentAt)}
                              </span>
                            )}
                          </div>
                        </div>

                        {invite.schedulingUrl && (
                          <Link
                            href={invite.schedulingUrl}
                            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-colors whitespace-nowrap"
                          >
                            Book Interview
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
        })()}

        {/* Pending Assessments */}
        {applications.length > 0 && (() => {
          const isOATaken = (jobId: string) => {
            const app = applications.find(a => a.jobId === jobId);
            if (!app) return false;
            const pastStatuses = ["OA_COMPLETED", "INTERVIEW_INVITED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED", "OFFERED", "REJECTED"];
            return pastStatuses.includes(app.status);
          };
          const pendingOAs = invites.filter(invite => !isOATaken(invite.jobId));
          
          if (pendingOAs.length === 0 && !isLoadingInvites) return null;

          return (
            <div className="lg:col-span-3 mt-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Assessments
                </h2>

                {isLoadingInvites ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="animate-pulse border border-gray-200 rounded-lg p-4">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingOAs.map((invite) => {
                    const token = invite.assessmentToken;
                    const href = user?.id
                      ? `/assessments/${token}?candidateId=${user.id}`
                      : `/assessments/${token}`;

                    return (
                      <div
                        key={invite.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {invite.assessmentTitle || "Online Assessment"}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">
                              Job: <span className="font-medium">{invite.jobTitle}</span>
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                              {invite.timeLimitMinutes != null && (
                                <span>Time limit: {invite.timeLimitMinutes} min</span>
                              )}
                              {invite.sentAt && (
                                <span>
                                  Sent {formatDateTime(invite.sentAt)}
                                </span>
                              )}
                            </div>
                          </div>

                          <Link
                            href={href}
                            className="inline-flex items-center px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors whitespace-nowrap"
                          >
                            Start
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
        })()}
      </div>
    </div>
  );
}

function RecruiterDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await jobsApi.listJobs({ pageSize: 20 });
        setJobs(response.content || []);
      } catch {
        toast.error("Failed to load jobs");
      } finally {
        setIsLoading(false);
      }
    };
    fetchJobs();
  }, []);

  const totalApplications = jobs.reduce(
    (sum, job) => sum + (job.applicationCount || 0),
    0
  );
  const publishedJobs = jobs.filter((j) => j.status === "PUBLISHED").length;
  const draftJobs = jobs.filter((j) => j.status === "DRAFT").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-gray-600 mt-1">
            Manage your job postings and review candidates.
          </p>
        </div>
        <button
          onClick={() => router.push("/recruiter/jobs/new")}
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Job
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Published Jobs</p>
          <p className="text-3xl font-bold text-primary-600 mt-1">
            {publishedJobs}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Draft Jobs</p>
          <p className="text-3xl font-bold text-gray-600 mt-1">{draftJobs}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Total Applications</p>
          <p className="text-3xl font-bold text-green-600 mt-1">
            {totalApplications}
          </p>
        </div>
      </div>

      {/* Jobs List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">My Jobs</h2>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse border rounded-lg p-6">
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : jobs.length > 0 ? (
          <div className="space-y-4">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                showStatus
                recruiterView
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <svg className="mx-auto w-12 h-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              No jobs created yet
            </h3>
            <p className="text-sm text-gray-500">
              Create your first job posting to start receiving applications.
            </p>
            <button
              onClick={() => router.push("/recruiter/jobs/new")}
              className="inline-flex items-center mt-4 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Create Job
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user?.role === "RECRUITER" ? (
          <RecruiterDashboard />
        ) : (
          <CandidateDashboard />
        )}
      </div>
    </ProtectedRoute>
  );
}
