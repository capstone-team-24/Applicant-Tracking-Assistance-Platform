"use client";

import {
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";

import { useParams } from "next/navigation";

import { assessmentsApi } from "@/lib/api";

import { useAuth } from "@/lib/auth";

import type {
  Assessment,
  AssessmentAnswer,
  AssessmentSubmission,
} from "@/lib/types";

import ProtectedRoute from "@/components/ProtectedRoute";
import AssessmentFaceProctor, {
  AssessmentFaceProctorHandle,
  ProctorStrike,
} from "@/components/AssessmentFaceProctor";

import toast from "react-hot-toast";

// --------------------------------------------------
// PAGE WRAPPER
// --------------------------------------------------

const PageWrapper = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <div className="relative min-h-screen text-white font-sans">
    <div 
      className="fixed inset-0 z-[-2] bg-cover bg-center pointer-events-none"
      style={{ backgroundImage: "url(/bk.jpg)" }}
    />
    <div className="fixed inset-0 z-[-1] bg-black/40 backdrop-blur-[2px] pointer-events-none" />
    <div className="relative z-10 py-8 min-h-screen">
      {children}
    </div>
  </div>
);

export default function TakeAssessmentPage() {
  const params = useParams();

  const token = params.token as string;

  const { user } = useAuth();

  // --------------------------------------------------
  // MAIN STATE
  // --------------------------------------------------

  const [assessment, setAssessment] =
    useState<Assessment | null>(null);

  const [answers, setAnswers] = useState<
    Record<string, string>
  >({});

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [submitted, setSubmitted] =
    useState(false);

  const [
    submissionResult,
    setSubmissionResult,
  ] =
    useState<AssessmentSubmission | null>(
      null
    );

  const [timeRemaining, setTimeRemaining] =
    useState<number | null>(null);

  const [attemptLoaded, setAttemptLoaded] =
    useState(false);

  const [hasPersistedStart, setHasPersistedStart] =
    useState(false);

  const [submissionId, setSubmissionId] =
    useState<string | null>(null);

  const timerRef =
    useRef<ReturnType<
      typeof setInterval
    > | null>(null);

  const autosaveRef =
    useRef<ReturnType<
      typeof setInterval
    > | null>(null);

  // --------------------------------------------------
  // PROCTORING
  // --------------------------------------------------

  const [modelsLoaded, setModelsLoaded] =
    useState(false);

  const [
    warningAccepted,
    setWarningAccepted,
  ] = useState(false);

  const [webcamReady, setWebcamReady] =
    useState(false);

  const [faceDetected, setFaceDetected] =
    useState(false);

  const [fullscreenOk, setFullscreenOk] =
    useState(false);

  const [
    windowMaximized,
    setWindowMaximized,
  ] = useState(false);

  const [strikes, setStrikes] =
    useState(0);

  const [disqualified, setDisqualified] =
    useState(false);

  const [examStarted, setExamStarted] =
    useState(false);

  const proctorRef =
    useRef<AssessmentFaceProctorHandle | null>(
      null
    );

  const strikeInFlightRef =
    useRef(false);

  const getAnswerList = useCallback(
    () =>
      Object.entries(answers).map(
        ([questionId, answer]) => ({
          questionId,
          answer,
        })
      ),
    [answers]
  );

  const applySubmissionState = useCallback(
    (
      submission: AssessmentSubmission,
      assessmentData: Assessment
    ) => {
      setSubmissionId(submission.id);

      const restoredAnswers =
        submission.answers?.reduce<
          Record<string, string>
        >((acc, answer) => {
          acc[answer.questionId] =
            answer.answer;
          return acc;
        }, {}) ?? {};

      setAnswers(restoredAnswers);

      const strikeCount =
        submission.strikeCount ?? 0;
      setStrikes(strikeCount);

      const alreadyAccepted =
        Boolean(
          submission.warningAcceptedAt ||
            submission.examStartedAt
        );
      setWarningAccepted(alreadyAccepted);

      const startedAt =
        submission.examStartedAt;
      const started = Boolean(startedAt);
      setHasPersistedStart(started);

      const isDisqualified =
        submission.status ===
          "DISQUALIFIED" ||
        Boolean(
          submission.disqualifiedAt
        );
      setDisqualified(isDisqualified);

      const isCompleted =
        submission.status ===
          "SUBMITTED" ||
        submission.status === "SCORED";
      setSubmitted(isCompleted);
      setSubmissionResult(
        isCompleted || isDisqualified
          ? submission
          : null
      );

      if (startedAt) {
        const startedMs = new Date(
          startedAt
        ).getTime();
        const expiresMs =
          startedMs +
          assessmentData.timeLimitMinutes *
            60 *
            1000;
        const remainingSeconds =
          Math.max(
            0,
            Math.floor(
              (expiresMs - Date.now()) /
                1000
            )
          );
        setTimeRemaining(remainingSeconds);
      } else if (
        assessmentData.timeLimitMinutes
      ) {
        setTimeRemaining(
          assessmentData.timeLimitMinutes *
            60
        );
      }
    },
    []
  );

  // --------------------------------------------------
  // FETCH ASSESSMENT
  // --------------------------------------------------

  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        const data =
          await assessmentsApi.getAssessment(
            token,
            user?.id
          );

        setAssessment(data);

        if (user?.id) {
          const submission =
            await assessmentsApi.getMySubmission(
              data.id,
              user.id
            );
          applySubmissionState(
            submission,
            data
          );
        } else if (
          data.timeLimitMinutes
        ) {
          setTimeRemaining(
            data.timeLimitMinutes * 60
          );
        }
      } catch {
        toast.error(
          "Failed to load assessment."
        );
      } finally {
        setAttemptLoaded(true);
        setIsLoading(false);
      }
    };

    if (token) fetchAssessment();
  }, [token, user?.id]);

  // --------------------------------------------------
  // TIMER
  // --------------------------------------------------

  useEffect(() => {
    if (
      timeRemaining === null ||
      submitted ||
      disqualified ||
      !hasPersistedStart
    )
      return;

    timerRef.current = setInterval(() => {
      setTimeRemaining(
        (
          prev: number | null
        ) => {
          if (
            prev === null ||
            prev <= 1
          ) {
            if (timerRef.current)
              clearInterval(
                timerRef.current
              );

            handleSubmit(true);

            return 0;
          }

          return prev - 1;
        }
      );
    }, 1000);

    return () => {
      if (timerRef.current)
        clearInterval(timerRef.current);
    };
  }, [
    timeRemaining,
    submitted,
    disqualified,
    hasPersistedStart,
  ]);

  // --------------------------------------------------
  // AUTOSAVE
  // --------------------------------------------------

  const doAutosave = useCallback(
    async () => {
      if (
        !assessment ||
        !user?.id ||
        submitted ||
        disqualified ||
        !hasPersistedStart
      )
        return;

      const answerList: AssessmentAnswer[] =
        getAnswerList();

      if (answerList.length === 0)
        return;

      try {
        await assessmentsApi.saveAnswers(
          assessment.id,
          user.id,
          answerList
        );
      } catch { }
    },
    [
      assessment,
      user?.id,
      getAnswerList,
      submitted,
      disqualified,
      hasPersistedStart,
    ]
  );

  useEffect(() => {
    autosaveRef.current = setInterval(
      doAutosave,
      30000
    );

    return () => {
      if (autosaveRef.current)
        clearInterval(
          autosaveRef.current
        );
    };
  }, [doAutosave]);

  // --------------------------------------------------
  // STRIKES
  // --------------------------------------------------

  const addStrike = useCallback(
    async (strike: ProctorStrike) => {
      if (
        !assessment ||
        !user?.id ||
        strikeInFlightRef.current ||
        submitted ||
        disqualified
      )
        return;

      strikeInFlightRef.current = true;
      toast.error(strike.reason);

      try {
        const updated =
          await assessmentsApi.updateAttemptState(
            assessment.id,
            user.id,
            {
              strikeReason: strike.reason,
              strikeType: strike.type,
              evidence: strike.evidence,
              lastActivityAt:
                new Date().toISOString(),
            }
          );

        setSubmissionId(updated.id);
        setStrikes(
          updated.strikeCount ?? 0
        );

        if (
          updated.status ===
            "DISQUALIFIED" ||
          updated.disqualifiedAt
        ) {
          setDisqualified(true);
          setSubmissionResult(updated);
          toast.error(
            "Assessment disqualified."
          );
        }
      } catch {
        // Keep UX responsive even if persistence fails briefly.
      } finally {
        strikeInFlightRef.current = false;
      }
    },
    [
      assessment,
      disqualified,
      submitted,
      user?.id,
    ]
  );

  // --------------------------------------------------
  // START EXAM
  // --------------------------------------------------

  const startExam = async () => {
    try {
      await proctorRef.current?.start();

      if (assessment && user?.id) {
        const updated =
          hasPersistedStart
            ? await assessmentsApi.updateAttemptState(
                assessment.id,
                user.id,
                {
                  lastActivityAt:
                    new Date().toISOString(),
                }
              )
            : await assessmentsApi.updateAttemptState(
                assessment.id,
                user.id,
                {
                  examStarted: true,
                  lastActivityAt:
                    new Date().toISOString(),
                }
              );

        setSubmissionId(updated.id);
        setHasPersistedStart(true);
        setWarningAccepted(true);

        if (
          !hasPersistedStart &&
          updated.examStartedAt &&
          assessment.timeLimitMinutes
        ) {
          const startedMs = new Date(
            updated.examStartedAt
          ).getTime();
          const expiresMs =
            startedMs +
            assessment.timeLimitMinutes *
              60 *
              1000;
          setTimeRemaining(
            Math.max(
              0,
              Math.floor(
                (expiresMs - Date.now()) /
                  1000
              )
            )
          );
        }
      }

      setExamStarted(true);
    } catch (err) {
      console.error(err);

      toast.error(
        err instanceof Error
          ? err.message
          : "Camera permission required."
      );
    }
  };

  // --------------------------------------------------
  // TAB SWITCH
  // --------------------------------------------------

  useEffect(() => {
    const handleVisibility = () => {
      if (
        document.hidden &&
        examStarted
      ) {
        void (async () => {
          const evidence =
            await proctorRef.current?.captureEvidence();
          await addStrike({
            type: "tab-switch",
            reason: "Tab switched",
            evidence,
          });
        })();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [addStrike, examStarted]);

  // --------------------------------------------------
  // ANSWERS
  // --------------------------------------------------

  const handleAnswerChange = (
    questionId: string,
    answer: string
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  // --------------------------------------------------
  // SUBMIT
  // --------------------------------------------------

  const handleSubmit =
    async (
      forceSubmit = false
    ) => {
      if (
        !assessment ||
        !user?.id
      )
        return;

      const unanswered =
        assessment.questions.filter(
          (
            q: {
              id: string;
            }
          ) =>
            !answers[q.id]?.trim()
        );

      if (
        unanswered.length > 0
        && !forceSubmit
      ) {
        const proceed =
          confirm(
            `You have ${unanswered.length} unanswered question(s). Submit anyway?`
          );

        if (!proceed) return;
      }

      setIsSubmitting(true);

      try {
        const answerList: AssessmentAnswer[] =
          getAnswerList();

        const result =
          await assessmentsApi.submitAssessment(
            assessment.id,
            user.id,
            answerList
          );

        setSubmissionResult(
          result
        );

        setSubmissionId(result.id);

        setSubmitted(true);

        toast.success(
          "Assessment submitted successfully!"
        );
      } catch (
      error: unknown
      ) {
        const err =
          error as {
            response?: {
              data?: {
                detail?: string;
              };
            };
          };

        toast.error(
          err.response?.data
            ?.detail ||
          "Failed to submit assessment"
        );
      } finally {
        setIsSubmitting(false);
      }
    };

  useEffect(() => {
    if (
      !attemptLoaded ||
      !assessment ||
      !hasPersistedStart ||
      submitted ||
      disqualified ||
      isSubmitting ||
      timeRemaining !== 0
    )
      return;

    handleSubmit(true);
  }, [
    assessment,
    attemptLoaded,
    disqualified,
    hasPersistedStart,
    isSubmitting,
    submitted,
    timeRemaining,
  ]);

  // --------------------------------------------------
  // TIME FORMAT
  // --------------------------------------------------

  const formatTime = (
    seconds: number
  ) => {
    const m = Math.floor(
      seconds / 60
    );

    const s = seconds % 60;

    return `${m}:${s
      .toString()
      .padStart(2, "0")}`;
  };

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (isLoading) {
    return (
      <ProtectedRoute>
        <PageWrapper>
          <div className="max-w-3xl mx-auto px-4">
            Loading...
          </div>
        </PageWrapper>
      </ProtectedRoute>
    );
  }

  // --------------------------------------------------
  // NOT FOUND
  // --------------------------------------------------

  if (!assessment) {
    return (
      <ProtectedRoute>
        <PageWrapper>
          <div className="max-w-3xl mx-auto px-4 text-center py-20">
            Assessment not found
          </div>
        </PageWrapper>
      </ProtectedRoute>
    );
  }

  const proctorPanel = warningAccepted && !submitted && !disqualified ? (
    <AssessmentFaceProctor
      ref={proctorRef}
      active={examStarted && !submitted && !disqualified}
      strikeCount={strikes}
      onStrike={addStrike}
      onStatusChange={(status) => {
        setModelsLoaded(status.modelsLoaded);
        setWebcamReady(status.webcamReady);
        setFaceDetected(status.faceDetected);
        setFullscreenOk(status.fullscreenOk);
        setWindowMaximized(status.windowMaximized);
      }}
    />
  ) : null;

  let pageContent: React.ReactNode;

  if (disqualified) {
    pageContent = (
      <div className="max-w-xl mx-auto px-4 py-20">
        <div className="bg-red-500/10 backdrop-blur-2xl border border-red-500/30 rounded-[40px] p-10 text-center">
          <h1 className="text-4xl font-black text-red-400 mb-4 uppercase">Disqualified</h1>
          <p className="text-white/60 uppercase tracking-widest text-sm">
            Multiple proctoring violations detected
          </p>
          <div className="mt-6 text-red-400 font-black text-2xl">
            {strikes} / 3 strikes
          </div>
        </div>
      </div>
    );
  } else if (submitted && submissionResult) {
    pageContent = (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[40px] shadow-2xl p-10 text-center">
          <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">Complete</h2>
          <p className="text-white/60 text-sm uppercase tracking-widest mb-8">
            Assessment submitted successfully
          </p>
          <a href="/dashboard" className="inline-block w-full py-4 bg-white text-slate-900 font-black rounded-2xl">
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  } else if (!warningAccepted) {
    pageContent = (
      <div className="max-w-2xl mx-auto px-4 py-20">
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[40px] p-10">
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-8">Proctoring Rules</h1>
          <div className="space-y-4 text-white/70 text-sm uppercase tracking-wider">
            <p>• Webcam must remain enabled</p>
            <p>• Exactly one face must remain visible</p>
            <p>• Looking away counts as strikes</p>
            <p>• A different face or multiple faces counts as strikes</p>
            <p>• Tab switching counts as strikes</p>
            <p>• Leaving fullscreen counts as strikes</p>
            <p>• 3 strikes = disqualification</p>
          </div>
          <button
            onClick={async () => {
              if (assessment && user?.id) {
                try {
                  const updated = await assessmentsApi.updateAttemptState(
                    assessment.id,
                    user.id,
                    {
                      warningAccepted: true,
                      lastActivityAt: new Date().toISOString(),
                    },
                  );
                  setSubmissionId(updated.id);
                } catch {
                  toast.error("Failed to save assessment state.");
                  return;
                }
              }
              setWarningAccepted(true);
            }}
            className="mt-10 w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest"
          >
            I Understand
          </button>
        </div>
      </div>
    );
  } else if (!examStarted) {
    pageContent = (
      <div className="max-w-xl mx-auto px-4 py-20">
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[40px] p-10 text-center">
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-4">
            {hasPersistedStart ? "Resume Assessment" : "Start Assessment"}
          </h1>
          <p className="text-white/60 uppercase tracking-widest text-sm mb-8">
            {hasPersistedStart
              ? "Your timer and answers are already running. Re-enable webcam and fullscreen to continue."
              : "Webcam, face tracking, and fullscreen are required."}
          </p>
          {!modelsLoaded && (
            <p className="text-yellow-400 mb-4 uppercase text-xs tracking-widest">
              Loading face tracking models...
            </p>
          )}
          <button
            disabled={!modelsLoaded}
            onClick={startExam}
            className="w-full bg-white text-slate-900 py-4 rounded-2xl font-black uppercase tracking-widest disabled:opacity-40"
          >
            {hasPersistedStart ? "Resume with Camera" : "Enable Camera & Start"}
          </button>
        </div>
      </div>
    );
  } else {
    pageContent = (
      <div className="max-w-3xl mx-auto px-4 pb-32">
          {/* HEADER */}

          <div className="bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[32px] p-8 mb-8 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">
                  {
                    assessment.title
                  }
                </h1>

                <p className="text-white/50 text-xs font-bold uppercase tracking-widest mt-3">
                  {
                    assessment
                      .questions
                      .length
                  }{" "}
                  Questions
                </p>
              </div>

              {timeRemaining !==
                null && (
                  <div className="px-6 py-3 rounded-2xl border-2 bg-white/5 border-white/20">
                    <div className="text-3xl font-black font-mono tracking-tighter leading-none">
                      {formatTime(
                        timeRemaining
                      )}
                    </div>

                    <div className="text-[10px] font-bold uppercase tracking-widest text-center mt-1 opacity-50">
                      Remaining
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* QUESTIONS */}

          <div className="space-y-8">
            {assessment.questions.map(
              (
                question,
                index
              ) => (
                <div
                  key={
                    question.id
                  }
                  className="group bg-black/20 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 transition-all"
                >
                  <div className="flex items-start gap-5 mb-8">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-sm font-black text-white/40">
                      {String(
                        index + 1
                      ).padStart(
                        2,
                        "0"
                      )}
                    </div>

                    <div className="flex-1">
                      <p className="text-lg font-bold leading-snug text-white/90">
                        {
                          question.text
                        }
                      </p>
                    </div>
                  </div>

                  <div className="ml-0 md:ml-14">
                    {question.type ===
                      "MCQ" &&
                      question.options ? (
                      <div className="grid grid-cols-1 gap-3">
                        {question.options.map(
                          (
                            option,
                            oi
                          ) => (
                            <label
                              key={
                                oi
                              }
                              className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${answers[
                                  question
                                    .id
                                ] ===
                                  option
                                  ? "bg-white text-slate-900 border-white"
                                  : "bg-white/5 border-white/5"
                                }`}
                            >
                              <input
                                type="radio"
                                name={`question-${question.id}`}
                                value={
                                  option
                                }
                                checked={
                                  answers[
                                  question
                                    .id
                                  ] ===
                                  option
                                }
                                onChange={() =>
                                  handleAnswerChange(
                                    question.id,
                                    option
                                  )
                                }
                                className="hidden"
                              />

                              <div
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${answers[
                                    question
                                      .id
                                  ] ===
                                    option
                                    ? "border-slate-900"
                                    : "border-white/20"
                                  }`}
                              >
                                {answers[
                                  question
                                    .id
                                ] ===
                                  option && (
                                    <div className="w-2.5 h-2.5 bg-slate-900 rounded-full" />
                                  )}
                              </div>

                              <span className="text-sm font-bold uppercase tracking-tight">
                                {
                                  option
                                }
                              </span>
                            </label>
                          )
                        )}
                      </div>
                    ) : (
                      <textarea
                        value={
                          answers[
                          question
                            .id
                          ] || ""
                        }
                        onChange={(
                          e
                        ) =>
                          handleAnswerChange(
                            question.id,
                            e.target
                              .value
                          )
                        }
                        className="w-full bg-white/5 border-2 border-white/10 rounded-2xl p-6 text-sm text-white"
                        rows={
                          4
                        }
                      />
                    )}
                  </div>
                </div>
              )
            )}
          </div>

          {/* SUBMIT BAR */}

          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50">
            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between gap-4">
              <div className="pl-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/40">
                  Progress
                </div>

                <div className="text-sm font-bold">
                  {
                    Object.keys(
                      answers
                    ).filter(
                      (k) =>
                        answers[
                          k
                        ]?.trim()
                    ).length
                  }{" "}
                  /{" "}
                  {
                    assessment
                      .questions
                      .length
                  }{" "}
                  answered
                </div>
              </div>

              <button
                onClick={() =>
                  handleSubmit()
                }
                disabled={
                  isSubmitting ||
                  timeRemaining ===
                  0
                }
                className="bg-white text-slate-900 px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest"
              >
                {isSubmitting
                  ? "Submitting..."
                  : "Submit Assessment"}
              </button>
            </div>
          </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <PageWrapper>
        {proctorPanel}
        {pageContent}
      </PageWrapper>
    </ProtectedRoute>
  );
}
