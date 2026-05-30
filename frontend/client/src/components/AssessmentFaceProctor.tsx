"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as faceapi from "face-api.js";
import type { ProctorEvidence, ProctorEvidenceImage } from "@/lib/types";

export type ProctorStatus = {
  modelsLoaded: boolean;
  webcamReady: boolean;
  faceDetected: boolean;
  screenCaptureReady: boolean;
  fullscreenOk: boolean;
  windowMaximized: boolean;
};

export type ProctorStrike = {
  type: string;
  reason: string;
  evidence?: ProctorEvidence;
};

export type AssessmentFaceProctorHandle = {
  prepare: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => void;
  captureEvidence: () => Promise<ProctorEvidence>;
};

type AssessmentFaceProctorProps = {
  active: boolean;
  strikeCount: number;
  onStrike: (strike: ProctorStrike) => void | Promise<void>;
  onStatusChange?: (status: ProctorStatus) => void;
};

const MODEL_URL = "/models";
const DETECTION_INTERVAL_MS = 850;
const STRIKE_COOLDOWN_MS = 8000;
const FACE_STRIKE_COOLDOWN_MS = 10000;
const MISSING_FACE_GRACE_MS = 3500;
const MULTIPLE_FACE_GRACE_MS = 2000;
const LOOK_AWAY_GRACE_MS = 2500;
const FACE_STRIKE_KEYS = new Set([
  "missing-face",
  "multiple-face",
  "identity-change",
  "small-face",
  "look-away",
]);
const WEBCAM_EVIDENCE_MAX_WIDTH = 360;
const SCREEN_EVIDENCE_MAX_WIDTH = 640;
const EVIDENCE_IMAGE_QUALITY = 0.42;
const TINY_FACE_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 416,
  scoreThreshold: 0.45,
});

function isWindowMaximized() {
  const widthDiff = Math.abs(window.outerWidth - window.screen.width);
  const heightDiff = Math.abs(window.outerHeight - window.screen.height);
  return widthDiff < 24 && heightDiff < 140;
}

