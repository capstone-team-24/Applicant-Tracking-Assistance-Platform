"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { jobsApi, profilesApi, applicationsApi, assessmentsApi, interviewsApi, offersApi } from "@/lib/api";
import type { Job, Application, Profile, ReceivedAssessmentInvite, InterviewInvite, CandidateBookingResponse, OfferResponse } from "@/lib/types";
import ProtectedRoute from "@/components/ProtectedRoute";
import JobCard from "@/components/JobCard";
import StatusBadge from "@/components/StatusBadge";
import FileUpload from "@/components/FileUpload";
import toast from "react-hot-toast";
import { formatDate, formatDateTime, parseDate } from "@/lib/dateUtils";

function CandidateDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [invites, setInvites] = useState<ReceivedAssessmentInvite[]>([]);
  const [interviewInvites, setInterviewInvites] = useState<InterviewInvite[]>([]);
  const [myBookings, setMyBookings] = useState<CandidateBookingResponse[]>([]);
  const [myOffers, setMyOffers] = useState<OfferResponse[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingApps, setIsLoadingApps] = useState(true);
  const [isLoadingInvites, setIsLoadingInvites] = useState(true);
  const [isLoadingInterviews, setIsLoadingInterviews] = useState(true);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isLoadingOffers, setIsLoadingOffers] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

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

    const fetchOffers = async () => {
      try {
        const data = await offersApi.getMyOffers();
        setMyOffers(data || []);
      } catch (error) {
        console.error("Failed to load offers:", error);
      } finally {
        setIsLoadingOffers(false);
      }
    };
    fetchOffers();
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

  return (
    <div className="min-h-screen w-full relative flex flex-col items-center p-6 md:p-8 transition-all duration-500">


      <div className="mb-8 backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="text-white/60 mt-1">
          Here is an overview of your candidate profile and applications.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Summary */}
        <div className="lg:col-span-1">
          <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-xl border border-white/20 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Profile Summary
            </h2>
            {isLoadingProfile ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-4 bg-white/10 rounded w-1/2" />
                <div className="h-4 bg-white/10 rounded w-2/3" />
              </div>
            ) : profile ? (
              <div className="space-y-3">
                {(profile.firstName || profile.lastName) && (
                  <p className="text-sm text-white/70">
                    {profile.firstName} {profile.lastName}
                  </p>
                )}
                {profile.headline && (
                  <p className="text-sm text-indigo-200">
                    {profile.headline}
                  </p>
                )}
                {profile.bio && (
                  <p className="text-sm font-medium text-white">
                    {profile.bio}
                  </p>
                )}
                {profile.yearsOfExperience != null && (
                  <p className="text-sm text-white/60">
                    Experience: {profile.yearsOfExperience} year{profile.yearsOfExperience !== 1 ? 's' : ''}
                  </p>
                )}
                {profile.location && (
                  <p className="text-sm text-white/60">Location: {profile.location}</p>
                )}
                {profile.cvUrl ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    CV uploaded
                  </div>
                ) : (
                  <p className="text-sm text-amber-400">No CV uploaded yet</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-white/50">
                No profile data yet. Complete your profile to improve your applications.
              </p>
            )}

            <div className="mt-6 space-y-3">
              <button
                onClick={() => setShowUpload(!showUpload)}
                className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl shadow-sm hover:shadow transition-all duration-200"
              >
                {showUpload ? "Cancel Upload" : "Upload CV"}
              </button>
              {showUpload && (
                <div className="mt-3 backdrop-blur-sm bg-white/10 p-4 border border-white/20 rounded-xl">
                  <FileUpload
                    onFileSelect={handleCvUpload}
                    label="Upload your CV"
                    hint="PDF, DOC, or DOCX up to 10MB"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Account setup */}
          <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-xl border border-white/20 p-6 mt-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Account Setup
            </h2>
            <div className="space-y-3">
              <p className="text-sm text-white/60">
                Update your profile, change your password, and connect Google Calendar from one dedicated settings page.
              </p>
              <Link
                href="/account/setup"
                className="block w-full rounded-xl bg-white/10 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-white/15"
              >
                Open Account Setup
              </Link>
              <Link
                href="/settings"
                className="block w-full rounded-xl bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Go to Settings
              </Link>
            </div>
          </div>
        </div>

        {/* My Applications */}
        <div className="lg:col-span-2">
          <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
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
                  <div key={i} className="animate-pulse border border-white/20 backdrop-blur-sm bg-white/20 rounded-xl p-4">
                    <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-white/10 rounded w-1/2 mb-2" />
                    <div className="h-3 bg-white/10 rounded w-1/4" />
                  </div>
                ))}
              </div>
            ) : applications.length > 0 ? (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/15 hover:border-white/20 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-white">
                          {app.job?.title || "Job Application"}
                        </h4>
                        {app.job?.organizationName && (
                          <p className="text-xs font-semibold text-indigo-600 mt-0.5">
                            {app.job.organizationName}
                          </p>
                        )}
                        <p className="text-sm text-white/50 mt-1">
                          Applied{" "}
                          {app.createdAt
                            ? formatDate(app.createdAt)
                            : "Recently"}
                        </p>
                      </div>
                      <StatusBadge status={app.status} type="application" />
                    </div>
                    {app.compositeScore !== undefined && app.compositeScore !== null && (
                      <div className="mt-2 text-sm text-white/60">
                        Score: <span className="font-semibold text-white">{Math.round(app.compositeScore)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="mx-auto w-12 h-12 text-white/20 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                <h3 className="text-sm font-medium text-white mb-1">
                  No applications yet
                </h3>
                <p className="text-sm text-white/50">
                  Start browsing jobs and submit your first application.
                </p>
                <Link
                  href="/jobs"
                  className="inline-flex items-center mt-4 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 shadow-sm transition-all duration-200"
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
            <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-xl border border-white/20 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Upcoming Interviews
              </h2>
              {isLoadingBookings ? (
                <div className="space-y-3">
                  {[1].map((i) => (
                    <div key={i} className="animate-pulse border border-white/20 backdrop-blur-sm bg-white/20 rounded-xl p-4">
                      <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                      <div className="h-3 bg-white/10 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {myBookings.filter(b => b.status === "SCHEDULED").map((booking) => (
                    <div
                      key={booking.id}
                      className="backdrop-blur-sm bg-emerald-50/30 border border-emerald-200/50 rounded-xl p-4 shadow-sm"
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
                            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 shadow-sm hover:shadow transition-all duration-200 whitespace-nowrap"
                          >
                            Join Meeting
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  {myBookings.filter(b => b.status === "SCHEDULED").length === 0 && (
                    <p className="text-sm text-white/50">No upcoming interviews scheduled.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Offers */}
        {(myOffers.length > 0 || isLoadingOffers) && (
          <div className="lg:col-span-3 mt-4">
            <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-xl border border-white/20 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Job Offers
              </h2>
              {isLoadingOffers ? (
                <div className="space-y-3">
                  {[1].map((i) => (
                    <div key={i} className="animate-pulse border border-white/20 backdrop-blur-sm bg-white/20 rounded-xl p-4">
                      <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                      <div className="h-3 bg-white/10 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {myOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className={`backdrop-blur-sm border rounded-xl p-4 shadow-sm transition-all duration-200 ${
                        offer.status === 'PENDING'
                          ? 'border-yellow-200/50 bg-yellow-50/20'
                          : offer.status === 'ACCEPTED'
                          ? 'border-emerald-200/50 bg-emerald-50/20'
                          : 'border-red-200/50 bg-red-50/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className={`font-medium ${
                            offer.status === 'PENDING' ? 'text-yellow-300' : offer.status === 'ACCEPTED' ? 'text-emerald-300' : 'text-red-300'
                          }`}>
                            Offer: {offer.jobTitle}
                          </h4>
                          {offer.companyName && (
                            <p className={`text-xs font-semibold mt-0.5 ${
                                offer.status === 'PENDING' ? 'text-yellow-500' : offer.status === 'ACCEPTED' ? 'text-emerald-500' : 'text-red-500'
                            }`}>
                              {offer.companyName}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
                            {offer.sentAt && (
                              <span>Sent {formatDate(offer.sentAt)}</span>
                            )}
                            <span className="font-semibold uppercase text-xs px-2 py-0.5 rounded-full bg-black/20">
                              {offer.status}
                            </span>
                          </div>
                        </div>

                        <Link
                          href={`/offers/${offer.token || offer.id}`}
                          className={`inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-xl shadow-sm hover:shadow transition-all duration-200 whitespace-nowrap ${
                            offer.status === 'PENDING'
                              ? 'bg-yellow-600 hover:bg-yellow-700'
                              : offer.status === 'ACCEPTED'
                              ? 'bg-emerald-600 hover:bg-emerald-700'
                              : 'bg-red-600 hover:bg-red-700'
                          }`}
                        >
                          Review Offer
                        </Link>
                      </div>
                    </div>
                  ))}
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
              <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-xl border border-white/20 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">
                  Interview Invitations
                </h2>

                {isLoadingInterviews ? (
                  <div className="space-y-3">
                    {[1].map((i) => (
                      <div key={i} className="animate-pulse border border-white/20 backdrop-blur-sm bg-white/20 rounded-xl p-4">
                        <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                        <div className="h-3 bg-white/10 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingInterviews.map((invite) => {
                      const isExpired = invite.expiresAt
                        ? (parseDate(invite.expiresAt) || new Date()) < new Date()
                        : false;

                      return (
                        <div
                          key={invite.id}
                          className={`backdrop-blur-sm border rounded-xl p-4 shadow-sm transition-all duration-200 ${isExpired
                            ? "border-white/10 bg-white/5"
                            : "border-indigo-200/50 bg-indigo-50/30"
                            }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className={`font-medium ${isExpired ? "text-white/50" : "text-indigo-300"}`}>
                                  Interview: {invite.jobTitle}
                                </h4>
                                {invite.organizationName && (
                                  <p className="text-xs font-semibold text-indigo-500 mt-0.5">
                                    {invite.organizationName}
                                  </p>
                                )}
                                {isExpired && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100/60 text-red-700 border border-red-200/30">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                                    Booking Closed
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-indigo-700">
                                {invite.oaScore != null && (
                                  <span className="font-semibold">
                                    OA Score: {Math.round(invite.oaScore)}
                                  </span>
                                )}
                                {invite.sentAt && (
                                  <span>Invited {formatDate(invite.sentAt)}</span>
                                )}
                                {invite.expiresAt && (
                                  <span className={isExpired ? "text-red-500 font-medium" : "text-amber-600 font-medium"}>
                                    {isExpired ? "Booking closed" : "Book by"}: {formatDateTime(invite.expiresAt)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {isExpired ? (
                              <span className="inline-flex items-center px-4 py-2 bg-white/10 border border-white/10 text-white/40 text-sm font-medium rounded-xl whitespace-nowrap cursor-not-allowed">
                                Booking Closed
                              </span>
                            ) : (
                              invite.schedulingUrl && (
                                <Link
                                  href={invite.schedulingUrl}
                                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 shadow-sm hover:shadow transition-all duration-200 whitespace-nowrap"
                                >
                                  Book Interview
                                </Link>
                              )
                            )}
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

        {/* Pending Assessments */}
        {applications.length > 0 && (() => {
          const pendingOAs = invites.filter(invite => {
            const app = applications.find(a => a.jobId === invite.jobId);
            return app && app.status === "OA_INVITED";
          });

          if (pendingOAs.length === 0 && !isLoadingInvites) return null;

          return (
            <div className="lg:col-span-3 mt-4">
              <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-xl border border-white/20 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">
                  Assessments
                </h2>

                {isLoadingInvites ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="animate-pulse border border-white/20 backdrop-blur-sm bg-white/20 rounded-xl p-4">
                        <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                        <div className="h-3 bg-white/10 rounded w-1/2" />
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
                      const isExpired = invite.expiresAt
                        ? (parseDate(invite.expiresAt) || new Date()) < new Date()
                        : false;

                      return (
                        <div
                          key={invite.id}
                          className={`backdrop-blur-sm border rounded-xl p-4 shadow-sm transition-all duration-200 ${isExpired
                            ? "border-white/10 bg-white/5"
                            : "border-white/20 hover:bg-white/10"
                            }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-white">
                                  {invite.assessmentTitle || "Online Assessment"}
                                </h4>
                                {isExpired && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100/60 text-red-700 border border-red-200/30">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                                    Expired
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-white/60 mt-1">
                                Job: <span className="font-medium text-white">{invite.jobTitle}</span>
                                {invite.organizationName && (
                                  <span className="ml-2 text-xs font-semibold text-indigo-300">@ {invite.organizationName}</span>
                                )}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/50">
                                {invite.timeLimitMinutes != null && (
                                  <span>Time limit: {invite.timeLimitMinutes} min</span>
                                )}
                                {invite.sentAt && (
                                  <span>Sent {formatDateTime(invite.sentAt)}</span>
                                )}
                                {invite.expiresAt && (
                                  <span className={isExpired ? "text-red-500 font-medium" : "text-amber-600 font-medium"}>
                                    {isExpired ? "Expired" : "Due by"}: {formatDateTime(invite.expiresAt)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {isExpired ? (
                              <span className="inline-flex items-center px-3 py-2 bg-white/10 border border-white/10 text-white/40 text-sm font-medium rounded-xl whitespace-nowrap cursor-not-allowed">
                                Expired
                              </span>
                            ) : (
                              <Link
                                href={href}
                                className="inline-flex items-center px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 shadow-sm hover:shadow transition-all duration-200 whitespace-nowrap"
                              >
                                Start
                              </Link>
                            )}
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
    <div className="min-h-screen p-6 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-white/60 mt-1">
            Manage your job postings and review candidates.
          </p>
        </div>
        <button
          onClick={() => router.push("/recruiter/jobs/new")}
          className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 shadow-sm hover:shadow transition-all duration-200 self-start sm:self-auto"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Job
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-xl border border-white/20 p-6">
          <p className="text-sm font-medium text-white/50">Published Jobs</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">
            {publishedJobs}
          </p>
        </div>
        <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-xl border border-white/20 p-6">
          <p className="text-sm font-medium text-white/50">Draft Jobs</p>
          <p className="text-3xl font-bold text-white/60 mt-1">{draftJobs}</p>
        </div>
        <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-xl border border-white/20 p-6">
          <p className="text-sm font-medium text-white/50">Total Applications</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">
            {totalApplications}
          </p>
        </div>
      </div>

      {/* Jobs List */}
      <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-xl border border-white/20 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">My Jobs</h2>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse border border-white/20 backdrop-blur-sm bg-white/20 rounded-xl p-6">
                <div className="h-5 bg-white/10 rounded w-1/3 mb-3" />
                <div className="h-4 bg-white/10 rounded w-1/2 mb-2" />
                <div className="h-4 bg-white/10 rounded w-1/4" />
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
            <svg className="mx-auto w-12 h-12 text-white/20 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            <h3 className="text-sm font-medium text-white mb-1">
              No jobs created yet
            </h3>
            <p className="text-sm text-white/50">
              Create your first job posting to start receiving applications.
            </p>
            <button
              onClick={() => router.push("/recruiter/jobs/new")}
              className="inline-flex items-center mt-4 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 shadow-sm transition-all duration-200"
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
      <div className="min-h-screen text-white transition-colors duration-300">
        <div className="absolute inset-0 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {user?.role === "RECRUITER" ? (
            <RecruiterDashboard />
          ) : (
            <CandidateDashboard />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
