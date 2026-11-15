const TOKEN_KEY = "dayline.token";
const SERVER_URL_KEY = "dayline.server_url";

function token() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function getServerUrl() {
  return localStorage.getItem(SERVER_URL_KEY) || "";
}

export function setServerUrl(url) {
  if (url) {
    localStorage.setItem(SERVER_URL_KEY, url.trim().replace(/\/+$/, ""));
  } else {
    localStorage.removeItem(SERVER_URL_KEY);
  }
}

function getApiBase() {
  const custom = getServerUrl();
  return custom ? custom.replace(/\/+$/, "") : "";
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  if (!(options.body instanceof FormData) && options.body && typeof options.body === "object") {
    headers["Content-Type"] = "application/json";
    options = { ...options, body: JSON.stringify(options.body) };
  }
  const fullUrl = `${getApiBase()}${path}`;
  const res = await fetch(fullUrl, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export function createLocalBackend() {
  let authCb = () => {};
  let socket = null;

  async function hydrate() {
    if (!token()) {
      authCb(null);
      return;
    }
    try {
      const { user } = await request("/api/me");
      authCb(user);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      authCb(null);
    }
  }

  return {
    mode: "local",
    subscribeAuth(cb) {
      authCb = cb;
      hydrate();
      return () => {
        authCb = () => {};
      };
    },
    async register(payload) {
      const { token: t, user } = await request("/api/register", { method: "POST", body: payload });
      localStorage.setItem(TOKEN_KEY, t);
      authCb(user);
      return user;
    },
    async login(payload) {
      const { token: t, user } = await request("/api/login", { method: "POST", body: payload });
      localStorage.setItem(TOKEN_KEY, t);
      authCb(user);
      return user;
    },
    async logout() {
      localStorage.removeItem(TOKEN_KEY);
      if (socket) socket.close();
      authCb(null);
    },
    async updateProfile(payload) {
      const { user } = await request("/api/me", { method: "PATCH", body: payload });
      authCb(user);
      return user;
    },
    searchUsers: (q) => request(`/api/users/search?q=${encodeURIComponent(q)}`).then((d) => d.users),
    listContacts: () => request("/api/contacts").then((d) => d.contacts),
    addContact: (userId) =>
      request("/api/contacts", { method: "POST", body: { userId } }).then((d) => d.contact),
    listConversations: () => request("/api/conversations").then((d) => d.conversations),
    openConversation: (userId) =>
      request("/api/conversations", { method: "POST", body: { userId } }).then((d) => d.conversation),
    listMessages: (id) =>
      request(`/api/conversations/${id}/messages`).then((d) => d.messages),
    markRead: (id) => request(`/api/conversations/${id}/read`, { method: "POST" }),
    deleteMessage: (id, conversationId, mode = "everyone") => {
      if (socket?.readyState === WebSocket.OPEN && conversationId) {
        socket.send(JSON.stringify({ type: "delete", conversationId, messageId: id, mode }));
        return Promise.resolve({ ok: true, mode });
      }
      return request(`/api/messages/${id}?mode=${encodeURIComponent(mode)}`, {
        method: "DELETE",
        body: { mode },
      });
    },
    editMessage(conversationId, messageId, text) {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "edit", conversationId, messageId, text }));
      } else {
        return request(`/api/messages/${messageId}`, { method: "PATCH", body: { text } });
      }
    },
    toggleReaction(conversationId, messageId, emoji) {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "reaction", conversationId, messageId, emoji }));
      } else {
        return request(`/api/messages/${messageId}/react`, { method: "POST", body: { emoji } });
      }
    },
    async upload(file) {
      const body = new FormData();
      body.append("file", file);
      return request("/api/upload", { method: "POST", body });
    },
    connectRealtime({ onEvent }) {
      if (socket) socket.close();
      const base = getApiBase();
      let proto = location.protocol === "https:" ? "wss" : "ws";
      let host = location.host;
      if (base) {
        try {
          const u = new URL(base);
          proto = u.protocol === "https:" ? "wss" : "ws";
          host = u.host;
        } catch { }
      }
      socket = new WebSocket(`${proto}://${host}/ws?token=${encodeURIComponent(token())}`);
      socket.onmessage = (ev) => {
        try {
          onEvent(JSON.parse(ev.data));
        } catch {
          /* ignore */
        }
      };
      return {
        send(payload) {
          if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
        },
        close() {
          socket?.close();
        },
      };
    },
  };
}
