import { useState } from "react";
import { LogOut, MessageSquare, Search, Settings, UserPlus, Users } from "lucide-react";
import { formatTime } from "../../lib/format";
import Avatar from "./Avatar";

export default function Sidebar({
  me,
  conversations,
  contacts,
  search,
  onSearch,
  onOpen,
  onAdd,
  onLogout,
  onSettings,
  results,
  activeId,
}) {
  const [tab, setTab] = useState("chats"); // "chats" | "contacts"

  const filteredConversations = conversations.filter((c) => {
    const hay = `${c.other?.displayName || ""} ${c.other?.email || ""} ${c.lastMessage || ""}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  const filteredContacts = (contacts || []).filter((c) => {
    const hay = `${c.displayName || ""} ${c.email || ""}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <aside className="flex h-full flex-col border-r border-black/10 bg-white font-chat dark:border-white/10 dark:bg-wa-darkPanel">
      {/* Header bar */}
      <div className="flex items-center gap-3 bg-wa-panel px-3 py-2.5 dark:bg-[#2a3942]">
        <Avatar user={me} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-sm">{me.displayName}</p>
          <p className="truncate text-xs text-[#667781] dark:text-[#8696a0]">{me.email}</p>
        </div>
        <button
          type="button"
          onClick={onSettings}
          aria-label="Settings"
          className="rounded-full p-1.5 text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10"
        >
          <Settings className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Sign out"
          className="rounded-full p-1.5 text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      {/* Search bar */}
      <div className="px-3 py-2">
        <label className="flex items-center gap-2 rounded-xl bg-[#f0f2f5] px-3 py-2 dark:bg-[#111b21]">
          <Search className="h-4 w-4 text-[#54656f] dark:text-[#aebac1]" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search or start a chat…"
            className="w-full bg-transparent text-sm outline-none text-[#111b21] dark:text-[#e9edef] placeholder:text-[#8696a0]"
          />
        </label>
      </div>

      {/* Tabs: Chats / Contacts */}
      <div className="flex border-b border-black/5 px-3 dark:border-white/5">
        <button
          type="button"
          onClick={() => setTab("chats")}
          className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-xs font-semibold transition-colors ${
            tab === "chats"
              ? "border-wa-green text-wa-green"
              : "border-transparent text-[#667781] hover:text-[#111b21] dark:text-[#8696a0] dark:hover:text-[#e9edef]"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Chats ({conversations.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("contacts")}
          className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-xs font-semibold transition-colors ${
            tab === "contacts"
              ? "border-wa-green text-wa-green"
              : "border-transparent text-[#667781] hover:text-[#111b21] dark:text-[#8696a0] dark:hover:text-[#e9edef]"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Contacts ({contacts?.length || 0})</span>
        </button>
      </div>

      {/* Search results for adding new users */}
      {results?.length > 0 && (
        <div className="border-b border-black/10 bg-[#fbfbfb] px-2 py-2 dark:border-white/10 dark:bg-black/20">
          <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#667781] dark:text-[#8696a0]">
            People found
          </p>
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onAdd(u)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5"
            >
              <Avatar user={u} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{u.displayName}</p>
                <p className="truncate text-xs text-[#667781] dark:text-[#8696a0]">{u.email}</p>
              </div>
              <span className="flex items-center gap-1 rounded-lg bg-wa-green/10 px-2 py-1 text-xs font-medium text-wa-green dark:bg-wa-green/20">
                <UserPlus className="h-3.5 w-3.5" />
                <span>Chat</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* List content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "chats" && (
          <>
            {filteredConversations.map((conv) => {
              const isSelected = activeId === conv.id;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => onOpen(conv)}
                  className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors ${
                    isSelected
                      ? "bg-[#f0f2f5] dark:bg-white/10"
                      : "hover:bg-[#f5f6f6] dark:hover:bg-white/5"
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar user={conv.other} />
                    {conv.other?.online && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#25d366] ring-2 ring-white dark:ring-[#202c33]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium">{conv.other?.displayName || "Unknown"}</p>
                      <span className="text-[11px] text-[#667781] dark:text-[#8696a0]">
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-[#667781] dark:text-[#8696a0]">
                        {conv.lastMessage || "No messages yet"}
                      </p>
                      {conv.unread > 0 && (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#25d366] px-1 text-[11px] font-bold text-white">
                          {conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            {!filteredConversations.length && (
              <div className="px-6 py-10 text-center text-sm text-[#667781] dark:text-[#8696a0]">
                <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
                <p className="font-medium">No chats found</p>
                <p className="mt-1 text-xs">Search an email or name above to start a conversation.</p>
              </div>
            )}
          </>
        )}

        {tab === "contacts" && (
          <>
            {filteredContacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => onAdd(contact)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[#f5f6f6] dark:hover:bg-white/5"
              >
                <div className="relative flex-shrink-0">
                  <Avatar user={contact} />
                  {contact.online && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#25d366] ring-2 ring-white dark:ring-[#202c33]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{contact.displayName}</p>
                  <p className="truncate text-xs text-[#667781] dark:text-[#8696a0]">{contact.email}</p>
                </div>
                <MessageSquare className="h-4 w-4 text-[#54656f] dark:text-[#aebac1]" />
              </button>
            ))}
            {!filteredContacts.length && (
              <div className="px-6 py-10 text-center text-sm text-[#667781] dark:text-[#8696a0]">
                <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                <p className="font-medium">No contacts yet</p>
                <p className="mt-1 text-xs">Search users by name or email above to add contacts.</p>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
