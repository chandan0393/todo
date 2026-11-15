import { useEffect } from "react";
import { Download, X } from "lucide-react";

export default function ImageLightbox({ src, name, onClose }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex w-full max-w-4xl items-center justify-between text-white" onClick={(e) => e.stopPropagation()}>
        <span className="truncate text-sm font-medium opacity-90">{name || "Photo preview"}</span>
        <div className="flex items-center gap-3">
          <a
            href={src}
            download={name || "image.png"}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 transition-colors"
            title="Download full image"
          >
            <Download className="h-4 w-4" />
            <span>Download</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 transition-colors"
            aria-label="Close image viewer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden py-4">
        <img
          src={src}
          alt={name || "Full view"}
          className="max-h-[85vh] max-w-[92vw] select-none rounded-lg object-contain shadow-2xl transition-transform"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="text-center text-xs text-white/60">
        Press ESC or click outside to close
      </div>
    </div>
  );
}