function hasActiveVideoTrack(stream: MediaStream | null) {
  return Boolean(
    stream?.getVideoTracks().some((track) => track.readyState === "live"),
  );
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function center(points: faceapi.Point[]) {
  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function descriptorDistance(a: Float32Array, b: Float32Array) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function captureVideoFrame(
  video: HTMLVideoElement | null,
  source: ProctorEvidenceImage["source"],
  maxWidth: number,
): ProctorEvidenceImage | null {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return null;
  }

  const scale = Math.min(1, maxWidth / video.videoWidth);
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(video, 0, 0, width, height);
  return {
    source,
    dataUrl: canvas.toDataURL("image/jpeg", EVIDENCE_IMAGE_QUALITY),
    mimeType: "image/jpeg",
    width,
    height,
    capturedAt: new Date().toISOString(),
  };
}

const AssessmentFaceProctor = forwardRef<
  AssessmentFaceProctorHandle,
  AssessmentFaceProctorProps
>(function AssessmentFaceProctor(
  { active, strikeCount, onStrike, onStatusChange },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectionRunningRef = useRef(false);
  const baselineDescriptorRef = useRef<Float32Array | null>(null);
  const missingSinceRef = useRef<number | null>(null);
  const multipleSinceRef = useRef<number | null>(null);
  const lookAwaySinceRef = useRef<number | null>(null);
  const smallFaceSinceRef = useRef<number | null>(null);
  const smoothedPoseRef = useRef<{ yaw: number; pitch: number } | null>(null);
  const lastStrikeAtRef = useRef<Record<string, number>>({});
  const lastFaceStrikeAtRef = useRef(0);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [webcamReady, setWebcamReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [screenCaptureReady, setScreenCaptureReady] = useState(false);
  const [fullscreenOk, setFullscreenOk] = useState(false);
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [trackingDetail, setTrackingDetail] = useState("Waiting to start");
  const statusRef = useRef<ProctorStatus>({
    modelsLoaded: false,
    webcamReady: false,
    faceDetected: false,
    screenCaptureReady: false,
    fullscreenOk: false,
    windowMaximized: false,
  });
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const emitStatus = useCallback(
    (next: Partial<ProctorStatus>) => {
      const updated = { ...statusRef.current, ...next };
      statusRef.current = updated;

      if (next.modelsLoaded !== undefined) setModelsLoaded(updated.modelsLoaded);
      if (next.webcamReady !== undefined) setWebcamReady(updated.webcamReady);
      if (next.faceDetected !== undefined) setFaceDetected(updated.faceDetected);
      if (next.screenCaptureReady !== undefined) setScreenCaptureReady(updated.screenCaptureReady);
      if (next.fullscreenOk !== undefined) setFullscreenOk(updated.fullscreenOk);
      if (next.windowMaximized !== undefined) setWindowMaximized(updated.windowMaximized);

      onStatusChangeRef.current?.(updated);
    },
    [],
  );

  const captureEvidence = useCallback(async (): Promise<ProctorEvidence> => {
    const evidence: ProctorEvidence = {};
    const webcamPhoto = captureVideoFrame(
      videoRef.current,
      "webcam",
      WEBCAM_EVIDENCE_MAX_WIDTH,
    );
    const screenCapture = captureVideoFrame(
      screenVideoRef.current,
      "screen",
      SCREEN_EVIDENCE_MAX_WIDTH,
    );

    if (webcamPhoto) {
      evidence.webcamPhoto = webcamPhoto;
    } else {
      evidence.webcamUnavailableReason = "Webcam frame was not ready at the strike time.";
    }

    if (screenCapture) {
      evidence.screenCapture = screenCapture;
    } else {
      evidence.screenCaptureUnavailableReason = screenStreamRef.current
        ? "Screen-share frame was not ready at the strike time."
        : "Screen sharing was not active or was not granted by the candidate.";
    }

    return evidence;
  }, []);

  const emitStrike = useCallback(
    (key: string, reason: string) => {
      const now = Date.now();
      const last = lastStrikeAtRef.current[key] ?? 0;
      if (now - last < STRIKE_COOLDOWN_MS) return;

      if (
        FACE_STRIKE_KEYS.has(key) &&
        now - lastFaceStrikeAtRef.current < FACE_STRIKE_COOLDOWN_MS
      ) {
        return;
      }

      lastStrikeAtRef.current[key] = now;
      if (FACE_STRIKE_KEYS.has(key)) lastFaceStrikeAtRef.current = now;
      void (async () => {
        const evidence = await captureEvidence();
        await onStrike({ type: key, reason, evidence });
      })();
    },
    [captureEvidence, onStrike],
  );

  const updateFullscreenState = useCallback(() => {
    const nextFullscreen = Boolean(document.fullscreenElement);
    const nextMaximized = isWindowMaximized();
    setFullscreenOk(nextFullscreen);
    setWindowMaximized(nextMaximized);
    emitStatus({ fullscreenOk: nextFullscreen, windowMaximized: nextMaximized });

    if (active && !nextFullscreen) {
      emitStrike("fullscreen", "Fullscreen exited");
    }
    if (active && !nextMaximized) {
      emitStrike("window-size", "Browser window is not maximized");
    }
  }, [active, emitStatus, emitStrike]);

  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      try {
        setTrackingDetail("Loading face tracking models");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        if (!cancelled) {
          setModelsLoaded(true);
          setTrackingDetail("Models loaded");
          emitStatus({ modelsLoaded: true });
        }
      } catch (error) {
        console.error("Failed to load face tracking models", error);
        setTrackingDetail("Model loading failed");
      }
    };

    loadModels();
    return () => {
      cancelled = true;
    };
  }, [emitStatus]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    detectionRunningRef.current = false;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;

    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    screenVideoRef.current = null;

    setWebcamReady(false);
    setFaceDetected(false);
    setScreenCaptureReady(false);
    setTrackingDetail("Stopped");
    emitStatus({ webcamReady: false, faceDetected: false, screenCaptureReady: false });
  }, [emitStatus]);

  const waitForInitialFace = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      throw new Error("Camera is not ready yet.");
    }

    setTrackingDetail("Checking face visibility");
    const deadline = Date.now() + 5000;

    while (Date.now() < deadline) {
      const detections = await faceapi
        .detectAllFaces(video, TINY_FACE_OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 1) {
        const primary = detections[0] as any;
        baselineDescriptorRef.current = primary.descriptor as Float32Array;
        setFaceDetected(true);
        setTrackingDetail("Face tracked");
        emitStatus({ faceDetected: true });
        return;
      }

      setFaceDetected(false);
      emitStatus({ faceDetected: false });
      setTrackingDetail(
        detections.length > 1 ? "Multiple faces detected" : "No face detected",
      );
      await wait(400);
    }

    throw new Error("Keep exactly one face visible before starting.");
  }, [emitStatus]);

  const prepare = useCallback(async () => {
    if (!modelsLoaded) {
      throw new Error("Face tracking models are still loading");
    }

    stop();

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }
    updateFullscreenState();

    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== "function"
    ) {
      throw new Error("Screen sharing is not supported by this browser.");
    }

    if (typeof navigator.mediaDevices.getUserMedia !== "function") {
      throw new Error("Camera access is not supported by this browser.");
    }

    let screenStream: MediaStream | null = null;
    let stream: MediaStream | null = null;
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      if (!hasActiveVideoTrack(screenStream)) {
        throw new Error("Screen sharing permission is required.");
      }

      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (error) {
      screenStream?.getTracks().forEach((track) => track.stop());
      stream?.getTracks().forEach((track) => track.stop());
      stop();
      throw error;
    }

    if (!stream || !screenStream) {
      throw new Error("Camera and screen sharing are required.");
    }

    streamRef.current = stream;

    if (!videoRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      screenStream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      throw new Error("Camera preview is not ready yet.");
    }
    videoRef.current.srcObject = stream;

    await new Promise<void>((resolve) => {
      if (!videoRef.current) return resolve();
      videoRef.current.onloadedmetadata = () => {
        void videoRef.current?.play();
        resolve();
      };
    });

    const screenVideo = document.createElement("video");
    screenVideo.muted = true;
    screenVideo.playsInline = true;
    screenVideo.srcObject = screenStream;
    screenStreamRef.current = screenStream;
    screenVideoRef.current = screenVideo;

    screenStream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        if (screenStreamRef.current !== screenStream) return;
        screenStreamRef.current = null;
        if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
        screenVideoRef.current = null;
        setScreenCaptureReady(false);
        emitStatus({ screenCaptureReady: false });
      });
    });

    await screenVideo.play().catch(() => undefined);

    setWebcamReady(true);
    setScreenCaptureReady(true);
    setTrackingDetail("Camera and screen share ready");
    emitStatus({ webcamReady: true, screenCaptureReady: true });
    updateFullscreenState();
  }, [emitStatus, modelsLoaded, stop, updateFullscreenState]);

  const start = useCallback(async () => {
    if (!modelsLoaded) {
      throw new Error("Face tracking models are still loading");
    }

    if (!hasActiveVideoTrack(screenStreamRef.current)) {
      throw new Error("Grant screen sharing before starting.");
    }

    if (!hasActiveVideoTrack(streamRef.current) || !videoRef.current) {
      throw new Error("Grant camera access before starting.");
    }

    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }

    updateFullscreenState();

    if (!document.fullscreenElement) {
      throw new Error("Fullscreen mode is required before starting.");
    }

    if (!isWindowMaximized()) {
      throw new Error("Maximize your browser window before starting.");
    }

    await waitForInitialFace();

    baselineDescriptorRef.current = null;
    missingSinceRef.current = null;
    multipleSinceRef.current = null;
    lookAwaySinceRef.current = null;
    smallFaceSinceRef.current = null;
    smoothedPoseRef.current = null;

    setWebcamReady(true);
    setTrackingDetail("Camera active");
    emitStatus({ webcamReady: true });
    updateFullscreenState();
  }, [emitStatus, modelsLoaded, updateFullscreenState, waitForInitialFace]);

  useImperativeHandle(
    ref,
    () => ({ prepare, start, stop, captureEvidence }),
    [captureEvidence, prepare, start, stop],
  );

  const detect = useCallback(async () => {
    const video = videoRef.current;
    if (!active || !video || video.readyState < 2 || detectionRunningRef.current) return;

    detectionRunningRef.current = true;

    try {
      const detections = await faceapi
        .detectAllFaces(video, TINY_FACE_OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptors();

      const now = Date.now();

      if (detections.length === 0) {
        setFaceDetected(false);
        emitStatus({ faceDetected: false });
        setTrackingDetail("No face detected");
        missingSinceRef.current ??= now;
        if (now - missingSinceRef.current > MISSING_FACE_GRACE_MS) {
          emitStrike("missing-face", "Face not detected - please stay in frame");
          missingSinceRef.current = now;
        }
        return;
      }

      missingSinceRef.current = null;

      if (detections.length > 1) {
        multipleSinceRef.current ??= now;
        setTrackingDetail(`${detections.length} faces detected`);
        if (now - multipleSinceRef.current > MULTIPLE_FACE_GRACE_MS) {
          emitStrike("multiple-face", "Multiple faces detected");
          multipleSinceRef.current = now;
        }
      } else {
        multipleSinceRef.current = null;
      }

      const primary = detections.sort(
        (a: any, b: any) => b.detection.box.area - a.detection.box.area,
      )[0] as any;

      setFaceDetected(true);
      emitStatus({ faceDetected: true });

      const descriptor = primary.descriptor as Float32Array;
      if (!baselineDescriptorRef.current) {
        baselineDescriptorRef.current = descriptor;
      } else {
        const distance = descriptorDistance(baselineDescriptorRef.current, descriptor);
        if (distance > 0.62) {
          emitStrike("identity-change", "Different face detected");
        } else if (distance < 0.48) {
          baselineDescriptorRef.current = descriptor;
        }
      }

      const box = primary.detection.box;
      const videoWidth = video.videoWidth || 1;
      const faceSizeRatio = box.width / videoWidth;
      if (faceSizeRatio < 0.13) {
        smallFaceSinceRef.current ??= now;
        setTrackingDetail("Face too far from camera");
        if (now - smallFaceSinceRef.current > MISSING_FACE_GRACE_MS) {
          emitStrike("small-face", "Face is too far from camera");
          smallFaceSinceRef.current = now;
        }
      } else {
        smallFaceSinceRef.current = null;
      }

      const landmarks = primary.landmarks;
      const jaw = landmarks.getJawOutline();
      const leftEye = center(landmarks.getLeftEye());
      const rightEye = center(landmarks.getRightEye());
      const mouth = center(landmarks.getMouth());
      const nose = landmarks.getNose()[3];

      const faceWidth = Math.max(1, jaw[16].x - jaw[0].x);
      const faceCenterX = jaw[0].x + faceWidth / 2;
      const eyeMidY = (leftEye.y + rightEye.y) / 2;
      const mouthDistance = Math.max(1, mouth.y - eyeMidY);

      const rawYaw = Math.abs(nose.x - faceCenterX) / faceWidth;
      const rawPitch = (nose.y - eyeMidY) / mouthDistance;
      const previous = smoothedPoseRef.current;
      const smoothed = previous
        ? {
            yaw: previous.yaw * 0.65 + rawYaw * 0.35,
            pitch: previous.pitch * 0.65 + rawPitch * 0.35,
          }
        : { yaw: rawYaw, pitch: rawPitch };
      smoothedPoseRef.current = smoothed;

      const lookingAway = smoothed.yaw > 0.19 || smoothed.pitch < 0.32 || smoothed.pitch > 0.85;
      if (lookingAway) {
        lookAwaySinceRef.current ??= now;
        setTrackingDetail("Looking away detected");
        if (now - lookAwaySinceRef.current > LOOK_AWAY_GRACE_MS) {
          emitStrike("look-away", "Looking away from screen");
          lookAwaySinceRef.current = now;
        }
      } else {
        lookAwaySinceRef.current = null;
        setTrackingDetail("Face tracked");
      }
    } catch (error) {
      console.error("Face tracking failed", error);
      setTrackingDetail("Tracking error");
    } finally {
      detectionRunningRef.current = false;
    }
  }, [active, emitStatus, emitStrike]);

  useEffect(() => {
    if (!active || !webcamReady || !modelsLoaded) return;

    void detect();
    intervalRef.current = setInterval(() => {
      void detect();
    }, DETECTION_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, detect, modelsLoaded, webcamReady]);

  useEffect(() => {
    document.addEventListener("fullscreenchange", updateFullscreenState);
    window.addEventListener("resize", updateFullscreenState);
    updateFullscreenState();

    return () => {
      document.removeEventListener("fullscreenchange", updateFullscreenState);
      window.removeEventListener("resize", updateFullscreenState);
    };
  }, [updateFullscreenState]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return (
    <div className="fixed left-4 top-4 z-50 w-72 rounded-3xl border border-white/20 bg-white/10 p-4 shadow-2xl backdrop-blur-2xl">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        width={1280}
        height={720}
        className="mb-4 w-full rounded-2xl bg-black/30"
      />

      <div className="space-y-2 text-[10px] font-black uppercase tracking-widest">
        <StatusLine label="Models" ok={modelsLoaded} okText=" Loaded" badText=" Loading" />
        <StatusLine label="Camera" ok={webcamReady} okText=" On" badText=" Off" />
        <StatusLine label="Screen evidence" ok={screenCaptureReady} okText=" On" badText=" Off" />
        <StatusLine label="Face" ok={faceDetected} okText=" Tracked" badText=" Not found" />
        <StatusLine label="Fullscreen" ok={fullscreenOk} okText=" Active" badText=" Off" />
        <StatusLine label="Window" ok={windowMaximized} okText=" Maximized" badText=" Resized" />
        <div>
          Strikes:
          <span className="text-red-400"> {strikeCount} / 3</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white/60">
          {trackingDetail}
        </div>
      </div>
    </div>
  );
});

function StatusLine({
  label,
  ok,
  okText,
  badText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  badText: string;
}) {
  return (
    <div>
      {label}:
      <span className={ok ? "text-green-400" : "text-red-400"}>
        {ok ? okText : badText}
      </span>
    </div>
  );
}

export default AssessmentFaceProctor;
