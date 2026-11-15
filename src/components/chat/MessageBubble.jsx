import { useState } from "react";
import { Ban, Check, CheckCheck, Copy, CornerDownLeft, Download, FileText, Maximize2, Pencil, Smile, Trash2 } from "lucide-react";
import { formatFileSize, formatTime } from "../../lib/format";
import AudioPlayer from "./AudioPlayer";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export default function MessageBubble({
  message,
  self,
  currentUserId,
  otherName,
  onReply,
  onDelete,
  onReact,
  onOpenImage,
  onStartEdit,
}) {
  const [showReactBar, setShowReactBar] = useState(false);
  const [copied, setCopied] = useState(false);

  const ticks =
    message.status === "read" ? (
      <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
    ) : message.status === "delivered" ? (
      <CheckCheck className="h-3.5 w-3.5 opacity-70" />
    ) : (
      <Check className="h-3.5 w-3.5 opacity-70" />
    );

  function copyText() {
    if (!message.text) return;
    navigator.clipboard.writeText(message.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleReact(emoji) {
    onReact?.(message.id, emoji);
    setShowReactBar(false);
  }

  const reactions = message.reactions || {};
  const reactionEntries = Object.entries(reactions).filter(
    ([_, users]) => Array.isArray(users) && users.length > 0
  );

  return (
    <div className={`group relative flex flex-col ${self ? "items-end" : "items-start"}`}>
      {/* Quick reaction popover */}
      {showReactBar && (
        <div
          className={`absolute -top-9 z-20 flex items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-1 shadow-lg dark:border-white/10 dark:bg-wa-darkPanel ${
            self ? "right-2" : "left-2"
          }`}
          onMouseLeave={() => setShowReactBar(false)}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleReact(emoji)}
              className="rounded-full p-1 text-base transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Main message bubble container */}
      <div
        className={`relative max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm md:max-w-[72%] ${
          self
            ? "rounded-tr-none bg-wa-send text-[#111b21] dark:bg-wa-darkSend dark:text-[#e9edef]"
            : "rounded-tl-none bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]"
        }`}
        onDoubleClick={() => onReply(message)}
      >
        {/* Reply context quote */}
        {message.replyTo && (
          <div
            className={`mb-1.5 rounded-lg border-l-4 border-wa-green px-2.5 py-1 text-xs opacity-90 ${
              self ? "bg-black/5 dark:bg-black/20" : "bg-black/5 dark:bg-white/5"
            }`}
          >
            <p className="font-semibold text-wa-green">
              {message.replyTo.type === "image"
                ? "📷 Photo"
                : message.replyTo.type === "video"
                ? "🎥 Video"
                : message.replyTo.type === "audio"
                ? "🎤 Voice message"
                : message.replyTo.type === "file"
                ? "📄 Attachment"
                : "Message"}
            </p>
            <p className="truncate text-[11px] opacity-80">{message.replyTo.text || message.replyTo.fileName || ""}</p>
          </div>
        )}

        {/* Message contents */}
        {message.deleted ? (
          <div className="flex items-center gap-1.5 py-0.5 text-xs italic opacity-60">
            <Ban className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{self ? "You deleted this message" : "This message was deleted"}</span>
          </div>
        ) : (
          <>
            {/* Image attachment */}
            {message.type === "image" && message.mediaUrl && (
              <div
                className="group/img relative mb-1.5 cursor-pointer overflow-hidden rounded-xl bg-black/5"
                onClick={() => onOpenImage?.(message.mediaUrl, message.fileName)}
              >
                <img
                  src={message.mediaUrl}
                  alt={message.fileName || "Photo"}
                  className="max-h-72 w-full rounded-xl object-cover transition-transform duration-200 group-hover/img:scale-[1.02]"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover/img:opacity-100">
                  <div className="rounded-full bg-black/60 p-2 text-white shadow-md">
                    <Maximize2 className="h-4 w-4" />
                  </div>
                </div>
              </div>
            )}

            {/* Video attachment */}
            {message.type === "video" && message.mediaUrl && (
              <div className="mb-1.5 overflow-hidden rounded-xl bg-black">
                <video
                  controls
                  src={message.mediaUrl}
                  className="max-h-80 w-full rounded-xl object-contain"
                  preload="metadata"
                />
              </div>
            )}

            {/* Voice note / audio message */}
            {message.type === "audio" && message.mediaUrl && (
              <div className="mb-1">
                <AudioPlayer src={message.mediaUrl} self={self} />
              </div>
            )}

            {/* Generic document/file attachment */}
            {message.type === "file" && message.mediaUrl && (
              <div
                className={`mb-1.5 flex items-center gap-3 rounded-xl border p-2.5 transition-colors ${
                  self
                    ? "border-black/10 bg-black/5 dark:border-white/10 dark:bg-black/20"
                    : "border-black/10 bg-[#f0f2f5] dark:border-white/10 dark:bg-[#111b21]"
                }`}
              >
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg bg-wa-green/20 text-wa-green">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{message.fileName || "Document"}</p>
                  <p className="text-[10px] opacity-70">
                    {formatFileSize(message.fileSize) || "File attachment"}
                  </p>
                </div>
                <a
                  href={message.mediaUrl}
                  download={message.fileName || "download"}
                  className="rounded-full p-2 text-wa-green hover:bg-black/5 dark:hover:bg-white/10"
                  title="Download file"
                >
                  <Download className="h-4 w-4" />
                </a>
              </div>
            )}

            {/* Text message / caption */}
            {message.text && (
              <p className="whitespace-pre-wrap break-words leading-relaxed">{message.text}</p>
            )}
          </>
        )}

        {/* Footer timestamp, edited tag, and delivery status */}
        <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] opacity-70">
          {message.edited && <span className="italic text-[10px]">edited</span>}
          <span>{formatTime(message.createdAt)}</span>
          {self && !message.deleted && ticks}
        </div>

        {/* Hover action bar */}
        {!message.deleted && (
          <div
            className={`absolute -top-3.5 hidden items-center gap-0.5 rounded-full border border-black/10 bg-white px-1.5 py-0.5 shadow-md group-hover:flex dark:border-white/10 dark:bg-wa-darkPanel ${
              self ? "left-2" : "right-2"
            }`}
          >
            <button
              type="button"
              onClick={() => setShowReactBar((v) => !v)}
              className="rounded-full p-1 text-[#54656f] hover:bg-black/5 hover:text-wa-green dark:text-[#aebac1] dark:hover:bg-white/10"
              title="React"
            >
              <Smile className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onReply(message)}
              className="rounded-full p-1 text-[#54656f] hover:bg-black/5 hover:text-wa-green dark:text-[#aebac1] dark:hover:bg-white/10"
              title="Reply"
            >
              <CornerDownLeft className="h-3.5 w-3.5" />
            </button>
            {message.text && (
              <button
                type="button"
                onClick={copyText}
                className="rounded-full p-1 text-[#54656f] hover:bg-black/5 hover:text-wa-green dark:text-[#aebac1] dark:hover:bg-white/10"
                title={copied ? "Copied!" : "Copy text"}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-wa-green" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            )}
            {self && message.type === "text" && (
              <button
                type="button"
                onClick={() => onStartEdit?.(message)}
                className="rounded-full p-1 text-[#54656f] hover:bg-black/5 hover:text-wa-green dark:text-[#aebac1] dark:hover:bg-white/10"
                title="Edit message"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(message)}
              className="rounded-full p-1 text-[#54656f] hover:bg-black/5 hover:text-red-500 dark:text-[#aebac1] dark:hover:bg-white/10"
              title="Delete message"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Reaction badges below bubble with rich tooltip */}
      {reactionEntries.length > 0 && !message.deleted && (
        <div className={`-mt-2 z-10 flex flex-wrap gap-1 px-1 ${self ? "justify-end mr-2" : "justify-start ml-2"}`}>
          {reactionEntries.map(([emoji, users]) => {
            const hasReacted = currentUserId && users.includes(currentUserId);
            const userLabels = users.map((uId) => (uId === currentUserId ? "You" : otherName || "Friend"));
            const tooltipText = `${userLabels.join(", ")} reacted with ${emoji}`;

            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact?.(message.id, emoji)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs shadow-sm transition-transform active:scale-90 ${
                  hasReacted
                    ? "border-wa-green bg-emerald-50 text-wa-green dark:bg-emerald-950/40"
                    : "border-black/10 bg-white text-[#111b21] hover:bg-gray-50 dark:border-white/10 dark:bg-wa-darkPanel dark:text-[#e9edef] dark:hover:bg-white/5"
                }`}
                title={tooltipText}
              >
                <span>{emoji}</span>
                <span className="text-[11px] font-semibold">{users.length}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
