import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, MessageSquare, Volume2, VolumeX, X } from "lucide-react";
import { getKeyword, setKeyword } from "../../lib/keyword";
import {
  isDesktopNotificationEnabled,
  isSoundEnabled,
  notifyDesktop,
  playNotificationSound,
  requestDesktopNotificationPermission,
  setDesktopNotificationEnabled,
  setSoundEnabled,
} from "../../lib/notifications";
import AuthScreen from "./AuthScreen";
import ImageLightbox from "./ImageLightbox";
import Sidebar from "./Sidebar";
import Thread from "./Thread";

export default function ChatApp({ api, dark, setDark }) {
  const [user, setUser] = useState(undefined);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingMap, setTypingMap] = useState({});
  const [settings, setSettings] = useState(false);
  const [keyword, setKeywordState] = useState(getKeyword());
  const [name, setName] = useState("");
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const [desktopNotifOn, setDesktopNotifOn] = useState(isDesktopNotificationEnabled);
  const [incomingToast, setIncomingToast] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [replyTo, setReplyTo] = useState(null);

  const realtime = useRef(null);
  const typingTimer = useRef(null);
  const activeId = useRef(null);
  const convsRef = useRef([]);

  useEffect(() => {
    convsRef.current = conversations;
    const totalUnread = conversations.reduce((sum, c) => sum + (c.unread || 0), 0);
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) Dayline`;
    } else {
      document.title = "Dayline";
    }
  }, [conversations]);

  useEffect(() => {
    return api.subscribeAuth((next) => {
      setUser(next);
      if (next) setName(next.displayName || "");
    });
  }, [api]);

  const refreshLists = useCallback(async () => {
    if (!user) return;
    const [c, conv] = await Promise.all([api.listContacts(), api.listConversations()]);
    setContacts(c);
    setConversations(conv);
  }, [api, user]);

  useEffect(() => {
    if (!user) return;
    refreshLists();
    realtime.current?.close();
    realtime.current = api.connectRealtime({
      onEvent(ev) {
        if (ev.type === "message") {
          const isFromSelf = ev.self || ev.message.senderId === user.id;

          // Sound cues
          if (isFromSelf) {
            playNotificationSound("sent");
          } else {
            playNotificationSound("received");
          }

          // Desktop & In-app notifications if from other person and outside active chat
          if (!isFromSelf && ev.message.conversationId !== activeId.current) {
            const senderConv = convsRef.current.find((c) => c.id === ev.message.conversationId);
            const senderName = senderConv?.other?.displayName || "New message";
            const preview =
              ev.message.type === "text"
                ? ev.message.text
                : ev.message.type === "audio"
                ? "🎤 Voice message"
                : ev.message.type === "image"
                ? "📷 Photo"
                : ev.message.type === "video"
                ? "🎥 Video"
                : `📄 ${ev.message.fileName || "Attachment"}`;

            notifyDesktop(`Dayline: ${senderName}`, preview);

            setIncomingToast({
              id: Date.now(),
              conversationId: ev.message.conversationId,
              senderName,
              preview,
            });
            setTimeout(() => setIncomingToast(null), 5000);
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === ev.message.id)) {
              return prev.map((m) => (m.id === ev.message.id ? ev.message : m));
            }
            if (activeId.current && ev.message.conversationId === activeId.current) {
              return [...prev, ev.message];
            }
            return prev;
          });
        }

        if (ev.type === "reaction") {
          setMessages((prev) =>
            prev.map((m) => (m.id === ev.messageId ? { ...m, reactions: ev.reactions } : m))
          );
        }

        if (ev.type === "edit") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === ev.messageId
                ? { ...m, text: ev.text, edited: true, editedAt: ev.editedAt }
                : m
            )
          );
        }

        if (ev.type === "conversation") {
          setConversations((prev) => {
            const rest = prev.filter((c) => c.id !== ev.conversation.id);
            return [ev.conversation, ...rest];
          });
        }

        if (ev.type === "typing") {
          setTypingMap((prev) => ({
            ...prev,
            [ev.conversationId]: ev.value,
          }));
        }

        if (ev.type === "presence") {
          setConversations((prev) =>
            prev.map((c) =>
              c.other?.id === ev.userId
                ? { ...c, other: { ...c.other, online: ev.online, lastSeen: ev.lastSeen } }
                : c
            )
          );
          setActive((cur) =>
            cur?.other?.id === ev.userId
              ? { ...cur, other: { ...cur.other, online: ev.online, lastSeen: ev.lastSeen } }
              : cur
          );
        }

        if (ev.type === "read") {
          setMessages((prev) =>
            prev.map((m) =>
              m.conversationId === ev.conversationId && m.senderId !== ev.readerId
                ? { ...m, status: "read" }
                : m
            )
          );
        }
      },
    });
    return () => realtime.current?.close();
  }, [api, user, refreshLists]);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setResults(await api.searchUsers(search.trim()));
      } catch (err) {
        setError(err.message);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search, api]);

  async function openConv(conv) {
    activeId.current = conv.id;
    setActive(conv);
    const rows = await api.listMessages(conv.id);
    setMessages(rows);
    await api.markRead(conv.id);
    realtime.current?.send({ type: "watch", conversationId: conv.id });
    setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, unread: 0 } : c)));
  }

  async function openConvById(conversationId) {
    let conv = conversations.find((c) => c.id === conversationId);
    if (!conv) {
      await refreshLists();
      conv = conversations.find((c) => c.id === conversationId);
    }
    if (conv) {
      await openConv(conv);
      setIncomingToast(null);
    }
  }

  async function addPerson(person) {
    await api.addContact(person.id);
    const conv = await api.openConversation(person.id);
    await refreshLists();
    setSearch("");
    setResults([]);
    await openConv(conv);
  }

  function send(payload) {
    if (!active) return;
    realtime.current?.send({
      type: "message",
      conversationId: active.id,
      ...payload,
    });
  }

  function onTyping(value) {
    if (!active) return;
    realtime.current?.send({ type: "typing", conversationId: active.id, value });
    clearTimeout(typingTimer.current);
    if (value) {
      typingTimer.current = setTimeout(() => {
        realtime.current?.send({ type: "typing", conversationId: active.id, value: false });
      }, 1500);
    }
  }

  function sendWithReply(payload) {
    send({
      ...payload,
      replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, type: replyTo.type, fileName: replyTo.fileName } : null,
    });
    setReplyTo(null);
  }

  async function removeMessage(message) {
    await api.deleteMessage(message.id, message.conversationId);
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, deleted: true, text: "", mediaUrl: "", reactions: {} } : m))
    );
  }

  async function handleReact(messageId, emoji) {
    if (!active || !user) return;
    const uid = user.id;

    // Optimistic UI update
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const rx = { ...(m.reactions || {}) };
        const list = Array.isArray(rx[emoji]) ? rx[emoji] : [];
        if (list.includes(uid)) {
          rx[emoji] = list.filter((id) => id !== uid);
          if (rx[emoji].length === 0) delete rx[emoji];
        } else {
          rx[emoji] = [...list, uid];
        }
        return { ...m, reactions: rx };
      })
    );

    try {
      await api.toggleReaction(active.id, messageId, emoji);
    } catch (err) {
      console.error("Failed to react:", err);
    }
  }

  async function handleEdit(messageId, text) {
    if (!active) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, text, edited: true, editedAt: Date.now() } : m
      )
    );
    try {
      await api.editMessage(active.id, messageId, text);
    } catch (err) {
      console.error("Failed to edit message:", err);
    }
  }

  async function handleToggleDesktopNotifications() {
    if (!desktopNotifOn) {
      const granted = await requestDesktopNotificationPermission();
      setDesktopNotifOn(granted);
    } else {
      setDesktopNotificationEnabled(false);
      setDesktopNotifOn(false);
    }
  }

  const mobileThread = Boolean(active);
  const themeClass = dark ? "dark" : "";

  const settingsPanel = settings && (
    <div className="absolute inset-0 z-30 flex flex-col bg-white p-6 shadow-2xl dark:bg-wa-darkPanel">
      <div className="flex items-center justify-between border-b border-black/10 pb-4 dark:border-white/10">
        <h3 className="text-xl font-semibold">Settings</h3>
        <button
          type="button"
          onClick={() => setSettings(false)}
          className="rounded-full p-1.5 text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
        <label className="block text-sm font-medium">
          Display name
          <input
            className="mt-1.5 w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-wa-green dark:border-white/10 dark:bg-[#111b21]"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="block text-sm font-medium">
          Access phrase
          <p className="mt-0.5 text-xs font-normal text-[#667781] dark:text-[#8696a0]">
            Word typed in the To-Do list to reveal this chat.
          </p>
          <input
            className="mt-1.5 w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-wa-green dark:border-white/10 dark:bg-[#111b21]"
            value={keyword}
            onChange={(e) => setKeywordState(e.target.value)}
          />
        </label>

        <div className="rounded-2xl border border-black/10 p-4 space-y-3 dark:border-white/10 dark:bg-black/20">
          <p className="text-xs uppercase font-bold tracking-wider text-[#667781] dark:text-[#8696a0]">
            Preferences
          </p>

          <label className="flex items-center justify-between text-sm cursor-pointer">
            <span className="font-medium">Dark theme</span>
            <input
              type="checkbox"
              checked={dark}
              onChange={(e) => setDark(e.target.checked)}
              className="h-4 w-4 rounded accent-wa-green"
            />
          </label>

          <label className="flex items-center justify-between text-sm cursor-pointer">
            <span className="flex items-center gap-2 font-medium">
              {soundOn ? <Volume2 className="h-4 w-4 text-wa-green" /> : <VolumeX className="h-4 w-4" />}
              Sound effects
            </span>
            <input
              type="checkbox"
              checked={soundOn}
              onChange={(e) => {
                const next = e.target.checked;
                setSoundOn(next);
                setSoundEnabled(next);
              }}
              className="h-4 w-4 rounded accent-wa-green"
            />
          </label>

          <label className="flex items-center justify-between text-sm cursor-pointer">
            <span className="flex items-center gap-2 font-medium">
              {desktopNotifOn ? <Bell className="h-4 w-4 text-wa-green" /> : <BellOff className="h-4 w-4" />}
              Desktop notifications
            </span>
            <input
              type="checkbox"
              checked={desktopNotifOn}
              onChange={handleToggleDesktopNotifications}
              className="h-4 w-4 rounded accent-wa-green"
            />
          </label>
        </div>

        <label className="block text-sm font-medium">
          Profile photo
          <input
            type="file"
            accept="image/*"
            className="mt-2 block w-full text-xs text-[#54656f] file:mr-3 file:rounded-xl file:border-0 file:bg-wa-green file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[#008f6f]"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const uploaded = await api.upload(file);
                await api.updateProfile({ photoURL: uploaded.url });
              } catch (err) {
                setError("Failed to upload photo: " + err.message);
              }
            }}
          />
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-3 border-t border-black/10 pt-4 dark:border-white/10">
        <button
          type="button"
          className="rounded-xl px-4 py-2.5 text-sm font-medium text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10"
          onClick={() => setSettings(false)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="rounded-xl bg-wa-green px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#008f6f]"
          onClick={async () => {
            setKeyword(keyword);
            await api.updateProfile({ displayName: name });
            setSettings(false);
          }}
        >
          Save Changes
        </button>
      </div>
    </div>
  );

  if (user === undefined) {
    return <div className="grid h-full place-items-center text-sm text-[#667781]">Loading…</div>;
  }

  if (!user) {
    return <AuthScreen api={api} onError={setError} />;
  }

  return (
    <div className={`${themeClass} h-[100dvh] overflow-hidden bg-[#d1d7db] text-[#111b21] dark:bg-black dark:text-[#e9edef]`}>
      {/* Lightbox for full image viewing */}
      {lightbox && (
        <ImageLightbox
          src={lightbox.url}
          name={lightbox.name}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* In-app Toast Banner for background messages */}
      {incomingToast && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 transform transition-all duration-300">
          <div
            onClick={() => openConvById(incomingToast.conversationId)}
            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-black/10 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-[#202c33]/95"
          >
            <div className="grid h-9 w-9 place-items-center rounded-full bg-wa-green text-white">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div className="max-w-xs pr-2">
              <p className="truncate text-xs font-bold text-wa-green">{incomingToast.senderName}</p>
              <p className="truncate text-xs opacity-90">{incomingToast.preview}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIncomingToast(null);
              }}
              className="rounded-full p-1 text-[#667781] hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-600 px-3 py-2 text-sm text-white">
          {error}
          <button className="ml-3 underline" onClick={() => setError("")}>
            dismiss
          </button>
        </div>
      )}

      <div className="relative mx-auto flex h-full max-w-6xl overflow-hidden bg-white shadow-xl dark:bg-wa-dark">
        {settingsPanel}

        <div className={`h-full w-full md:w-[38%] md:min-w-[320px] ${mobileThread ? "hidden md:block" : "block"}`}>
          <Sidebar
            me={user}
            conversations={conversations}
            contacts={contacts}
            search={search}
            onSearch={setSearch}
            results={results}
            onOpen={openConv}
            onAdd={addPerson}
            onLogout={() => api.logout()}
            onSettings={() => setSettings(true)}
            activeId={active?.id}
          />
        </div>

        <div className={`h-full flex-1 ${mobileThread ? "block" : "hidden md:block"}`}>
          {active ? (
            <Thread
              me={user}
              conversation={active}
              messages={messages}
              typing={Boolean(typingMap[active.id])}
              onBack={() => {
                activeId.current = null;
                setActive(null);
              }}
              onSend={sendWithReply}
              onTyping={onTyping}
              onReply={setReplyTo}
              onDelete={removeMessage}
              onUpload={(file) => api.upload(file)}
              onReact={handleReact}
              onOpenImage={(url, name) => setLightbox({ url, name })}
              onEdit={handleEdit}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-wa-chat p-6 text-center text-[#667781] dark:bg-wa-darkChat">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-wa-green/10 text-wa-green">
                <MessageSquare className="h-8 w-8" />
              </div>
              <div>
                <p className="font-serif text-2xl text-[#111b21] dark:text-[#e9edef]">Dayline Workspace</p>
                <p className="mt-1 text-sm">Select a contact or conversation to start secure messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {replyTo && (
        <div className="fixed bottom-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-black/10 bg-white/95 px-4 py-1.5 text-xs shadow-lg backdrop-blur dark:border-white/10 dark:bg-wa-darkPanel">
          <span className="font-semibold text-wa-green">Replying to</span>
          <span className="max-w-[200px] truncate text-[#667781] dark:text-[#aebac1]">
            {replyTo.text || replyTo.fileName || replyTo.type}
          </span>
          <button
            className="ml-1 rounded-full p-0.5 text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10"
            onClick={() => setReplyTo(null)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
