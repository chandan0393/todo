import { useState } from "react";

export default function AuthScreen({ api, onError }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "register") {
        await api.register({ email, password, displayName });
      } else {
        await api.login({ email, password });
      }
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-wa-teal text-white">
      <div className="px-8 pb-8 pt-16">
        <p className="text-sm text-white/70">Welcome</p>
        <h2 className="mt-1 font-chat text-3xl font-light">Keep your lists nearby</h2>
      </div>
      <form onSubmit={submit} className="flex-1 rounded-t-3xl bg-[#111b21] p-6 text-[#e9edef]">
        {mode === "register" && (
          <label className="mb-3 block text-sm">
            Name
            <input
              className="mt-1 w-full rounded-lg bg-[#202c33] px-3 py-2"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </label>
        )}
        <label className="mb-3 block text-sm">
          Email
          <input
            type="email"
            className="mt-1 w-full rounded-lg bg-[#202c33] px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="mb-4 block text-sm">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-lg bg-[#202c33] px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>
        <button
          disabled={busy}
          className="w-full rounded-lg bg-wa-green py-2.5 font-medium text-[#111b21]"
        >
          {busy ? "Please wait…" : mode === "register" ? "Create account" : "Continue"}
        </button>
        <button
          type="button"
          className="mt-4 w-full text-sm text-wa-green"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
