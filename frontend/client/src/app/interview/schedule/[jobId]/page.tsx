"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { interviewsApi } from "@/lib/api";
import type { InterviewSlot, InterviewBooking } from "@/lib/types";
import ProtectedRoute from "@/components/ProtectedRoute";
import toast from "react-hot-toast";
import { formatDateTime } from "@/lib/dateUtils";

export default function InterviewSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;

  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<InterviewSlot | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<InterviewBooking | null>(null);

  useEffect(() => {
    if (jobId) {
      interviewsApi.getAvailableSlots(jobId)
        .then((data) => setSlots(data))
        .catch((err) => {
          setError(err.response?.data?.message || "Failed to load slots");
        })
        .finally(() => setIsLoading(false));
    }
  }, [jobId]);

  const groupedSlots = useMemo(() => {
    const groups: Record<string, InterviewSlot[]> = {};
    slots.forEach((slot) => {
      const d = new Date(slot.startTime);
      const dateKey = d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      });
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(slot);
    });
    return groups;
  }, [slots]);

  const handleBook = async () => {
    if (!selectedSlot) return;
    setIsBooking(true);
    try {
      const result = await interviewsApi.bookInterview(jobId, { slotId: selectedSlot.id });
      setBookingSuccess(result);
      toast.success("Interview scheduled successfully!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to book interview");
      setSelectedSlot(null);
    } finally {
      setIsBooking(false);
    }
  };

  // Shared background wrapper for all states
  const PageWrapper = ({ children }: { children: React.ReactNode }) => (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-fixed relative flex flex-col items-center justify-center py-12 px-4"
      style={{ backgroundImage: `url(/bk2.jpg)` }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div className="relative z-10 w-full max-w-4xl">
        {children}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <ProtectedRoute requiredRole="CANDIDATE">
        <PageWrapper>
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        </PageWrapper>
      </ProtectedRoute>
    );
  }

  if (error && !bookingSuccess) {
    return (
      <ProtectedRoute requiredRole="CANDIDATE">
        <PageWrapper>
          <div className="max-w-md mx-auto bg-white/10 backdrop-blur-2xl rounded-[32px] shadow-2xl p-8 text-center border border-white/20">
            <div className="mx-auto w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2 text-white">Access Denied</h2>
            <p className="text-white/60 mb-8">{error}</p>
            <button onClick={() => router.push("/dashboard")} className="w-full py-3 bg-white text-slate-900 rounded-xl font-black uppercase tracking-widest text-xs transition-all hover:bg-slate-200 shadow-xl">
              Back to Dashboard
            </button>
          </div>
        </PageWrapper>
      </ProtectedRoute>
    );
  }

  if (bookingSuccess) {
    return (
      <ProtectedRoute requiredRole="CANDIDATE">
        <PageWrapper>
          <div className="max-w-md mx-auto bg-white/10 backdrop-blur-2xl rounded-[32px] shadow-2xl p-8 text-center border border-white/20">
            <div className="mx-auto w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-6 border border-green-500/30">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-3">Interview Confirmed!</h2>
            <p className="text-white/70 mb-6 text-lg">Your interview has been successfully scheduled.</p>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-left">
              <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-2">Meeting Link</p>
              <a href={bookingSuccess.meetingLink} target="_blank" rel="noreferrer" className="text-white font-bold hover:underline block truncate mb-4">
                {bookingSuccess.meetingLink || "Link will be provided"}
              </a>
              <p className="text-xs text-white/50">A calendar invitation has been sent to your email with these details.</p>
            </div>

            <button onClick={() => router.push("/dashboard")} className="w-full py-3 bg-white text-slate-900 rounded-xl font-black uppercase tracking-widest text-xs transition-all hover:bg-slate-200">
              Return to Dashboard
            </button>
          </div>
        </PageWrapper>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="CANDIDATE">
      <PageWrapper>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-3 italic">Select a Time</h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto font-medium">Choose a time slot below that works best for you. The duration of the interview is approximately 60 minutes.</p>
        </div>

        {slots.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-xl rounded-[32px] border border-white/10 p-12 text-center shadow-2xl">
            <svg className="mx-auto h-16 w-16 text-white/20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-xl font-bold text-white mb-1">No available slots</h3>
            <p className="text-white/50">The recruiter hasn't added any available time slots yet or they are all booked. Please check back later.</p>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-2xl rounded-[40px] shadow-2xl border border-white/20 overflow-hidden">
            <div className="p-8 md:p-10">
              <div className="space-y-10">
                {Object.entries(groupedSlots).map(([dateLabel, daySlots]) => (
                  <div key={dateLabel}>
                    <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.3em] mb-6 flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {dateLabel}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {daySlots.map((slot) => {
                        const d = new Date(slot.startTime);
                        const timeString = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const isSelected = selectedSlot?.id === slot.id;
                        
                        return (
                          <button
                            key={slot.id}
                            onClick={() => setSelectedSlot(slot)}
                            className={`py-4 px-4 rounded-2xl text-sm font-bold transition-all duration-300 border-2 
                              ${isSelected 
                                ? 'bg-white border-white text-slate-900 shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-105' 
                                : 'bg-white/5 border-white/10 text-white/80 hover:border-white/20 hover:bg-white/10'
                              }`}
                          >
                            {timeString}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className={`bg-white/5 p-8 border-t border-white/10 transition-all duration-300 flex flex-col md:flex-row items-center justify-between gap-6 ${selectedSlot ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
              <div className="text-white/60 text-sm font-medium">
                {selectedSlot ? (
                  <>Selected: <span className="font-black text-white italic">{formatDateTime(selectedSlot.startTime)}</span></>
                ) : (
                  "Please select a time slot to continue"
                )}
              </div>
              <button
                onClick={handleBook}
                disabled={!selectedSlot || isBooking}
                className="w-full md:w-auto px-10 py-4 bg-white text-slate-900 font-black uppercase text-xs tracking-widest rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50 flex items-center justify-center"
              >
                {isBooking && (
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-slate-900" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                )}
                Confirm Booking
              </button>
            </div>
          </div>
        )}
      </PageWrapper>
    </ProtectedRoute>
  );
}