import type { HdrTransfer } from "../utils/hdr.js";
import type { Fps } from "@hyperframes/core";

export interface EncoderOptions {
  /** Frame rate as an exact rational; see `Fps` in @hyperframes/core. */
  fps: Fps;
  width: number;
  height: number;
  codec?: "h264" | "h265" | "vp9" | "prores";
  preset?: string;
  quality?: number;
  bitrate?: string;
  pixelFormat?: string;
  useGpu?: boolean;
  hdr?: { transfer: HdrTransfer };
}

export interface EncodeResult {
  success: boolean;
  outputPath: string;
  durationMs: number;
  framesEncoded: number;
  fileSize: number;
  error?: string;
}

export interface MuxResult {
  success: boolean;
  outputPath: string;
  durationMs: number;
  error?: string;
}
