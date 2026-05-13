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

  // Group slots by date string (e.g., "Mon, Oct 24")
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

  if (isLoading) {
    return (
      <ProtectedRoute requiredRole="CANDIDATE">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error && !bookingSuccess) {
    return (
      <ProtectedRoute requiredRole="CANDIDATE">
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
            <div className="mx-auto w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-8">{error}</p>
            <button onClick={() => router.push("/dashboard")} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-md shadow-indigo-200">
              Back to Dashboard
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (bookingSuccess) {
    return (
      <ProtectedRoute requiredRole="CANDIDATE">
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
            <div className="mx-auto w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Interview Confirmed!</h2>
            <p className="text-gray-600 mb-6 text-lg">Your interview has been successfully scheduled.</p>
            
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 mb-8 text-left">
              <p className="text-sm text-indigo-800 font-medium uppercase tracking-wider mb-1">Meeting Link</p>
              <a href={bookingSuccess.meetingLink} target="_blank" rel="noreferrer" className="text-indigo-600 font-medium hover:underline block truncate mb-4">
                {bookingSuccess.meetingLink || "Link will be provided"}
              </a>
              <p className="text-xs text-indigo-600/80">A calendar invitation has been sent to your email with these details.</p>
            </div>

            <button onClick={() => router.push("/dashboard")} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-md shadow-indigo-200">
              Return to Dashboard
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="CANDIDATE">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">Select a Time</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Choose a time slot below that works best for you. The duration of the interview is approximately 60 minutes.</p>
          </div>

          {slots.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
              <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No available slots</h3>
              <p className="text-gray-500">The recruiter hasn't added any available time slots yet or they are all booked. Please check back later.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-8">
                <div className="space-y-8">
                  {Object.entries(groupedSlots).map(([dateLabel, daySlots]) => (
                    <div key={dateLabel}>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100 flex items-center">
                        <svg className="w-5 h-5 text-indigo-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {dateLabel}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {daySlots.map((slot) => {
                          const d = new Date(slot.startTime);
                          const timeString = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          const isSelected = selectedSlot?.id === slot.id;
                          
                          return (
                            <button
                              key={slot.id}
                              onClick={() => setSelectedSlot(slot)}
                              className={`py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 border-2 
                                ${isSelected 
                                  ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-md shadow-indigo-100 transform scale-[1.02]' 
                                  : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/50'
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
              <div className={`bg-gray-50 p-6 border-t border-gray-100 transition-all duration-300 flex items-center justify-between ${selectedSlot ? 'opacity-100 translate-y-0' : 'opacity-50 pointer-events-none'}`}>
                <div className="text-gray-600 text-sm">
                  {selectedSlot ? (
                    <>Selected: <span className="font-semibold text-gray-900">{formatDateTime(selectedSlot.startTime)}</span></>
                  ) : (
                    "Please select a time slot to continue"
                  )}
                </div>
                <button
                  onClick={handleBook}
                  disabled={!selectedSlot || isBooking}
                  className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-md shadow-indigo-200 flex items-center"
                >
                  {isBooking ? (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  ) : null}
                  Confirm Booking
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
