import type { SttError, SttStatus } from "./types";

export type Source = "mic" | "demo";

export type ControlPhase =
  | "idle" // nothing started yet
  | "starting" // clicked start, waiting for the browser (mic permission) or the first result
  | "live" // listening (auto-restarts between pauses count as live)
  | "paused" // the teacher paused
  | "finished" // the demo lesson script ended by itself
  | "error"; // fatal error (permission denied, too many failures, unsupported)

export interface ControlInput {
  status: SttStatus;
  error: SttError | null;
  source: Source | null;
  starting: boolean;
  pausedByUser: boolean;
}

export function controlPhase({ status, error, source, starting, pausedByUser }: ControlInput): ControlPhase {
  if (error) return "error";
  if (status === "listening" || status === "restarting") return "live";
  if (starting) return "starting";
  if (!source) return "idle";
  if (source === "demo" && !pausedByUser && status === "stopped") return "finished";
  return "paused";
}
