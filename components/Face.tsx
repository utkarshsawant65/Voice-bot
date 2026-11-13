"use client";

import { useEffect, useRef } from "react";

export type FaceState = "idle" | "listening" | "thinking" | "speaking" | "error";

const FADE_MS = 700;

const TAG: Record<FaceState, { text: string; dot: string }> = {
  idle: { text: "Ready", dot: "bg-emerald-400" },
  listening: { text: "Listening", dot: "bg-red-400 motion-safe:animate-pulse" },
  thinking: { text: "Thinking", dot: "bg-amber-300 motion-safe:animate-pulse" },
  speaking: { text: "On air", dot: "bg-red-500 motion-safe:animate-pulse" },
  error: { text: "Try again", dot: "bg-orange-400" },
};

// A still copy of the video sits underneath; the talking copy fades in and out on top of it
export default function Face({ state, level }: { state: FaceState; level: number }) {
  const talking = useRef<HTMLVideoElement>(null);
  const speaking = state === "speaking";

  useEffect(() => {
    const v = talking.current;
    if (!v) return;
    if (speaking) {
      v.playbackRate = 1;
      v.play().catch(() => {});
      return;
    }
    // Slow down while fading out, then rewind once it's invisible
    v.playbackRate = 0.5;
    const timer = setTimeout(() => {
      v.pause();
      v.currentTime = 0;
    }, FADE_MS);
    return () => clearTimeout(timer);
  }, [speaking]);

  const videoClass = "absolute inset-0 h-full w-full object-cover";

  return (
    <div
      className="portrait relative aspect-square max-w-full shrink-0 overflow-hidden rounded-[2rem] border border-line bg-black transition-shadow duration-100"
      style={{ boxShadow: speaking ? `0 0 ${12 + level * 48}px rgb(165 180 252 / 0.45)` : "0 20px 50px rgb(0 0 0 / 0.35)" }}
    >
      <video src="/avatar.mp4" muted playsInline preload="auto" aria-hidden="true" className={videoClass} />
      <video
        ref={talking}
        src="/avatar.mp4"
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        className={`${videoClass} transition-opacity ease-in-out`}
        style={{ opacity: speaking ? 1 : 0, transitionDuration: `${speaking ? 300 : FADE_MS}ms` }}
      />
      <span className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white backdrop-blur">
        <span className={`h-2 w-2 rounded-full ${TAG[state].dot}`} />
        {TAG[state].text}
      </span>
    </div>
  );
}
