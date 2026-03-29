"use client";

import { useEffect, useRef, useCallback } from "react";
import { renderAvatar } from "@/lib/avatar/avatar-renderer";
import { useAvatarStore } from "@/stores/avatar-store";
import {
  FaceLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const FACE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

/**
 * Live avatar preview component.
 * Acquires webcam, runs FaceLandmarker at ~30fps, and draws the avatar
 * on a canvas in real-time.
 */
export function AvatarPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(-1);
  const mountedRef = useRef(true);

  const { setTracking, setError } = useAvatarStore();
  const getEffectiveStyle = useAvatarStore((s) => s.getEffectiveStyle);

  // Initialize FaceLandmarker and webcam
  const initialize = useCallback(async () => {
    try {
      setError(null);

      // Initialize FaceLandmarker with blendshapes enabled for expressions
      const wasmFileset = await FilesetResolver.forVisionTasks(WASM_CDN);
      const landmarker = await FaceLandmarker.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath: FACE_LANDMARKER_MODEL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      });

      if (!mountedRef.current) {
        landmarker.close();
        return;
      }

      landmarkerRef.current = landmarker;

      // Acquire webcam
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        landmarker.close();
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setTracking(true);
      startRenderLoop();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to initialize avatar";
      // Camera/MediaPipe init failures are expected when hardware isn't available
      setError(msg);
    }
  }, [setTracking, setError]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render loop with 30fps throttle
  const startRenderLoop = useCallback(() => {
    const loop = (time: number) => {
      if (!mountedRef.current) return;
      rafRef.current = requestAnimationFrame(loop);

      // Throttle to ~30fps
      const delta = time - lastFrameTimeRef.current;
      if (delta < FRAME_INTERVAL) return;
      lastFrameTimeRef.current = time - (delta % FRAME_INTERVAL);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !canvas || !landmarker) return;
      if (video.readyState < 2) return; // not enough data

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Ensure canvas is properly sized
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      // Run face detection
      const timestamp = performance.now();
      let ts = timestamp;
      if (ts <= lastTimestampRef.current) {
        ts = lastTimestampRef.current + 1;
      }
      lastTimestampRef.current = ts;

      try {
        const result = landmarker.detectForVideo(video, ts);
        if (
          result.faceLandmarks &&
          result.faceLandmarks.length > 0
        ) {
          const landmarks = result.faceLandmarks[0];
          const style = getEffectiveStyle();
          renderAvatar({
            ctx,
            landmarks,
            style,
            width: canvas.width,
            height: canvas.height,
          });
        } else {
          // No face detected — draw idle state
          const style = getEffectiveStyle();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = style.backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.font = "14px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            "Position your face in front of the camera",
            canvas.width / 2,
            canvas.height / 2,
          );
        }
      } catch (err) {
        // Silently continue on detection errors
      }
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [getEffectiveStyle]);

  // Lifecycle: init on mount, cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    initialize();

    return () => {
      mountedRef.current = false;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      setTracking(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black/90 border border-border/40">
      {/* Hidden video element for camera feed */}
      <video
        ref={videoRef}
        className="hidden"
        autoPlay
        muted
        playsInline
      />
      {/* Avatar canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
    </div>
  );
}
