"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { offersApi } from "@/lib/api";
import type { OfferResponse } from "@/lib/types";
import toast from "react-hot-toast";

export default function OfferPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [offer, setOffer] = useState<OfferResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [showDeclineReason, setShowDeclineReason] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  useEffect(() => {
    if (!token) return;

    offersApi
      .getOffer(token)
      .then((data) => {
        setOffer(data);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Offer not found or expired.");
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await offersApi.acceptOffer(token);
      toast.success("You have successfully accepted the offer!");
      setOffer((prev) => (prev ? { ...prev, status: "ACCEPTED" } : null));
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to accept offer");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!showDeclineReason) {
      setShowDeclineReason(true);
      return;
    }
    setIsDeclining(true);
    try {
      await offersApi.declineOffer(token, { reason: declineReason });
      toast.success("You have declined the offer.");
      setOffer((prev) => (prev ? { ...prev, status: "DECLINED" } : null));
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to decline offer");
    } finally {
      setIsDeclining(false);
      setShowDeclineReason(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Offer Unavailable</h2>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans">
      {/* Background blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob"></div>
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-blue-500/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-4000"></div>

      <div className="w-full max-w-3xl z-10 relative">
        <div className="bg-[#111111]/80 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-8 sm:p-12 border-b border-white/5">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Job Offer</h1>
                <p className="text-lg text-indigo-400 font-medium">
                  {offer.jobTitle} <span className="text-gray-500">at</span> {offer.companyName}
                </p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${offer.status === 'PENDING' ? 'bg-yellow-400' : offer.status === 'ACCEPTED' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${offer.status === 'PENDING' ? 'bg-yellow-500' : offer.status === 'ACCEPTED' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                </span>
                <span className="text-sm font-medium text-white tracking-wide">
                  {offer.status === 'PENDING' ? 'ACTION REQUIRED' : offer.status}
                </span>
              </div>
            </div>

            <div className="prose prose-invert max-w-none text-gray-300">
              <p className="text-lg leading-relaxed mb-6">Dear {offer.candidateName},</p>
              <div className="whitespace-pre-wrap leading-relaxed bg-white/5 p-6 rounded-2xl border border-white/5 shadow-inner">
                {offer.offerMessage}
              </div>
            </div>

            {(offer.salary || offer.startDate) && (
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {offer.salary && (
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Compensation</p>
                      <p className="text-lg font-semibold text-white">{offer.salary}</p>
                    </div>
                  </div>
                )}
                {offer.startDate && (
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Start Date</p>
                      <p className="text-lg font-semibold text-white">{offer.startDate}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-8 sm:px-12 bg-black/40">
            {offer.status === "PENDING" ? (
              <div className="space-y-4">
                {!showDeclineReason ? (
                  <div className="flex flex-col sm:flex-row gap-4 justify-end">
                    <button
                      onClick={() => setShowDeclineReason(true)}
                      className="px-6 py-3 rounded-xl text-gray-400 font-medium hover:text-white hover:bg-white/10 transition-all border border-transparent"
                    >
                      Decline Offer
                    </button>
                    <button
                      onClick={handleAccept}
                      disabled={isAccepting}
                      className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {isAccepting ? "Accepting..." : "Accept Offer"}
                    </button>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Please let us know why you are declining (Optional)
                    </label>
                    <textarea
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all mb-4"
                      placeholder="e.g. Accepted another offer..."
                    />
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => setShowDeclineReason(false)}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDecline}
                        disabled={isDeclining}
                        className="px-6 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 rounded-xl transition-all disabled:opacity-50"
                      >
                        {isDeclining ? "Declining..." : "Confirm Decline"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${offer.status === 'ACCEPTED' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                  {offer.status === 'ACCEPTED' ? (
                    <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <h3 className="text-xl font-medium text-white mb-2">
                  You have {offer.status.toLowerCase()} this offer.
                </h3>
                <p className="text-gray-400">
                  {offer.status === 'ACCEPTED' 
                    ? "The recruiter has been notified and will be in touch with next steps." 
                    : "Thank you for letting us know."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
