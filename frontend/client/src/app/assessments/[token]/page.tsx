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

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-8" />
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!assessment) {
    return (
      <ProtectedRoute>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <svg className="mx-auto w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Assessment Not Found</h2>
          <p className="text-gray-500">This assessment link may be invalid or has expired.</p>
        </div>
      </ProtectedRoute>
    );
  }

  if (submitted && submissionResult) {
    return (
      <ProtectedRoute>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <svg className="mx-auto w-16 h-16 text-green-500 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Assessment Submitted!</h2>
          <p className="text-gray-600 mb-6">Thank you for completing the assessment.</p>

          {submissionResult.score !== null && submissionResult.score !== undefined && (
            <div className="inline-block bg-primary-50 rounded-xl p-6 mb-6">
              <div className="text-4xl font-bold text-primary-600">
                {Math.round(submissionResult.score)}%
              </div>
              <p className="text-sm text-primary-500 mt-1">Your Score</p>
            </div>
          )}

          {submissionResult.scoringDetails && submissionResult.scoringDetails.length > 0 && (
            <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Score Breakdown</h3>
              <div className="space-y-3">
                {submissionResult.scoringDetails.map((detail: { questionId: string; questionType: string; score: number; maxScore: number }) => (
                  <div key={detail.questionId} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Q{detail.questionId.replace(/\D/g, "")} ({detail.questionType})
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {detail.score}/{detail.maxScore}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8">
            <a
              href="/dashboard"
              className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{assessment.title}</h1>
              {assessment.description && (
                <p className="text-gray-600 mt-1">{assessment.description}</p>
              )}
              <p className="text-sm text-gray-500 mt-2">
                {assessment.questions.length} question{assessment.questions.length !== 1 ? "s" : ""}
              </p>
            </div>
            {timeRemaining !== null && (
              <div className={`text-center px-4 py-2 rounded-lg ${
                timeRemaining < 300 ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-700"
              }`}>
                <div className="text-2xl font-mono font-bold">{formatTime(timeRemaining)}</div>
                <div className="text-xs">remaining</div>
              </div>
            )}
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {assessment.questions.map((question, index) => (
            <div key={question.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start gap-3 mb-4">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-sm font-semibold flex-shrink-0">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="text-gray-900 font-medium">{question.text}</p>
                  <span className="text-xs text-gray-400 mt-1 inline-block">
                    {question.type === "MCQ" ? "Multiple Choice" : question.type === "SHORT_ANSWER" ? "Short Answer" : "Code"} &middot; {question.max_score} pt{question.max_score !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {question.type === "MCQ" && question.options ? (
                <div className="space-y-2 ml-10">
                  {question.options.map((option, oi) => (
                    <label
                      key={oi}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        answers[question.id] === option
                          ? "border-primary-500 bg-primary-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={option}
                        checked={answers[question.id] === option}
                        onChange={() => handleAnswerChange(question.id, option)}
                        className="w-4 h-4 text-primary-600"
                      />
                      <span className="text-sm text-gray-900">{option}</span>
                    </label>
                  ))}
                </div>
              ) : question.type === "CODE" ? (
                <div className="ml-10">
                  <textarea
                    value={answers[question.id] || ""}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm text-gray-900 bg-gray-50"
                    rows={8}
                    placeholder="Write your code here..."
                  />
                </div>
              ) : (
                <div className="ml-10">
                  <textarea
                    value={answers[question.id] || ""}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900"
                    rows={4}
                    placeholder="Type your answer here..."
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Submit Bar */}
        <div className="sticky bottom-0 mt-6 bg-white rounded-xl shadow-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {Object.keys(answers).filter((k) => answers[k]?.trim()).length} of{" "}
              {assessment.questions.length} answered
            </p>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || timeRemaining === 0}
              className="px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit Assessment"}
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
