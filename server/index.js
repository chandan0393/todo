import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import { WebSocketServer } from "ws";
import { loadDb, saveDb, uploadsDir } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || "dayline-dev-secret";
const isProd = process.env.NODE_ENV === "production";

fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadsDir));

const dist = path.join(__dirname, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").slice(0, 8);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
});

let db = loadDb();
const sockets = new Map();
const typing = new Map();
const presence = new Map();

function persist() {
  saveDb(db);
}

function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function publicUser(user, extra = {}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL || "",
    lastSeen: presence.get(user.id)?.lastSeen || user.lastSeen || null,
    online: Boolean(presence.get(user.id)?.online),
    ...extra,
  };
}

function sign(user) {
  return jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: "14d" });
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    const { uid: id } = jwt.verify(token, JWT_SECRET);
    const user = db.users.find((u) => u.id === id);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

function convFor(a, b) {
  const pair = [a, b].sort();
  return db.conversations.find(
    (c) =>
      c.participants.length === 2 &&
      [...c.participants].sort()[0] === pair[0] &&
      [...c.participants].sort()[1] === pair[1]
  );
}

function assertMember(conv, userId) {
  return conv && conv.participants.includes(userId);
}

function emitTo(userId, payload) {
  const set = sockets.get(userId);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
}

function emitConv(conv, payload, exceptId) {
  conv.participants.forEach((id) => {
    if (id !== exceptId) emitTo(id, payload);
  });
}

app.post("/api/register", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const displayName = String(req.body.displayName || "").trim() || email.split("@")[0];
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: "Email and a 6+ character password are required." });
  }
  if (db.users.some((u) => u.email === email)) {
    return res.status(409).json({ error: "That email is already registered." });
  }
  const user = {
    id: uid(),
    email,
    passwordHash: await bcrypt.hash(password, 10),
    displayName,
    photoURL: "",
    lastSeen: Date.now(),
    createdAt: Date.now(),
  };
  db.users.push(user);
  persist();
  res.json({ token: sign(user), user: publicUser(user) });
});

app.post("/api/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = db.users.find((u) => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  res.json({ token: sign(user), user: publicUser(user) });
});

app.get("/api/me", auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.patch("/api/me", auth, (req, res) => {
  if (req.body.displayName) req.user.displayName = String(req.body.displayName).slice(0, 40);
  if (typeof req.body.photoURL === "string") req.user.photoURL = req.body.photoURL;
  persist();
  res.json({ user: publicUser(req.user) });
  emitTo(req.user.id, { type: "profile", user: publicUser(req.user) });
});

app.get("/api/users/search", auth, (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q) return res.json({ users: [] });
  const users = db.users
    .filter(
      (u) =>
        u.id !== req.user.id &&
        (u.email.includes(q) || u.displayName.toLowerCase().includes(q))
    )
    .slice(0, 12)
    .map((u) => publicUser(u));
  res.json({ users });
});

app.get("/api/contacts", auth, (req, res) => {
  const ids = db.contacts.filter((c) => c.userId === req.user.id).map((c) => c.contactId);
  const users = ids
    .map((id) => db.users.find((u) => u.id === id))
    .filter(Boolean)
    .map((u) => publicUser(u));
  res.json({ contacts: users });
});

app.post("/api/contacts", auth, (req, res) => {
  const contactId = String(req.body.userId || "");
  const other = db.users.find((u) => u.id === contactId);
  if (!other || other.id === req.user.id) {
    return res.status(400).json({ error: "User not found." });
  }
  if (!db.contacts.some((c) => c.userId === req.user.id && c.contactId === contactId)) {
    db.contacts.push({ userId: req.user.id, contactId, addedAt: Date.now() });
  }
  if (!db.contacts.some((c) => c.userId === contactId && c.contactId === req.user.id)) {
    db.contacts.push({ userId: contactId, contactId: req.user.id, addedAt: Date.now() });
  }
  persist();
  res.json({ contact: publicUser(other) });
});

function decorateConv(conv, userId) {
  const otherId = conv.participants.find((id) => id !== userId);
  const other = db.users.find((u) => u.id === otherId);
  return {
    ...conv,
    other: other ? publicUser(other) : null,
    unread: conv.unread?.[userId] || 0,
  };
}

app.get("/api/conversations", auth, (req, res) => {
  const list = db.conversations
    .filter((c) => c.participants.includes(req.user.id))
    .map((c) => decorateConv(c, req.user.id))
    .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
  res.json({ conversations: list });
});

