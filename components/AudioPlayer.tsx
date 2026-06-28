"use client";

import { useEffect, useRef, useState } from "react";

type Props = { src: string; duration: number; ended: boolean; playLabel?: string; startAt?: number };

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-9 w-9">
      <path d="M9 6.5v11l8.5-5.5L9 6.5Z" fill="currentColor" />
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

export default function AudioPlayer({ src, duration, ended, playLabel = "Play audio", startAt = 0 }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const limitRef = useRef(duration);
  const startAtRef = useRef(startAt);
  const completedRef = useRef(false);
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
    completedRef.current = completed;
    if (completed) setProgress(1);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    completedRef.current = false;
    setProgress(0);
    audio.load();
    return () => stopPlayback();
    // The player remounts when the attempt changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, startAt]);

  function monitorPlayback() {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    const playbackTime = Math.max(0, audio.currentTime - startAtRef.current);
    const nextProgress = Math.min(1, playbackTime / limitRef.current);
    setProgress(nextProgress);
    if (playbackTime >= limitRef.current) {
      audio.currentTime = Math.min(audio.currentTime, startAtRef.current + limitRef.current);
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
    const mediaDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 30;
    startAtRef.current = Math.max(0, Math.min(startAt, Math.max(0, mediaDuration - 0.1)));
    limitRef.current = ended ? Math.max(0.1, mediaDuration - startAtRef.current) : Math.min(duration, Math.max(0.1, mediaDuration - startAtRef.current));
    try {
      audio.pause();
      audio.currentTime = startAtRef.current;
      completedRef.current = false;
      setProgress(0);
      await audio.play();
      setPlaying(true);
      setProgress(Math.min(1, Math.max(0, audio.currentTime - startAtRef.current) / limitRef.current));
      frameRef.current = requestAnimationFrame(monitorPlayback);
    } catch {
      setPlaying(false);
      setPlaybackError(true);
    }
  }

  return (
    <div className="flex flex-col items-center py-2 sm:py-3">
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        playsInline
        onCanPlay={() => setReady(true)}
        onLoadedMetadata={() => {
          const audio = audioRef.current;
          if (!audio) return;
          const mediaDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 30;
          startAtRef.current = Math.max(0, Math.min(startAt, Math.max(0, mediaDuration - 0.1)));
          limitRef.current = ended ? Math.max(0.1, mediaDuration - startAtRef.current) : Math.min(duration, Math.max(0.1, mediaDuration - startAtRef.current));
        }}
        onPlaying={() => setReady(true)}
        onTimeUpdate={() => {
          const audio = audioRef.current;
          if (audio && !audio.paused && audio.currentTime - startAtRef.current >= limitRef.current) {
            audio.currentTime = startAtRef.current + limitRef.current;
            stopPlayback(true);
          }
        }}
        onEnded={() => stopPlayback(true)}
        onError={() => setPlaybackError(true)}
      />

      <button
        type="button"
        onClick={togglePlayback}
        aria-label={playing ? `Pause ${playLabel.replace(/^Play\s+/i, "")}` : playLabel}
        aria-pressed={playing}
        className="group relative grid h-24 w-24 place-items-center rounded-full outline-none transition duration-200 ease-out hover:scale-[1.025] focus-visible:ring-4 focus-visible:ring-violet/35 active:scale-[.94]"
      >
        <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 h-full w-full -rotate-90 overflow-visible">
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6"
            className="text-slate-200 dark:text-[#353b48]" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="6"
            strokeLinecap="round" pathLength="1" strokeDasharray="1"
            strokeDashoffset={1 - progress}
            className="text-coral dark:text-[#ff765c]" />
        </svg>
        <span className="absolute inset-[9px] rounded-full bg-white shadow-[0_16px_40px_rgba(23,23,28,.18)] dark:bg-[#242832] dark:shadow-[0_18px_44px_rgba(0,0,0,.45)]" />
        <span className="relative grid h-[68px] w-[68px] place-items-center rounded-full bg-[#202128] text-white shadow-inner group-hover:bg-[#30323a] dark:bg-violet dark:text-white dark:shadow-[0_0_24px_rgba(101,88,211,.28)] dark:group-hover:bg-[#7569e5]">
          {playing ? <PauseIcon /> : <PlayIcon />}
        </span>
      </button>

      <div className="mt-3 flex h-6 items-center gap-[5px]" aria-hidden="true">
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

      <p className="mt-1 min-h-4 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-300">
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
