import { createFirebaseBackend } from "./firebaseBackend";
import { createLocalBackend } from "./localBackend";

export function createBackend() {
  if (import.meta.env.VITE_BACKEND === "firebase") {
    return createFirebaseBackend();
  }
  return createLocalBackend();
}