app.post("/api/conversations", auth, (req, res) => {
  const otherId = String(req.body.userId || "");
  const other = db.users.find((u) => u.id === otherId);
  if (!other || other.id === req.user.id) {
    return res.status(400).json({ error: "User not found." });
  }
  let conv = convFor(req.user.id, otherId);
  if (!conv) {
    conv = {
      id: uid(),
      participants: [req.user.id, otherId],
      lastMessage: "",
      lastMessageAt: Date.now(),
      lastMessageSender: "",
      unread: { [req.user.id]: 0, [otherId]: 0 },
    };
    db.conversations.push(conv);
    persist();
  }
  res.json({ conversation: decorateConv(conv, req.user.id) });
});

app.get("/api/conversations/:id/messages", auth, (req, res) => {
  const conv = db.conversations.find((c) => c.id === req.params.id);
  if (!assertMember(conv, req.user.id)) return res.status(403).json({ error: "Forbidden" });
  const messages = db.messages
    .filter((m) => m.conversationId === conv.id)
    .filter((m) => !m.deletedFor || !m.deletedFor.includes(req.user.id))
    .sort((a, b) => a.createdAt - b.createdAt);
  res.json({ messages });
});

app.post("/api/conversations/:id/read", auth, (req, res) => {
  const conv = db.conversations.find((c) => c.id === req.params.id);
  if (!assertMember(conv, req.user.id)) return res.status(403).json({ error: "Forbidden" });
  conv.unread = { ...conv.unread, [req.user.id]: 0 };
  db.messages
    .filter((m) => m.conversationId === conv.id && m.senderId !== req.user.id)
    .forEach((m) => {
      m.status = "read";
    });
  persist();
  emitConv(conv, { type: "read", conversationId: conv.id, readerId: req.user.id });
  res.json({ ok: true });
});

app.delete("/api/messages/:id", auth, (req, res) => {
  const msg = db.messages.find((m) => m.id === req.params.id);
  if (!msg) return res.status(404).json({ error: "Not found" });
  const conv = db.conversations.find((c) => c.id === msg.conversationId);
  if (!assertMember(conv, req.user.id)) return res.status(403).json({ error: "Forbidden" });

  const mode = req.query.mode || req.body?.mode || "everyone";
  if (mode === "me") {
    if (!msg.deletedFor) msg.deletedFor = [];
    if (!msg.deletedFor.includes(req.user.id)) {
      msg.deletedFor.push(req.user.id);
    }
    persist();
    emitTo(req.user.id, {
      type: "delete_for_me",
      conversationId: conv.id,
      messageId: msg.id,
    });
    return res.json({ ok: true, mode: "me" });
  }

  // Delete for everyone
  if (msg.senderId !== req.user.id) {
    return res.status(403).json({ error: "Can only delete own message for everyone" });
  }
  msg.deleted = true;
  msg.deletedEveryone = true;
  msg.text = "";
  msg.mediaUrl = "";
  msg.reactions = {};
  if (conv.lastMessageSender === req.user.id) {
    conv.lastMessage = "This message was deleted";
  }
  persist();

  const delPayload = {
    type: "delete",
    conversationId: conv.id,
    messageId: msg.id,
    message: msg,
  };
  emitTo(req.user.id, delPayload);
  emitConv(conv, delPayload, req.user.id);
  res.json({ ok: true, mode: "everyone", message: msg });
});

app.post("/api/messages/:id/react", auth, (req, res) => {
  const msg = db.messages.find((m) => m.id === req.params.id);
  if (!msg || msg.deleted) return res.status(404).json({ error: "Message not found" });
  const conv = db.conversations.find((c) => c.id === msg.conversationId);
  if (!assertMember(conv, req.user.id)) return res.status(403).json({ error: "Forbidden" });

  const emoji = String(req.body.emoji || "").trim();
  if (!emoji) return res.status(400).json({ error: "Emoji required" });

  if (!msg.reactions) msg.reactions = {};
  const currentList = Array.isArray(msg.reactions[emoji]) ? msg.reactions[emoji] : [];
  if (currentList.includes(req.user.id)) {
    msg.reactions[emoji] = currentList.filter((id) => id !== req.user.id);
    if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
  } else {
    msg.reactions[emoji] = [...currentList, req.user.id];
  }
  persist();

  const payload = {
    type: "reaction",
    conversationId: conv.id,
    messageId: msg.id,
    reactions: msg.reactions,
    userId: req.user.id,
    emoji,
  };
  emitTo(req.user.id, payload);
  emitConv(conv, payload, req.user.id);
  res.json({ reactions: msg.reactions });
});

