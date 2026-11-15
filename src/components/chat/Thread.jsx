import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CornerDownLeft, FileText, Mic, Paperclip, Pencil, Search, Send, Smile, Trash2, UploadCloud, X } from "lucide-react";
import { formatDuration, formatFileSize, formatLastSeen } from "../../lib/format";
import Avatar from "./Avatar";
import EmojiPicker from "./EmojiPicker";
import MessageBubble from "./MessageBubble";

export default function Thread({
  me,
  conversation,
  messages,
  typing,
  onBack,
  onSend,
  onTyping,
  onReply,
  onDelete,
  onUpload,
  onReact,
  onOpenImage,
  onEdit,
}) {
  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [micError, setMicError] = useState("");
  const [editingMessage, setEditingMessage] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const bottom = useRef(null);
  const recorder = useRef(null);
  const recordTimer = useRef(null);
  const streamRef = useRef(null);
  const chunks = useRef([]);
  const dragCounter = useRef(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // Clean up recording on unmount
  useEffect(() => {
    return () => {
      clearInterval(recordTimer.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (mediaPreview?.previewUrl) {
        URL.revokeObjectURL(mediaPreview.previewUrl);
      }
    };
  }, [mediaPreview]);

  function submit(e) {
    e?.preventDefault();
    const value = text.trim();
    if (!value) return;

    if (editingMessage) {
      onEdit?.(editingMessage.id, value);
      setEditingMessage(null);
      setText("");
      onTyping(false);
      return;
    }

    onSend({ kind: "text", text: value });
    setText("");
    onTyping(false);
  }

  function startEditing(msg) {
    setEditingMessage(msg);
    setText(msg.text || "");
  }

  function cancelEditing() {
    setEditingMessage(null);
    setText("");
  }

  function stageFile(file) {
    if (!file) return;
    let kind = "file";
    if (file.type.startsWith("image/")) kind = "image";
    else if (file.type.startsWith("video/")) kind = "video";
    else if (file.type.startsWith("audio/")) kind = "audio";

    const previewUrl = file.type.startsWith("image/") || file.type.startsWith("video/")
      ? URL.createObjectURL(file)
      : "";

    setMediaPreview({
      file,
      kind,
      previewUrl,
      caption: "",
    });
  }

  async function sendStagedMedia() {
    if (!mediaPreview) return;
    setUploadingMedia(true);
    try {
      const uploaded = await onUpload(mediaPreview.file);
      onSend({
        kind: mediaPreview.kind,
        text: mediaPreview.caption.trim(),
        mediaUrl: uploaded.url,
        fileName: uploaded.name || mediaPreview.file.name,
        fileSize: mediaPreview.file.size,
      });
      if (mediaPreview.previewUrl) URL.revokeObjectURL(mediaPreview.previewUrl);
      setMediaPreview(null);
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploadingMedia(false);
    }
  }

  function cancelStagedMedia() {
    if (mediaPreview?.previewUrl) URL.revokeObjectURL(mediaPreview.previewUrl);
    setMediaPreview(null);
  }

  function attach(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) stageFile(file);
  }

  // Clipboard paste support (e.g. pasting copied screenshots)
  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          stageFile(file);
          break;
        }
      }
    }
  }

  // Drag & drop handlers
  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      setIsDragging(false);
      dragCounter.current = 0;
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (file) stageFile(file);
  }

  // Voice recording
  async function startRecording() {
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const media = new MediaRecorder(stream);
      chunks.current = [];
      media.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.current.push(ev.data);
      };
      recorder.current = media;
      media.start(100);
      setRecording(true);
      setRecordSeconds(0);
      recordTimer.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.error("Mic access failed:", err);
      setMicError("Microphone access denied or unavailable.");
      setTimeout(() => setMicError(""), 4000);
    }
  }

  function cancelRecording() {
    clearInterval(recordTimer.current);
    if (recorder.current && recorder.current.state !== "inactive") {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    chunks.current = [];
    setRecording(false);
    setRecordSeconds(0);
  }

  async function stopAndSendRecording() {
    clearInterval(recordTimer.current);
    if (!recorder.current || recorder.current.state === "inactive") return;

    recorder.current.onstop = async () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const blob = new Blob(chunks.current, { type: "audio/webm" });
      if (blob.size < 500) {
        // Too short/empty
        setRecording(false);
        return;
      }
      const file = new File([blob], `Voice_${Date.now()}.webm`, { type: "audio/webm" });
      const uploaded = await onUpload(file);
      onSend({
        kind: "audio",
        text: "",
        mediaUrl: uploaded.url,
        fileName: file.name,
        fileSize: blob.size,
      });
      setRecording(false);
      setRecordSeconds(0);
    };

    recorder.current.stop();
  }

  const other = conversation.other;

  // Filter messages if search query is provided
  const visibleMessages = searchQuery.trim()
    ? messages.filter((m) => {
        const textMatch = m.text?.toLowerCase().includes(searchQuery.toLowerCase());
        const fileMatch = m.fileName?.toLowerCase().includes(searchQuery.toLowerCase());
        return textMatch || fileMatch;
      })
    : messages;

  return (
    <section
      className="relative flex h-full min-w-0 flex-1 flex-col bg-wa-chat font-chat dark:bg-wa-darkChat"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag & drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-wa-teal/80 p-6 text-white backdrop-blur-sm">
          <UploadCloud className="h-16 w-16 animate-bounce" />
          <p className="mt-3 text-lg font-medium">Drop file to share</p>
          <p className="text-xs opacity-80">Images, videos, voice notes, and documents</p>
        </div>
      )}

      {/* Media preview modal before sending */}
      {mediaPreview && (
        <div className="absolute inset-0 z-50 flex flex-col bg-wa-chat/95 backdrop-blur-sm p-4 dark:bg-wa-darkChat/95">
          <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
            <h4 className="text-sm font-semibold">Preview attachment</h4>
            <button
              type="button"
              onClick={cancelStagedMedia}
              className="rounded-full p-1 text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-hidden py-4">
            {mediaPreview.kind === "image" && (
              <img
                src={mediaPreview.previewUrl}
                alt="Preview"
                className="max-h-[60vh] max-w-full rounded-2xl object-contain shadow-lg"
              />
            )}
            {mediaPreview.kind === "video" && (
              <video
                controls
                src={mediaPreview.previewUrl}
                className="max-h-[60vh] max-w-full rounded-2xl shadow-lg bg-black"
              />
            )}
            {mediaPreview.kind === "file" && (
              <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-white shadow-md dark:bg-wa-darkPanel">
                <FileText className="h-16 w-16 text-wa-green mb-3" />
                <p className="font-semibold text-sm max-w-xs truncate">{mediaPreview.file.name}</p>
                <p className="text-xs text-[#667781] mt-1">{formatFileSize(mediaPreview.file.size)}</p>
              </div>
            )}
          </div>

          {/* Caption input & send */}
          <div className="flex items-center gap-2 bg-white rounded-2xl p-2 shadow-md dark:bg-wa-darkPanel">
            <input
              autoFocus
              value={mediaPreview.caption}
              onChange={(e) => setMediaPreview({ ...mediaPreview, caption: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendStagedMedia();
                }
              }}
              placeholder="Add a caption…"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none text-[#111b21] dark:text-[#e9edef]"
            />
            <button
              type="button"
              disabled={uploadingMedia}
              onClick={sendStagedMedia}
              className="grid h-10 w-10 place-items-center rounded-full bg-wa-green text-white shadow hover:bg-[#008f6f] disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="z-10 flex items-center gap-3 bg-wa-panel px-3 py-2.5 shadow-sm dark:bg-[#2a3942]">
        <button type="button" className="md:hidden" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-[#54656f] dark:text-[#aebac1]" />
        </button>
        <Avatar user={other} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{other?.displayName || other?.email || "Chat"}</p>
          <p className="truncate text-xs text-[#667781] dark:text-[#8696a0]">
            {typing ? (
              <span className="font-medium text-wa-green">typing…</span>
            ) : (
              formatLastSeen(other?.lastSeen, other?.online)
            )}
          </p>
        </div>

        {/* Thread actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setSearchQuery("");
            }}
            className="rounded-full p-2 text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10"
            title="Search in conversation"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* In-conversation search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-black/10 bg-white px-3 py-2 shadow-sm dark:border-white/10 dark:bg-wa-darkPanel">
          <Search className="h-4 w-4 text-[#54656f] dark:text-[#aebac1]" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none text-[#111b21] dark:text-[#e9edef]"
          />
          {searchQuery && (
            <span className="text-xs text-[#667781] dark:text-[#8696a0]">
              {visibleMessages.length} found
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSearchOpen(false);
            }}
            className="rounded-full p-1 text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Mic error notification */}
      {micError && (
        <div className="bg-red-500 px-3 py-1.5 text-center text-xs text-white">
          {micError}
        </div>
      )}

      {/* Messages area */}
      <div className="chat-bg flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {visibleMessages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            self={m.senderId === me.id}
            currentUserId={me.id}
            otherName={other?.displayName}
            onReply={onReply}
            onDelete={onDelete}
            onReact={onReact}
            onOpenImage={onOpenImage}
            onStartEdit={startEditing}
          />
        ))}

        {/* Animated typing indicator */}
        {typing && (
          <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-none bg-white px-4 py-2.5 shadow-sm dark:bg-[#202c33] w-fit">
            <span className="h-2 w-2 animate-bounce rounded-full bg-wa-green [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-wa-green [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-wa-green" />
          </div>
        )}

        <div ref={bottom} />
      </div>

      {/* Emoji picker drawer */}
      {emoji && (
        <div className="border-t border-black/10 bg-white px-3 py-2 shadow-inner dark:border-white/10 dark:bg-wa-darkPanel">
          <EmojiPicker
            onPick={(e) => {
              setText((t) => t + e);
            }}
          />
        </div>
      )}

      {/* Editing banner */}
      {editingMessage && (
        <div className="flex items-center justify-between border-t border-black/10 bg-emerald-50 px-4 py-2 text-xs text-wa-green dark:border-white/10 dark:bg-emerald-950/40">
          <div className="flex items-center gap-2">
            <Pencil className="h-3.5 w-3.5" />
            <span className="font-semibold">Editing message</span>
          </div>
          <button
            type="button"
            onClick={cancelEditing}
            className="rounded-full p-1 text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Input / Voice recording toolbar */}
      {recording ? (
        <div className="flex items-center gap-3 bg-wa-panel px-3 py-2.5 dark:bg-[#2a3942]">
          <button
            type="button"
            onClick={cancelRecording}
            className="grid h-10 w-10 place-items-center rounded-full text-red-500 hover:bg-red-500/10"
            title="Cancel recording"
          >
            <Trash2 className="h-5 w-5" />
          </button>

          <div className="flex flex-1 items-center gap-3 rounded-full bg-white px-4 py-2 dark:bg-[#111b21]">
            <span className="h-3 w-3 animate-ping rounded-full bg-red-500" />
            <span className="font-mono text-sm font-semibold text-red-500">
              {formatDuration(recordSeconds)}
            </span>
            <div className="flex flex-1 items-center gap-1">
              {[40, 70, 90, 60, 100, 50, 80, 45, 95, 65, 30].map((h, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-red-400 animate-pulse"
                  style={{
                    height: `${h * 0.2}px`,
                    animationDuration: `${0.4 + (i % 3) * 0.2}s`,
                  }}
                />
              ))}
            </div>
            <span className="text-xs text-[#667781]">Recording audio…</span>
          </div>

          <button
            type="button"
            onClick={stopAndSendRecording}
            className="grid h-10 w-10 place-items-center rounded-full bg-wa-green text-white shadow hover:bg-[#008f6f]"
            title="Send voice note"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="flex items-end gap-2 bg-wa-panel px-3 py-2.5 dark:bg-[#2a3942]"
        >
          <button
            type="button"
            onClick={() => setEmoji((v) => !v)}
            className="rounded-full p-1.5 text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10"
            aria-label="Emoji"
          >
            <Smile className="h-6 w-6" />
          </button>

          <label
            className="cursor-pointer rounded-full p-1.5 text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10"
            aria-label="Attach file or photo"
            title="Attach file, photo or video"
          >
            <Paperclip className="h-6 w-6" />
            <input
              type="file"
              className="hidden"
              onChange={attach}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar"
            />
          </label>

          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onTyping(Boolean(e.target.value));
            }}
            onPaste={handlePaste}
            placeholder={editingMessage ? "Edit message…" : "Type a message (or paste an image)…"}
            className="min-w-0 flex-1 rounded-xl bg-white px-3.5 py-2.5 text-sm outline-none text-[#111b21] placeholder:text-[#8696a0] dark:bg-[#202c33] dark:text-[#e9edef]"
          />

          {editingMessage ? (
            <button
              type="submit"
              className="grid h-10 w-10 place-items-center rounded-full bg-wa-green text-white shadow hover:bg-[#008f6f]"
              aria-label="Save edited message"
              title="Save edit"
            >
              <Check className="h-5 w-5" />
            </button>
          ) : text.trim() ? (
            <button
              type="submit"
              className="grid h-10 w-10 place-items-center rounded-full bg-wa-green text-white shadow hover:bg-[#008f6f]"
              aria-label="Send message"
            >
              <Send className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="grid h-10 w-10 place-items-center rounded-full text-[#54656f] hover:bg-black/5 hover:text-wa-green dark:text-[#aebac1] dark:hover:bg-white/10"
              aria-label="Record voice note"
              title="Record voice note"
            >
              <Mic className="h-6 w-6" />
            </button>
          )}
        </form>
      )}
    </section>
  );
}
