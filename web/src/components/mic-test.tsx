"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/pt-BR";

const DURATION_MS = 10_000;
const BLUETOOTH_RE = /bluetooth|airpods|buds|hands-?free/i;

type Phase = "idle" | "testing" | "done" | "error";

/**
 * 10 s mic check with getUserMedia + AnalyserNode. The stream is always closed
 * when the test ends, so it never competes with speech recognition.
 */
export function MicTest({
  disabled,
  onTestingChange,
}: {
  disabled?: boolean;
  /** Lets the console block speech recognition while the mic is held by the test. */
  onTestingChange?: (testing: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    onTestingChange?.(phase === "testing");
  }, [phase, onTestingChange]);
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [label, setLabel] = useState<string | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  async function run() {
    cleanup.current?.();
    setPeak(0);
    setLevel(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0];
      setLabel(track?.label || null);
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      let raf = 0;
      let maxSeen = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        const rms = Math.min(1, Math.sqrt(sum / buf.length) * 4);
        maxSeen = Math.max(maxSeen, rms);
        setLevel(rms);
        setPeak(maxSeen);
        raf = requestAnimationFrame(tick);
      };
      tick();
      const stop = () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
        stream.getTracks().forEach((tr) => tr.stop());
        void ctx.close();
        cleanup.current = null;
      };
      const timer = setTimeout(() => {
        stop();
        setLevel(0);
        setPhase("done");
      }, DURATION_MS);
      cleanup.current = stop;
      setPhase("testing");
    } catch {
      setPhase("error");
    }
  }

  return (
    <section className="space-y-3 rounded-xl border p-4" aria-labelledby="mic-test-title">
      <h2 id="mic-test-title" className="font-semibold">
        {t.micTest.title}
      </h2>
      <Button variant="outline" onClick={run} disabled={disabled || phase === "testing"}>
        {t.micTest.start}
      </Button>
      <div
        role="meter"
        aria-label={t.micTest.level}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level * 100)}
        className="h-3 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full bg-primary" style={{ width: `${Math.round(level * 100)}%` }} />
      </div>
      {phase === "testing" && <p className="text-sm">{t.micTest.testing}</p>}
      {phase === "done" && (
        <p className="text-sm">{peak < 0.05 ? t.micTest.silent : t.micTest.done}</p>
      )}
      {phase === "error" && <p className="text-sm text-destructive">{t.micTest.error}</p>}
      {label && <p className="text-sm text-muted-foreground">{t.micTest.device(label)}</p>}
      {label && BLUETOOTH_RE.test(label) && (
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{t.micTest.bluetoothWarning}</p>
      )}
      <p className="text-sm text-muted-foreground">{t.micTest.defaultNote}</p>
    </section>
  );
}
