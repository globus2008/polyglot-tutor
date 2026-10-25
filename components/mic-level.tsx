"use client";

import { useEffect, useRef } from "react";

/** Live input level of a microphone stream, so users can see the app actually hears them. */
export function MicLevel({ stream, className = "" }: { stream: MediaStream | null; className?: string }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!stream || !stream.getAudioTracks().length || !bar) return;
    const context = new AudioContext();
    // created outside the click handler, so Chrome starts it suspended (silent analyser)
    if (context.state === "suspended") void context.resume();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    let frame = 0;

    const tick = () => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += s * s;
      const rms = Math.sqrt(sum / samples.length);
      // speech is roughly 0.02–0.3 RMS; stretch it so normal talking fills most of the bar
      const level = Math.min(1, Math.sqrt(rms) * 1.8);
      bar.style.width = `${Math.round(level * 100)}%`;
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      void context.close();
      bar.style.width = "0%";
    };
  }, [stream]);

  return (
    <div aria-hidden className={`h-2 overflow-hidden rounded-full bg-muted ${className}`}>
      <div ref={barRef} className="h-full w-0 rounded-full bg-success" />
    </div>
  );
}
