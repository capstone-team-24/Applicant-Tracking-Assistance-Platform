"use client";

import {
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";

import { useParams } from "next/navigation";

import * as faceapi from "face-api.js";

import { assessmentsApi } from "@/lib/api";

import { useAuth } from "@/lib/auth";

import type {
  Assessment,
  AssessmentAnswer,
  AssessmentSubmission,
} from "@/lib/types";

import ProtectedRoute from "@/components/ProtectedRoute";

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

  const videoRef =
    useRef<HTMLVideoElement | null>(
      null
    );

  const streamRef =
    useRef<MediaStream | null>(null);

  const detectionInterval =
    useRef<NodeJS.Timeout | null>(null);

  const detectionRunning =
    useRef(false);

  const missingFaceStart =
    useRef<number | null>(null);

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

        if (data.timeLimitMinutes) {
          setTimeRemaining(
            data.timeLimitMinutes * 60
          );
        }
      } catch {
        toast.error(
          "Failed to load assessment."
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (token) fetchAssessment();
  }, [token, user?.id]);

  // --------------------------------------------------
  // LOAD FACE API MODELS
  // --------------------------------------------------

  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log("[FACE-API] Starting to load models from /models...");
        // Reverting to ssdMobilenetv1 as it's more accurate for face detection
        await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
        console.log("[FACE-API] Successfully loaded ssdMobilenetv1");
        await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
        console.log("[FACE-API] Successfully loaded faceLandmark68Net");
        setModelsLoaded(true);
      } catch (err) {
        console.error("[FACE-API] Failed to load face detection models:", err);
        toast.error(
          "Failed to load proctoring AI — please refresh."
        );
      }
    };

    loadModels();
  }, []);

  // --------------------------------------------------
  // TIMER
  // --------------------------------------------------

  useEffect(() => {
    if (
      timeRemaining === null ||
      submitted
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

            handleSubmit();

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
  }, [timeRemaining, submitted]);

  // --------------------------------------------------
  // AUTOSAVE
  // --------------------------------------------------

  const doAutosave = useCallback(
    async () => {
      if (
        !assessment ||
        !user?.id ||
        submitted
      )
        return;

      const answerList: AssessmentAnswer[] =
        Object.entries(answers).map(
          ([questionId, answer]) => ({
            questionId,
            answer,
          })
        );

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
      answers,
      submitted,
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
    (reason: string) => {
      setStrikes((prev) => {
        const next = prev + 1;

        toast.error(reason);

        if (next >= 3) {
          setDisqualified(true);

          toast.error(
            "Assessment disqualified."
          );
        }

        return next;
      });
    },
    []
  );

  // --------------------------------------------------
  // FULLSCREEN CHECK
  // --------------------------------------------------

  const checkFullscreen =
    useCallback(() => {
      const isFullscreen =
        !!document.fullscreenElement;

      setFullscreenOk(isFullscreen);

      const widthDiff = Math.abs(
        window.outerWidth -
        screen.width
      );

      const heightDiff = Math.abs(
        window.outerHeight -
        screen.height
      );

      const maximized =
        widthDiff < 20 &&
        heightDiff < 120;

      setWindowMaximized(maximized);

      if (
        examStarted &&
        (!isFullscreen ||
          !maximized)
      ) {
        addStrike(
          "Fullscreen exited"
        );
      }
    }, [addStrike, examStarted]);

  // --------------------------------------------------
  // START EXAM
  // --------------------------------------------------

  const startExam = async () => {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: {
              facingMode:
                "user",
              width: {
                ideal: 1280,
              },
              height: {
                ideal: 720,
              },
            },

            audio: false,
          }
        );

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject =
          stream;

        await new Promise<void>(
          (resolve) => {
            videoRef.current!.onloadedmetadata =
              () => {
                videoRef.current?.play();

                resolve();
              };
          }
        );
      }

      setWebcamReady(true);
      console.log("[FACE-API] Webcam stream active and bound to videoRef.");

      await document.documentElement.requestFullscreen();

      checkFullscreen();

      setExamStarted(true);
    } catch (err) {
      console.error(err);

      toast.error(
        "Camera permission required."
      );
    }
  };

  // --------------------------------------------------
  // FACE DETECTION
  // --------------------------------------------------

  const detectFace = useCallback(
    async () => {
      // Guard: video must exist and have frames
      if (
        !videoRef.current ||
        videoRef.current.readyState < 2 ||
        detectionRunning.current ||
        disqualified
      )
        return;

      detectionRunning.current = true;

      try {
        console.log("[FACE-API] Attempting detection. Video readyState:", videoRef.current.readyState, "Dimensions:", videoRef.current.videoWidth, "x", videoRef.current.videoHeight);
        
        const detection =
          await faceapi
            .detectSingleFace(
              videoRef.current,
              new faceapi.SsdMobilenetv1Options({
                minConfidence: 0.1,
              })
            )
            .withFaceLandmarks();

        console.log("[FACE-API] Detection result:", detection ? "Found" : "Not Found", detection);

        if (!detection) {
          setFaceDetected(false);

          if (!missingFaceStart.current) {
            missingFaceStart.current = Date.now();
          }

          // Only strike after face has been missing for 4 seconds
          if (
            Date.now() - missingFaceStart.current! > 4000
          ) {
            addStrike("Face not detected — please stay in frame");
            // Reset so we don't spam strikes every interval
            missingFaceStart.current = null;
          }

          detectionRunning.current = false;
          return;
        }

        // Face found — clear the missing-face timer
        setFaceDetected(true);
        missingFaceStart.current = null;

        // HEAD TURN check (skipping EAR — too many false positives)
        const landmarks = detection.landmarks;
        const jaw = landmarks.getJawOutline();
        const leftJaw = jaw[0];
        const rightJaw = jaw[16];
        const faceWidth = rightJaw.x - leftJaw.x;
        const nose = landmarks.getNose()[3];
        const centerX = leftJaw.x + faceWidth / 2;
        const deviation = Math.abs(nose.x - centerX);

        // 20% deviation threshold — more sensitive to detect looking away
        if (deviation > faceWidth * 0.20) {
          addStrike("Looking away from screen");
        }
      } catch (err) {
        console.error("Face detection error:", err);
      }

      detectionRunning.current = false;
    },
    [addStrike, disqualified]
  );

  // --------------------------------------------------
  // DETECTION LOOP
  // --------------------------------------------------

  useEffect(() => {
    if (!examStarted) return;

    detectionInterval.current =
      setInterval(
        detectFace,
        1200
      );

    return () => {
      if (
        detectionInterval.current
      ) {
        clearInterval(
          detectionInterval.current
        );
      }
    };
  }, [detectFace, examStarted]);

  // --------------------------------------------------
  // TAB SWITCH
  // --------------------------------------------------

  useEffect(() => {
    const handleVisibility = () => {
      if (
        document.hidden &&
        examStarted
      ) {
        addStrike(
          "Tab switched"
        );
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
  // FULLSCREEN EVENTS
  // --------------------------------------------------

  useEffect(() => {
    document.addEventListener(
      "fullscreenchange",
      checkFullscreen
    );

    window.addEventListener(
      "resize",
      checkFullscreen
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        checkFullscreen
      );

      window.removeEventListener(
        "resize",
        checkFullscreen
      );
    };
  }, [checkFullscreen]);

  // --------------------------------------------------
  // CLEANUP
  // --------------------------------------------------

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((t) =>
            t.stop()
          );
      }
    };
  }, []);

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
    async () => {
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
          Object.entries(
            answers
          ).map(
            ([
              questionId,
              answer,
            ]) => ({
              questionId,
              answer,
            })
          );

        const result =
          await assessmentsApi.submitAssessment(
            assessment.id,
            user.id,
            answerList
          );

        setSubmissionResult(
          result
        );

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

  // --------------------------------------------------
  // DISQUALIFIED
  // --------------------------------------------------

  if (disqualified) {
    return (
      <ProtectedRoute>
        <PageWrapper>
          <div className="max-w-xl mx-auto px-4 py-20">
            <div className="bg-red-500/10 backdrop-blur-2xl border border-red-500/30 rounded-[40px] p-10 text-center">
              <h1 className="text-4xl font-black text-red-400 mb-4 uppercase">
                Disqualified
              </h1>

              <p className="text-white/60 uppercase tracking-widest text-sm">
                Multiple
                proctoring
                violations
                detected
              </p>

              <div className="mt-6 text-red-400 font-black text-2xl">
                {strikes} / 3
                strikes
              </div>
            </div>
          </div>
        </PageWrapper>
      </ProtectedRoute>
    );
  }

  // --------------------------------------------------
  // SUBMITTED
  // --------------------------------------------------

  if (
    submitted &&
    submissionResult
  ) {
    return (
      <ProtectedRoute>
        <PageWrapper>
          <div className="max-w-xl mx-auto px-4 py-12">
            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[40px] shadow-2xl p-10 text-center">
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">
                Complete
              </h2>

              <p className="text-white/60 text-sm uppercase tracking-widest mb-8">
                Assessment
                submitted
                successfully
              </p>

              <a
                href="/dashboard"
                className="inline-block w-full py-4 bg-white text-slate-900 font-black rounded-2xl"
              >
                Return to
                Dashboard
              </a>
            </div>
          </div>
        </PageWrapper>
      </ProtectedRoute>
    );
  }

  // --------------------------------------------------
  // WARNING
  // --------------------------------------------------

  if (!warningAccepted) {
    return (
      <ProtectedRoute>
        <PageWrapper>
          <div className="max-w-2xl mx-auto px-4 py-20">
            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[40px] p-10">
              <h1 className="text-4xl font-black uppercase tracking-tighter mb-8">
                AI Proctoring
                Rules
              </h1>

              <div className="space-y-4 text-white/70 text-sm uppercase tracking-wider">
                <p>
                  • Webcam
                  must remain
                  enabled
                </p>

                <p>
                  • Face must
                  remain
                  visible
                </p>

                <p>
                  • Looking
                  away counts
                  as strikes
                </p>

                <p>
                  • Tab
                  switching
                  counts as
                  strikes
                </p>

                <p>
                  • Leaving
                  fullscreen
                  counts as
                  strikes
                </p>

                <p>
                  • 3 strikes
                  =
                  disqualification
                </p>
              </div>

              <button
                onClick={() =>
                  setWarningAccepted(
                    true
                  )
                }
                className="mt-10 w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest"
              >
                I Understand
              </button>
            </div>
          </div>
        </PageWrapper>
      </ProtectedRoute>
    );
  }

  // --------------------------------------------------
  // START
  // --------------------------------------------------

  if (!examStarted) {
    return (
      <ProtectedRoute>
        <PageWrapper>
          <div className="max-w-xl mx-auto px-4 py-20">
            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[40px] p-10 text-center">
              <h1 className="text-4xl font-black uppercase tracking-tighter mb-4">
                Start
                Assessment
              </h1>

              <p className="text-white/60 uppercase tracking-widest text-sm mb-8">
                Webcam and
                fullscreen
                are required
              </p>

              {!modelsLoaded && (
                <p className="text-yellow-400 mb-4 uppercase text-xs tracking-widest">
                  Loading AI
                  models...
                </p>
              )}

              <button
                disabled={
                  !modelsLoaded
                }
                onClick={
                  startExam
                }
                className="w-full bg-white text-slate-900 py-4 rounded-2xl font-black uppercase tracking-widest disabled:opacity-40"
              >
                Enable
                Camera &
                Start
              </button>
            </div>
          </div>
        </PageWrapper>
      </ProtectedRoute>
    );
  }

  // --------------------------------------------------
  // MAIN PAGE
  // --------------------------------------------------

  return (
    <ProtectedRoute>
      <PageWrapper>
        {/* PROCTOR PANEL */}

        <div className="fixed left-4 top-4 z-50 w-72 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-4 shadow-2xl">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            width={1280}
            height={720}
            className="w-full rounded-2xl mb-4"
          />

          <div className="space-y-2 text-[10px] font-black uppercase tracking-widest">
            <div>
              Camera:
              <span
                className={
                  webcamReady
                    ? "text-green-400"
                    : "text-red-400"
                }
              >
                {webcamReady
                  ? " ON"
                  : " OFF"}
              </span>
            </div>

            <div>
              Face:
              <span
                className={
                  faceDetected
                    ? "text-green-400"
                    : "text-red-400"
                }
              >
                {faceDetected
                  ? " DETECTED"
                  : " NOT FOUND"}
              </span>
            </div>

            <div>
              Fullscreen:
              <span
                className={
                  fullscreenOk
                    ? "text-green-400"
                    : "text-red-400"
                }
              >
                {fullscreenOk
                  ? " ACTIVE"
                  : " OFF"}
              </span>
            </div>

            <div>
              Window:
              <span
                className={
                  windowMaximized
                    ? "text-green-400"
                    : "text-red-400"
                }
              >
                {windowMaximized
                  ? " MAXIMIZED"
                  : " RESIZED"}
              </span>
            </div>

            <div>
              Strikes:
              <span className="text-red-400">
                {" "}
                {strikes} / 3
              </span>
            </div>
          </div>
        </div>

        {/* MAIN */}

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
                          question.type ===
                            "CODE"
                            ? 8
                            : 4
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
                onClick={
                  handleSubmit
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
      </PageWrapper>
    </ProtectedRoute>
  );
}