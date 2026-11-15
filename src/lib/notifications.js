const SOUND_KEY = "dayline.sound_enabled";
const DESKTOP_KEY = "dayline.desktop_notifications";

export function isSoundEnabled() {
  const val = localStorage.getItem(SOUND_KEY);
  return val === null ? true : val === "true";
}

export function setSoundEnabled(enabled) {
  localStorage.setItem(SOUND_KEY, String(enabled));
}

export function isDesktopNotificationEnabled() {
  return localStorage.getItem(DESKTOP_KEY) === "true";
}

export function setDesktopNotificationEnabled(enabled) {
  localStorage.setItem(DESKTOP_KEY, String(enabled));
}

export async function requestDesktopNotificationPermission() {
  if (!("Notification" in window)) return false;
  try {
    const res = await Notification.requestPermission();
    const granted = res === "granted";
    setDesktopNotificationEnabled(granted);
    return granted;
  } catch {
    return false;
  }
}

export function playNotificationSound(type = "received") {
  if (!isSoundEnabled()) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === "received") {
      // Pleasant two-tone chime
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.09); // A5
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.start(now);
      osc.stop(now + 0.38);
    } else if (type === "sent") {
      // Subtle swoosh/pop
      osc.type = "sine";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.05);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  } catch {
    /* ignore audio error */
  }
}

export function notifyDesktop(title, body) {
  if (!isDesktopNotificationEnabled()) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (!document.hidden) return; // Only notify if window is inactive/hidden

  try {
    new Notification(title || "Dayline", {
      body,
      silent: true, // We already handle in-app sound
    });
  } catch {
    /* ignore desktop notification error */
  }
}

