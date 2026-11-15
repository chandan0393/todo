import { useEffect } from "react";
import { Ban, Trash2, User, Users, X } from "lucide-react";

export default function DeleteModal({ isOpen, message, self, onClose, onConfirm }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !message) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-wa-darkPanel dark:text-[#e9edef]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-red-500/10 text-red-500">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Delete message?</h3>
            <p className="text-xs text-[#667781] dark:text-[#8696a0]">
              {self
                ? "Choose how you want to delete this message."
                : "This message will be removed from your device only."}
            </p>
          </div>
        </div>

        {/* Message preview snippet */}
        <div className="mt-4 rounded-xl border border-black/5 bg-[#f0f2f5] p-3 text-xs opacity-80 dark:border-white/5 dark:bg-[#111b21]">
          <p className="line-clamp-2 italic">
            "{message.text || message.fileName || (message.type === 'audio' ? '🎤 Voice note' : 'Photo/Media')}"
          </p>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex flex-col gap-2">
          {self && (
            <button
              type="button"
              onClick={() => onConfirm("everyone")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
            >
              <Users className="h-4 w-4" />
              <span>Delete for everyone</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onConfirm("me")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-black/5 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <User className="h-4 w-4" />
            <span>Delete for me</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="mt-1 w-full rounded-xl py-2 text-center text-xs font-medium text-[#667781] hover:text-[#111b21] dark:text-[#8696a0] dark:hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
