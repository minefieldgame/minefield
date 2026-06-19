"use client";

import { useEffect, useRef, useState } from "react";

type Props = { src: string; duration: number; ended: boolean; playLabel?: string };

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-10 w-10 translate-x-[2px]">
      <path d="M8.25 5.3v13.4c0 .92 1.02 1.48 1.8.98l10.08-6.7a1.16 1.16 0 0 0 0-1.96L10.05 4.32c-.78-.5-1.8.06-1.8.98Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-9 w-9">
      <rect x="6.5" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
      <rect x="13.5" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export default function AudioPlayer({ src, duration, ended, playLabel = "Play audio" }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const limitRef = useRef(duration);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);

  function stopPlayback(completed = false) {
    const audio = audioRef.current;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    audio?.pause();
    setPlaying(false);
    if (completed) setProgress(1);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    return () => stopPlayback();
    // The player remounts when the attempt changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  function monitorPlayback() {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    const elapsed = Math.max(0, audio.currentTime - startTimeRef.current);
    const nextProgress = Math.min(1, elapsed / limitRef.current);
    setProgress(nextProgress);
    if (elapsed >= limitRef.current) {
      stopPlayback(true);
      return;
    }
    frameRef.current = requestAnimationFrame(monitorPlayback);
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      stopPlayback();
      return;
    }

    setPlaybackError(false);
    setProgress(0);
    limitRef.current = ended ? 30 : duration;
    try {
      audio.currentTime = 0;
      await audio.play();
      // Start timing only once the browser has actually begun advancing audio.
      startTimeRef.current = audio.currentTime;
      setPlaying(true);
      frameRef.current = requestAnimationFrame(monitorPlayback);
    } catch {
      setPlaying(false);
      setPlaybackError(true);
    }
  }

  return (
    <div className="flex flex-col items-center py-5 sm:py-6">
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        playsInline
        onCanPlay={() => setReady(true)}
        onPlaying={() => setReady(true)}
        onEnded={() => stopPlayback(true)}
        onError={() => setPlaybackError(true)}
      />

      <button
        type="button"
        onClick={togglePlayback}
        aria-label={playing ? `Pause ${playLabel.replace(/^Play\s+/i, "")}` : playLabel}
        aria-pressed={playing}
        className="group relative grid h-28 w-28 place-items-center rounded-full outline-none transition duration-200 ease-out hover:scale-[1.025] focus-visible:ring-4 focus-visible:ring-violet/35 active:scale-[.94]"
      >
        <span className="absolute inset-0 rounded-full bg-slate-200 dark:bg-[#353b48]" />
        <span
          className="absolute inset-0 rounded-full transition-[background] duration-100"
          style={{
            background: `conic-gradient(#f06449 ${progress * 360}deg, transparent ${progress * 360}deg)`
          }}
        />
        <span className="absolute inset-[6px] rounded-full bg-white shadow-[0_16px_40px_rgba(23,23,28,.18)] dark:bg-[#242832] dark:shadow-[0_18px_44px_rgba(0,0,0,.45)]" />
        <span className="relative grid h-[82px] w-[82px] place-items-center rounded-full bg-[#202128] text-white shadow-inner group-hover:bg-[#30323a] dark:bg-violet dark:text-white dark:shadow-[0_0_24px_rgba(101,88,211,.28)] dark:group-hover:bg-[#7569e5]">
          {playing ? <PauseIcon /> : <PlayIcon />}
        </span>
      </button>

      <div className="mt-6 flex h-8 items-center gap-[5px]" aria-hidden="true">
        {Array.from({ length: 21 }, (_, index) => (
          <span
            key={index}
            className={`wave-bar w-[3px] rounded-full transition-colors ${
              playing ? "bg-coral dark:bg-[#ff765c]" : progress > 0 ? "bg-coral/60 dark:bg-[#ff765c]/65" : "bg-slate-300 dark:bg-slate-600"
            } ${playing ? "" : "[animation-play-state:paused]"}`}
            style={{
              height: `${7 + ((index * 11) % 21)}px`,
              animationDelay: `${(index % 6) * 65}ms`
            }}
          />
        ))}
      </div>

      <p className="mt-3 min-h-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-300">
        {playbackError
          ? "Preview could not play. Tap once more to retry."
          : playing
            ? "Playing clip…"
            : ended
              ? "Full preview unlocked"
              : ready
                ? `Ready · ${duration} ${duration === 1 ? "second" : "seconds"}`
                : "Preparing preview…"}
      </p>
    </div>
  );
}