app.patch("/api/messages/:id", auth, (req, res) => {
  const msg = db.messages.find((m) => m.id === req.params.id);
  if (!msg || msg.deleted) return res.status(404).json({ error: "Message not found" });
  const conv = db.conversations.find((c) => c.id === msg.conversationId);
  if (!assertMember(conv, req.user.id)) return res.status(403).json({ error: "Forbidden" });
  if (msg.senderId !== req.user.id) return res.status(403).json({ error: "Can only edit own messages" });

  const text = String(req.body.text || "").trim().slice(0, 4000);
  if (!text) return res.status(400).json({ error: "Message text cannot be empty" });

  msg.text = text;
  msg.edited = true;
  msg.editedAt = Date.now();
  if (conv.lastMessageSender === req.user.id && (!msg.type || msg.type === "text")) {
    conv.lastMessage = text;
  }
  persist();

  const payload = {
    type: "edit",
    conversationId: conv.id,
    messageId: msg.id,
    text: msg.text,
    edited: true,
    editedAt: msg.editedAt,
  };
  emitTo(req.user.id, payload);
  emitConv(conv, payload, req.user.id);
  res.json({ message: msg });
});

app.post("/api/upload", auth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const url = `/uploads/${req.file.filename}`;
  res.json({
    url,
    name: req.file.originalname,
    mime: req.file.mimetype,
    size: req.file.size,
  });
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/ws") || req.path.startsWith("/uploads")) {
    return next();
  }
  const indexHtml = path.join(__dirname, "..", "dist", "index.html");
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(404).send("Dayline frontend build not found. Please run 'npm run build' first.");
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

