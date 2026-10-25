"use client";

import { useEffect, useRef } from "react";

/** Live input level of a microphone stream, so users can see the app actually hears them. */
export function MicLevel({ stream, className = "" }: { stream: MediaStream | null; className?: string }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stream || !stream.getAudioTracks().length) return;
    const context = new AudioContext();
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
      if (barRef.current) barRef.current.style.transform = `scaleX(${level})`;
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      void context.close();
    };
  }, [stream]);

  return (
    <div aria-hidden className={`h-2 overflow-hidden rounded-full bg-muted ${className}`}>
      <div ref={barRef} className="h-full origin-left scale-x-0 rounded-full bg-success transition-transform duration-75" />
    </div>
  );
}
