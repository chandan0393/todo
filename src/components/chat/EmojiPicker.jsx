import { useState } from "react";

const EMOJI_CATEGORIES = [
  {
    name: "Smileys",
    emojis: [
      "😀","😃","😄","😁","😆","😅","😂","🤣","🥲","🥹","😊","😇","🙂","🙃","😉","😌",
      "😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸",
      "🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢",
      "😭","😮‍💨","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗"
    ],
  },
  {
    name: "Gestures",
    emojis: [
      "👍","👎","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦵","🦶","👂",
      "👀","👁️","🧠","🫀","🫁","🦷","🦴","👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️",
      "🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","✊","👊","🤛","🤜"
    ],
  },
  {
    name: "Hearts & Sparkles",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💔","❤️‍🔥","❤️‍🩹","❣️","💕","💞","💓",
      "💗","💖","💘","💝","💟","✨","⭐","🌟","💫","💥","🔥","⚡","🎉","🎊","🎈","💯"
    ],
  },
  {
    name: "Everyday",
    emojis: [
      "☕","🍵","🍕","🍔","🍟","🍎","🥑","🍿","🎂","🍫","🍻","🥂","✈️","🚀","🚗","🚲",
      "💻","📱","📸","📷","🎧","🎮","💡","📌","📍","📎","🔒","🔑","🔔","🎵","🎶","🌿"
    ],
  },
];

export default function EmojiPicker({ onPick }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white p-2 shadow-lg dark:bg-wa-darkPanel">
      {/* Category selector */}
      <div className="flex gap-1 border-b border-black/10 pb-1.5 dark:border-white/10">
        {EMOJI_CATEGORIES.map((cat, idx) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => setActiveTab(idx)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              activeTab === idx
                ? "bg-wa-green text-white"
                : "text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Emojis grid */}
      <div className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto p-1 text-2xl sm:grid-cols-10 md:grid-cols-12">
        {EMOJI_CATEGORIES[activeTab].emojis.map((emoji, idx) => (
          <button
            key={`${emoji}-${idx}`}
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-transform hover:scale-125 hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
            onClick={() => onPick(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
