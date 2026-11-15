import { useEffect, useMemo, useState } from "react";
import ChatApp from "./components/chat/ChatApp";
import TodoApp from "./components/todo/TodoApp";
import { createBackend } from "./services/backend";

export default function App() {
  const api = useMemo(() => createBackend(), []);
  const [mode, setMode] = useState("todo");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setMode("todo");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (mode === "chat") {
    return <ChatApp api={api} dark={dark} setDark={setDark} />;
  }

  return <TodoApp onUnlock={() => setMode("chat")} />;
}
