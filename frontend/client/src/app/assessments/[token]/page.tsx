"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { assessmentsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Assessment, AssessmentAnswer, AssessmentSubmission } from "@/lib/types";
import ProtectedRoute from "@/components/ProtectedRoute";
import toast from "react-hot-toast";

export default function TakeAssessmentPage() {
  const params = useParams();
  const token = params.token as string;
  const { user } = useAuth();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<AssessmentSubmission | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        const data = await assessmentsApi.getAssessment(token, user?.id);
        setAssessment(data);
        if (data.timeLimitMinutes) {
          setTimeRemaining(data.timeLimitMinutes * 60);
        }
      } catch {
        toast.error("Failed to load assessment. The link may be invalid or expired.");
      } finally {
        setIsLoading(false);
      }
    };
    if (token) fetchAssessment();
  }, [token, user?.id]);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining === null || submitted) return;
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev: number | null) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeRemaining !== null, submitted]);

  // Autosave every 30 seconds
  const doAutosave = useCallback(async () => {
    if (!assessment || !user?.id || submitted) return;
    const answerList: AssessmentAnswer[] = Object.entries(answers).map(([questionId, answer]) => ({
      questionId,
      answer: answer as string,
    }));
    if (answerList.length === 0) return;
    try {
      await assessmentsApi.saveAnswers(assessment.id, user.id, answerList);
    } catch {
      // Silent autosave failure
    }
  }, [assessment, user?.id, answers, submitted]);

  useEffect(() => {
    autosaveRef.current = setInterval(doAutosave, 30000);
    return () => {
      if (autosaveRef.current) clearInterval(autosaveRef.current);
    };
  }, [doAutosave]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers((prev: Record<string, string>) => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    if (!assessment || !user?.id) return;

    const unanswered = assessment.questions.filter((q: { id: string }) => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      const proceed = confirm(
        `You have ${unanswered.length} unanswered question(s). Submit anyway?`
      );
      if (!proceed) return;
    }

    setIsSubmitting(true);
    try {
      const answerList: AssessmentAnswer[] = Object.entries(answers).map(
        ([questionId, answer]) => ({ questionId, answer: answer as string })
      );
      const result = await assessmentsApi.submitAssessment(assessment.id, user.id, answerList);
      setSubmissionResult(result);
      setSubmitted(true);
      toast.success("Assessment submitted successfully!");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || "Failed to submit assessment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const PageWrapper = ({ children }: { children: React.ReactNode }) => (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed text-white font-sans"
      style={{ backgroundImage: `url(/bk.jpg)` }}
    >
      <div className="min-h-screen bg-black/40 backdrop-blur-[2px] py-8">
        {children}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <ProtectedRoute>
        <PageWrapper>
          <div className="max-w-3xl mx-auto px-4 animate-pulse space-y-6">
            <div className="h-32 bg-white/10 rounded-3xl border border-white/10" />
            <div className="h-64 bg-white/5 rounded-3xl border border-white/5" />
          </div>
        </PageWrapper>
      </ProtectedRoute>
    );
  }

  if (!assessment) {
    return (
      <ProtectedRoute>
        <PageWrapper>
          <div className="max-w-3xl mx-auto px-4 text-center py-20">
            <svg className="mx-auto w-16 h-16 text-white/20 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Assessment Not Found</h2>
            <p className="text-white/50 mt-2 uppercase text-xs tracking-widest">
              This assessment link may be invalid or has expired.
            </p>
          </div>
        </PageWrapper>
      </ProtectedRoute>
    );
  }

  if (submitted && submissionResult) {
    return (
      <ProtectedRoute>
        <PageWrapper>
          <div className="max-w-xl mx-auto px-4 py-12">
            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[40px] shadow-2xl p-10 text-center">
              <div className="w-20 h-20 bg-green-500/20 border border-green-500/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">Complete</h2>
              <p className="text-white/60 text-sm uppercase tracking-widest mb-8">
                Assessment submitted successfully
              </p>

              {submissionResult.score !== null && submissionResult.score !== undefined && (
                <div className="bg-white/5 rounded-3xl p-8 border border-white/10 mb-6">
                  <div className="text-6xl font-black tracking-tighter text-white">
                    {Math.round(submissionResult.score)}<span className="text-2xl text-white/30">%</span>
                  </div>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em] mt-2">Your Score</p>
                </div>
              )}

              {submissionResult.scoringDetails && submissionResult.scoringDetails.length > 0 && (
                <div className="bg-white/5 rounded-3xl p-6 border border-white/10 mb-6 text-left">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">
                    Score Breakdown
                  </h3>
                  <div className="space-y-3">
                    {submissionResult.scoringDetails.map(
                      (detail: { questionId: string; questionType: string; score: number; maxScore: number }) => (
                        <div key={detail.questionId} className="flex items-center justify-between">
                          <span className="text-sm text-white/60">
                            Q{detail.questionId.replace(/\D/g, "")}
                            <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-white/30 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                              {detail.questionType}
                            </span>
                          </span>
                          <span className="text-sm font-bold text-white">
                            {detail.score}/{detail.maxScore}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              <a
                href="/dashboard"
                className="inline-block w-full py-4 bg-white text-slate-900 font-black rounded-2xl hover:bg-slate-200 transition-all uppercase text-xs tracking-widest"
              >
                Return to Dashboard
              </a>
            </div>
          </div>
        </PageWrapper>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <PageWrapper>
        <div className="max-w-3xl mx-auto px-4 pb-32">
          {/* Header Card */}
          <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[32px] p-8 mb-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">{assessment.title}</h1>
                {assessment.description && (
                  <p className="text-white/60 text-sm mt-3">{assessment.description}</p>
                )}
                <p className="text-white/50 text-xs font-bold uppercase tracking-widest mt-3">
                  {assessment.questions.length} Question{assessment.questions.length !== 1 ? "s" : ""} &middot; complete on time
                </p>
              </div>
              {timeRemaining !== null && (
                <div className={`px-6 py-3 rounded-2xl border-2 backdrop-blur-md transition-colors ${timeRemaining < 300 ? "bg-red-500/20 border-red-500/50" : "bg-white/5 border-white/20"}`}>
                  <div className="text-3xl font-black font-mono tracking-tighter leading-none">{formatTime(timeRemaining)}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-center mt-1 opacity-50">Remaining</div>
                </div>
              )}
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-8">
            {assessment.questions.map((question, index) => (
              <div key={question.id} className="group bg-black/20 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 transition-all ">
                <div className="flex items-start gap-5 mb-8">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-sm font-black text-white/40">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold leading-snug text-white/90">{question.text}</p>
                    <div className="flex gap-3 mt-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/30 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                        {question.type === "MCQ" ? "Multiple Choice" : question.type === "SHORT_ANSWER" ? "Short Answer" : "Code"}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/30 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                        {question.max_score} pt{question.max_score !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Input Areas */}
                <div className="ml-0 md:ml-14">
                  {question.type === "MCQ" && question.options ? (
                    <div className="grid grid-cols-1 gap-3">
                      {question.options.map((option, oi) => (
                        <label
                          key={oi}
                          className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${answers[question.id] === option
                            ? "bg-white text-slate-900 border-white"
                            : "bg-white/5 border-white/5"
                            }`}
                        >
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={option}
                            checked={answers[question.id] === option}
                            onChange={() => handleAnswerChange(question.id, option)}
                            className="hidden"
                          />
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${answers[question.id] === option ? "border-slate-900" : "border-white/20"}`}>
                            {answers[question.id] === option && <div className="w-2.5 h-2.5 bg-slate-900 rounded-full" />}
                          </div>
                          <span className="text-sm font-bold uppercase tracking-tight">{option}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      value={answers[question.id] || ""}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      className={`w-full bg-white/5 border-2 border-white/10 rounded-2xl p-6 text-sm text-white placeholder:text-white/20  ${question.type === "CODE" ? "font-mono" : ""
                        }`}
                      rows={question.type === "CODE" ? 8 : 4}
                      placeholder={question.type === "CODE" ? "// Write your code here..." : "Type your answer here..."}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Submit Bar - Sticky Glass */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50">
            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between gap-4">
              <div className="pl-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Progress</div>
                <div className="text-sm font-bold">
                  {Object.keys(answers).filter((k) => answers[k]?.trim()).length} / {assessment.questions.length} answered
                </div>
              </div>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || timeRemaining === 0}
                className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100"
              >
                {isSubmitting ? "Submitting..." : "Submit Assessment"}
              </button>
            </div>
          </div>
        </div>
      </PageWrapper>
    </ProtectedRoute>
  );
}