function setOnline(userId, online) {
  presence.set(userId, { online, lastSeen: Date.now() });
  const user = db.users.find((u) => u.id === userId);
  if (user) {
    user.lastSeen = Date.now();
    persist();
  }
  const payload = {
    type: "presence",
    userId,
    online,
    lastSeen: Date.now(),
  };
  db.conversations
    .filter((c) => c.participants.includes(userId))
    .forEach((c) => emitConv(c, payload));
}

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://localhost");
  const token = url.searchParams.get("token") || "";
  let user;
  try {
    const { uid: id } = jwt.verify(token, JWT_SECRET);
    user = db.users.find((u) => u.id === id);
  } catch {
    ws.close();
    return;
  }
  if (!user) {
    ws.close();
    return;
  }
  ws.userId = user.id;
  if (!sockets.has(user.id)) sockets.set(user.id, new Set());
  sockets.get(user.id).add(ws);
  setOnline(user.id, true);

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (msg.type === "message") {
      const conv = db.conversations.find((c) => c.id === msg.conversationId);
      if (!assertMember(conv, user.id)) return;
      const item = {
        id: uid(),
        conversationId: conv.id,
        senderId: user.id,
        type: ["text", "image", "file", "audio", "video"].includes(msg.kind) ? msg.kind : "text",
        text: String(msg.text || "").slice(0, 4000),
        mediaUrl: String(msg.mediaUrl || ""),
        fileName: String(msg.fileName || ""),
        fileSize: Number(msg.fileSize || 0),
        replyTo: msg.replyTo || null,
        reactions: {},
        createdAt: Date.now(),
        status: "sent",
        deleted: false,
      };
      db.messages.push(item);
      conv.lastMessage = item.deleted
        ? ""
        : item.type === "text"
        ? item.text
        : item.type === "audio"
        ? "🎤 Voice message"
        : item.type === "image"
        ? "📷 Photo"
        : item.type === "video"
        ? "🎥 Video"
        : `📄 ${item.fileName || "Document"}`;
      conv.lastMessageAt = item.createdAt;
      conv.lastMessageSender = user.id;
      conv.participants.forEach((id) => {
        if (id !== user.id) {
          conv.unread[id] = (conv.unread[id] || 0) + 1;
        }
      });
      const otherId = conv.participants.find((id) => id !== user.id);
      if (sockets.get(otherId)?.size) item.status = "delivered";
      persist();
      emitTo(user.id, { type: "message", message: item, self: true });
      emitConv(conv, { type: "message", message: item, self: false }, user.id);
      emitConv(conv, {
        type: "conversation",
        conversation: decorateConv(conv, otherId),
      });
      emitTo(user.id, {
        type: "conversation",
        conversation: decorateConv(conv, user.id),
      });
      return;
    }

    if (msg.type === "reaction") {
      const conv = db.conversations.find((c) => c.id === msg.conversationId);
      if (!assertMember(conv, user.id)) return;
      const targetMsg = db.messages.find((m) => m.id === msg.messageId);
      if (!targetMsg || targetMsg.deleted) return;

      const emoji = String(msg.emoji || "").trim();
      if (!emoji) return;

      if (!targetMsg.reactions) targetMsg.reactions = {};
      const currentList = Array.isArray(targetMsg.reactions[emoji]) ? targetMsg.reactions[emoji] : [];

      if (currentList.includes(user.id)) {
        targetMsg.reactions[emoji] = currentList.filter((id) => id !== user.id);
        if (targetMsg.reactions[emoji].length === 0) {
          delete targetMsg.reactions[emoji];
        }
      } else {
        targetMsg.reactions[emoji] = [...currentList, user.id];
      }
      persist();

      const reactionPayload = {
        type: "reaction",
        conversationId: conv.id,
        messageId: targetMsg.id,
        reactions: targetMsg.reactions,
        userId: user.id,
        emoji,
      };
      emitTo(user.id, reactionPayload);
      emitConv(conv, reactionPayload, user.id);
      return;
    }

    if (msg.type === "edit") {
      const conv = db.conversations.find((c) => c.id === msg.conversationId);
      if (!assertMember(conv, user.id)) return;
      const targetMsg = db.messages.find((m) => m.id === msg.messageId);
      if (!targetMsg || targetMsg.deleted || targetMsg.senderId !== user.id) return;

      const text = String(msg.text || "").trim().slice(0, 4000);
      if (!text) return;

      targetMsg.text = text;
      targetMsg.edited = true;
      targetMsg.editedAt = Date.now();
      if (conv.lastMessageSender === user.id && (!targetMsg.type || targetMsg.type === "text")) {
        conv.lastMessage = text;
      }
      persist();

      const editPayload = {
        type: "edit",
        conversationId: conv.id,
        messageId: targetMsg.id,
        text: targetMsg.text,
        edited: true,
        editedAt: targetMsg.editedAt,
      };
      emitTo(user.id, editPayload);
      emitConv(conv, editPayload, user.id);
      return;
    }

    if (msg.type === "delete") {
      const conv = db.conversations.find((c) => c.id === msg.conversationId);
      if (!assertMember(conv, user.id)) return;
      const targetMsg = db.messages.find((m) => m.id === msg.messageId);
      if (!targetMsg) return;

      const mode = msg.mode || "everyone";
      if (mode === "me") {
        if (!targetMsg.deletedFor) targetMsg.deletedFor = [];
        if (!targetMsg.deletedFor.includes(user.id)) {
          targetMsg.deletedFor.push(user.id);
        }
        persist();
        emitTo(user.id, {
          type: "delete_for_me",
          conversationId: conv.id,
          messageId: targetMsg.id,
        });
      } else {
        if (targetMsg.senderId !== user.id) return;
        targetMsg.deleted = true;
        targetMsg.deletedEveryone = true;
        targetMsg.text = "";
        targetMsg.mediaUrl = "";
        targetMsg.reactions = {};
        if (conv.lastMessageSender === user.id) {
          conv.lastMessage = "This message was deleted";
        }
        persist();

        const delPayload = {
          type: "delete",
          conversationId: conv.id,
          messageId: targetMsg.id,
          message: targetMsg,
        };
        emitTo(user.id, delPayload);
        emitConv(conv, delPayload, user.id);
      }
      return;
    }

    if (msg.type === "typing") {
      const conv = db.conversations.find((c) => c.id === msg.conversationId);
      if (!assertMember(conv, user.id)) return;
      typing.set(`${conv.id}:${user.id}`, Boolean(msg.value));
      emitConv(
        conv,
        {
          type: "typing",
          conversationId: conv.id,
          userId: user.id,
          value: Boolean(msg.value),
        },
        user.id
      );
    }
  });

  ws.on("close", () => {
    sockets.get(user.id)?.delete(ws);
    if (!sockets.get(user.id)?.size) setOnline(user.id, false);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Dayline API on http://localhost:${PORT}`);
});
