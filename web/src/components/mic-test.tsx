"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/page-header";
import { Notice } from "@/components/states";
import { t } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";

const DURATION_MS = 10_000;
const BLUETOOTH_RE = /bluetooth|airpods|buds|hands-?free/i;
const BARS = 24;

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
  onTestingChange?: (testing: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    onTestingChange?.(phase === "testing");
  }, [phase, onTestingChange]);
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [remaining, setRemaining] = useState(DURATION_MS / 1000);
  const [label, setLabel] = useState<string | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  async function run() {
    cleanup.current?.();
    setPeak(0);
    setLevel(0);
    setRemaining(DURATION_MS / 1000);
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
      const startedAt = performance.now();
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        const rms = Math.min(1, Math.sqrt(sum / buf.length) * 4);
        maxSeen = Math.max(maxSeen, rms);
        setLevel(rms);
        setPeak(maxSeen);
        setRemaining(Math.max(0, Math.ceil((DURATION_MS - (performance.now() - startedAt)) / 1000)));
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

  const lit = Math.round(level * BARS);

  return (
    <section className="surface space-y-4 p-5" aria-labelledby="mic-test-title">
      <SectionTitle
        icon={AudioLines}
        id="mic-test-title"
        action={
          phase === "testing" ? (
            <span className="font-mono text-sm text-muted-foreground tabular-nums">{t.micTest.remaining(remaining)}</span>
          ) : phase === "done" && peak >= 0.05 ? (
            <CheckCircle2 aria-hidden className="size-5 text-success" />
          ) : undefined
        }
      >
        {t.micTest.title}
      </SectionTitle>
      <div
        role="meter"
        aria-label={t.micTest.level}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level * 100)}
        className="flex h-8 items-end gap-[3px] rounded-xl bg-muted px-2 py-1.5"
      >
        {Array.from({ length: BARS }, (_, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 rounded-full transition-[height,background-color] duration-75",
              i < lit
                ? i > BARS * 0.8
                  ? "bg-destructive"
                  : i > BARS * 0.55
                    ? "bg-warning"
                    : "bg-success"
                : "bg-foreground/10",
            )}
            style={{ height: `${30 + ((i * 37) % 70)}%` }}
          />
        ))}
      </div>
      <Button variant="outline" className="w-full" onClick={run} disabled={disabled || phase === "testing"}>
        <AudioLines aria-hidden />
        {t.micTest.start}
      </Button>
      {phase === "testing" && <p className="text-sm font-medium">{t.micTest.testing}</p>}
      {phase === "done" &&
        (peak < 0.05 ? (
          <Notice tone="warning">{t.micTest.silent}</Notice>
        ) : (
          <p className="text-sm font-medium text-success">{t.micTest.done}</p>
        ))}
      {phase === "error" && <Notice tone="error">{t.micTest.error}</Notice>}
      {label && <p className="text-sm text-muted-foreground">{t.micTest.device(label)}</p>}
      {label && BLUETOOTH_RE.test(label) && <Notice tone="warning">{t.micTest.bluetoothWarning}</Notice>}
      <p className="text-xs text-muted-foreground">{t.micTest.defaultNote}</p>
    </section>
  );
}
