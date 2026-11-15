import { useEffect, useMemo, useState } from "react";
import { matchesKeyword } from "../../lib/keyword";

const TASKS_KEY = "dayline.tasks";
const CATEGORIES = ["Personal", "Work", "Home", "Health"];
const PRIORITIES = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

function loadTasks() {
  try {
    const rows = JSON.parse(localStorage.getItem(TASKS_KEY) || "[]");
    if (Array.isArray(rows) && rows.length) return rows;
  } catch {
    /* seed */
  }
  return [
    { id: "1", title: "Water the balcony plants", category: "Home", priority: "low", due: "", done: false },
    { id: "2", title: "Send the school permission slip", category: "Personal", priority: "high", due: new Date().toISOString().slice(0, 10), done: false },
    { id: "3", title: "Review weekly notes", category: "Work", priority: "medium", due: "", done: true },
  ];
}

export default function TodoApp({ onUnlock }) {
  const [tasks, setTasks] = useState(loadTasks);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Personal");
  const [priority, setPriority] = useState("medium");
  const [due, setDue] = useState("");
  const [filter, setFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");

  useEffect(() => {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const visible = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === "open" && t.done) return false;
      if (filter === "done" && !t.done) return false;
      if (catFilter !== "all" && t.category !== catFilter) return false;
      return true;
    });
  }, [tasks, filter, catFilter]);

  const openCount = tasks.filter((t) => !t.done).length;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  function addTask(e) {
    e.preventDefault();
    if (matchesKeyword(title)) {
      setTitle("");
      onUnlock();
      return;
    }
    const text = title.trim();
    if (!text) return;
    setTasks((prev) => [
      {
        id: crypto.randomUUID(),
        title: text,
        category,
        priority,
        due,
        done: false,
      },
      ...prev,
    ]);
    setTitle("");
  }

  function toggle(id) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function remove(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="min-h-screen bg-paper px-4 py-8 text-ink">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#7a6f62]">{today}</p>
            <h1 className="font-serif text-4xl tracking-tight">Dayline</h1>
            <p className="mt-1 text-sm text-[#7a6f62]">{openCount} open tasks</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-[#d9cfc0] px-3 py-1.5 text-sm text-[#7a6f62]"
            onClick={() => setTasks((prev) => prev.filter((t) => !t.done))}
          >
            Clear done
          </button>
        </header>

        <form onSubmit={addTask} className="rounded-3xl border border-[#e2d8c8] bg-white p-4 shadow-sm">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a task"
            className="w-full rounded-2xl border border-[#eadfce] px-4 py-3 outline-none focus:border-sage"
            maxLength={180}
            aria-label="New task"
          />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-[#eadfce] bg-[#fbf7f0] px-2 py-2 text-sm"
              aria-label="Category"
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded-xl border border-[#eadfce] bg-[#fbf7f0] px-2 py-2 text-sm"
              aria-label="Priority"
            >
              {PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="rounded-xl border border-[#eadfce] bg-[#fbf7f0] px-2 py-2 text-sm"
              aria-label="Due date"
            />
          </div>
          <button
            type="submit"
            className="mt-3 w-full rounded-2xl bg-sage py-2.5 text-sm font-semibold text-white"
          >
            Add task
          </button>
        </form>

        <div className="mt-5 flex flex-wrap gap-2">
          {["all", "open", "done"].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-full px-3 py-1 text-sm capitalize ${
                filter === id ? "bg-ink text-white" : "bg-white text-[#7a6f62]"
              }`}
            >
              {id}
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-[#e2d8c8]" />
          {["all", ...CATEGORIES].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setCatFilter(id)}
              className={`rounded-full px-3 py-1 text-sm ${
                catFilter === id ? "bg-white ring-1 ring-ink" : "text-[#7a6f62]"
              }`}
            >
              {id}
            </button>
          ))}
        </div>

        <ul className="mt-5 space-y-3">
          {visible.map((task) => (
            <li
              key={task.id}
              className="flex items-start gap-3 rounded-2xl border border-[#e2d8c8] bg-white p-4"
            >
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => toggle(task.id)}
                className="mt-1 h-4 w-4 accent-sage"
              />
              <div className="min-w-0 flex-1">
                <p className={`leading-snug ${task.done ? "text-[#9a8f82] line-through" : ""}`}>
                  {task.title}
                </p>
                <p className="mt-1 text-xs text-[#8a7f72]">
                  {task.category}
                  {" · "}
                  {task.priority}
                  {task.due ? ` · due ${task.due}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-[#b5aa9c]"
                onClick={() => remove(task.id)}
                aria-label="Delete task"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        {!visible.length && (
          <p className="mt-12 text-center font-serif text-2xl text-[#7a6f62]">Nothing on this list.</p>
        )}
      </div>
    </div>
  );
}
