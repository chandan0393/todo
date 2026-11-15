import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { formatDuration } from "../../lib/format";

// Waveform bar heights pattern for visual aesthetic
const WAVE_BARS = [
  35, 60, 45, 80, 50, 90, 70, 40, 65, 85, 100, 75, 45, 85, 60, 95, 70, 50, 80, 60, 40, 75, 50, 30
];

const SPEEDS = [1, 1.5, 2];

export default function AudioPlayer({ src, self }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
    };
  }, []);

  function togglePlay(e) {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }

  function handleSeek(e) {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    audio.currentTime = pct * duration;
    setCurrentTime(audio.currentTime);
  }

  function cycleSpeed(e) {
    e.stopPropagation();
    const nextIdx = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(nextIdx);
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEEDS[nextIdx];
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex w-64 max-w-full items-center gap-2.5 py-1">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={togglePlay}
        className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-wa-green text-white shadow-sm transition-transform active:scale-95 hover:bg-[#008f6f]"
        aria-label={playing ? "Pause voice message" : "Play voice message"}
      >
        {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
      </button>

      <div className="flex flex-1 flex-col justify-center">
        {/* Interactive waveform seek bar */}
        <div
          className="relative flex h-7 cursor-pointer items-center gap-0.5"
          onClick={handleSeek}
          title="Click to seek"
        >
          {WAVE_BARS.map((height, i) => {
            const barPct = (i / WAVE_BARS.length) * 100;
            const isPlayed = barPct <= progress;
            return (
              <div
                key={i}
                className="flex-1 rounded-full transition-colors"
                style={{
                  height: `${height}%`,
                  backgroundColor: isPlayed
                    ? "#00a884"
                    : self
                    ? "rgba(0, 0, 0, 0.2)"
                    : "rgba(0, 0, 0, 0.2)",
                }}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] font-medium opacity-70">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(duration || 0)}</span>
        </div>
      </div>

      {/* Playback speed toggle (1x / 1.5x / 2x) */}
      <button
        type="button"
        onClick={cycleSpeed}
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
          speedIdx > 0
            ? "bg-wa-green text-white"
            : "bg-black/10 text-[#54656f] hover:bg-black/15 dark:bg-white/10 dark:text-[#aebac1]"
        }`}
        title="Cycle playback speed"
      >
        {SPEEDS[speedIdx]}x
      </button>
    </div>
  );
}
