import { describe, expect, it } from "vitest";
import { controlPhase, type ControlInput } from "./control-phase";

const base: ControlInput = { status: "idle", error: null, source: null, starting: false, pausedByUser: false };

describe("controlPhase", () => {
  it("is idle before anything starts", () => {
    expect(controlPhase(base)).toBe("idle");
  });

  it("shows 'starting' (not 'resume') while the browser asks for the microphone", () => {
    expect(controlPhase({ ...base, source: "mic", starting: true })).toBe("starting");
  });

  it("treats automatic restarts between pauses as live", () => {
    expect(controlPhase({ ...base, source: "mic", status: "restarting" })).toBe("live");
    expect(controlPhase({ ...base, source: "mic", status: "listening", starting: true })).toBe("live");
  });

  it("separates a teacher pause from the demo script ending", () => {
    expect(controlPhase({ ...base, source: "demo", status: "stopped", pausedByUser: true })).toBe("paused");
    expect(controlPhase({ ...base, source: "demo", status: "stopped" })).toBe("finished");
    expect(controlPhase({ ...base, source: "mic", status: "stopped", pausedByUser: true })).toBe("paused");
  });

  it("errors win over everything", () => {
    const error = { kind: "permission", code: "not-allowed", fatal: true } as const;
    expect(controlPhase({ ...base, source: "mic", starting: true, error })).toBe("error");
  });
});
