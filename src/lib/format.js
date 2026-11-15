export function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatLastSeen(ts, online) {
  if (online) return "online";
  if (!ts) return "offline";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "last seen just now";
  if (diff < 3_600_000) return `last seen ${Math.floor(diff / 60_000)} min ago`;
  const d = new Date(ts);
  const sameDay = new Date().toDateString() === d.toDateString();
  if (sameDay) return `last seen today at ${formatTime(ts)}`;
  return `last seen ${d.toLocaleDateString()}`;
}

export function initials(name) {
  return String(name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
