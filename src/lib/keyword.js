const KEY = "dayline.secretKeyword";

export function defaultKeyword() {
  return (import.meta.env.VITE_SECRET_KEYWORD || "message").trim().toLowerCase();
}

export function getKeyword() {
  return (localStorage.getItem(KEY) || defaultKeyword()).trim().toLowerCase();
}

export function setKeyword(value) {
  const next = String(value || "").trim().toLowerCase();
  if (!next) return;
  localStorage.setItem(KEY, next);
}

export function matchesKeyword(input) {
  return String(input || "").trim().toLowerCase() === getKeyword();
}
