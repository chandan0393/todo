import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDatabase, onDisconnect, onValue, ref, set } from "firebase/database";
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from "firebase/storage";

function config() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  };
}

const convIdFor = (a, b) => [a, b].sort().join("__");

function mapUser(id, data, presence = {}) {
  return {
    id,
    email: data.email || "",
    displayName: data.displayName || "",
    photoURL: data.photoURL || "",
    lastSeen: presence.lastSeen || data.lastSeen || null,
    online: Boolean(presence.online),
  };
}

export function createFirebaseBackend() {
  const app = initializeApp(config());
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const rtdb = config().databaseURL ? getDatabase(app) : null;
  const storage = getStorage(app);
  const presenceCache = new Map();
  let current = null;
  let stopPresence = () => {};

  async function profile(uid) {
    const snap = await getDoc(doc(firestore, "users", uid));
    return snap.exists() ? mapUser(uid, snap.data(), presenceCache.get(uid)) : null;
  }

  function trackPresence(uid) {
    if (!rtdb) return;
    const statusRef = ref(rtdb, `status/${uid}`);
    set(statusRef, { online: true, lastSeen: Date.now() });
    onDisconnect(statusRef).set({ online: false, lastSeen: Date.now() });
  }

  function listenPresence() {
    if (!rtdb) return;
    stopPresence();
    stopPresence = onValue(ref(rtdb, "status"), (snap) => {
      Object.entries(snap.val() || {}).forEach(([id, v]) => presenceCache.set(id, v));
    });
  }

  return {
    mode: "firebase",
    subscribeAuth(cb) {
      return onAuthStateChanged(auth, async (fbUser) => {
        if (!fbUser) {
          current = null;
          cb(null);
          return;
        }
        current = await profile(fbUser.uid);
        if (current) {
          trackPresence(fbUser.uid);
          listenPresence();
        }
        cb(current);
      });
    },
    async register({ email, password, displayName }) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });
      await setDoc(doc(firestore, "users", cred.user.uid), {
        email,
        displayName,
        photoURL: "",
        createdAt: serverTimestamp(),
        lastSeen: Date.now(),
      });
    },
    login({ email, password }) {
      return signInWithEmailAndPassword(auth, email, password);
    },
    logout: () => signOut(auth),
    async updateProfile(payload) {
      const uid = auth.currentUser?.uid;
      if (!uid) return current;
      if (payload.displayName) {
        await updateProfile(auth.currentUser, { displayName: payload.displayName });
      }
      await updateDoc(doc(firestore, "users", uid), payload);
      current = { ...current, ...payload };
      return current;
    },
    async searchUsers(q) {
      const needle = q.trim().toLowerCase();
      if (!needle) return [];
      const snap = await getDocs(collection(firestore, "users"));
      return snap.docs
        .map((d) => mapUser(d.id, d.data(), presenceCache.get(d.id)))
        .filter(
          (u) =>
            u.id !== auth.currentUser?.uid &&
            (u.email.toLowerCase().includes(needle) || u.displayName.toLowerCase().includes(needle))
        )
        .slice(0, 12);
    },
    async listContacts() {
      const uid = auth.currentUser.uid;
      const snap = await getDocs(collection(firestore, "users", uid, "contacts"));
      const people = await Promise.all(snap.docs.map((d) => profile(d.id)));
      return people.filter(Boolean);
    },
    async addContact(userId) {
      const uid = auth.currentUser.uid;
      await setDoc(doc(firestore, "users", uid, "contacts", userId), { addedAt: Date.now() });
      await setDoc(doc(firestore, "users", userId, "contacts", uid), { addedAt: Date.now() });
      return profile(userId);
    },
    async listConversations() {
      const uid = auth.currentUser.uid;
      const snap = await getDocs(
        query(collection(firestore, "conversations"), where("participants", "array-contains", uid))
      );
      const rows = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          const otherId = data.participants.find((id) => id !== uid);
          return {
            id: d.id,
            ...data,
            other: otherId ? await profile(otherId) : null,
            unread: data.unread?.[uid] || 0,
          };
        })
      );
      return rows.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
    },
    async openConversation(userId) {
      const uid = auth.currentUser.uid;
      const id = convIdFor(uid, userId);
      const refDoc = doc(firestore, "conversations", id);
      if (!(await getDoc(refDoc)).exists()) {
        await setDoc(refDoc, {
          participants: [uid, userId],
          lastMessage: "",
          lastMessageAt: Date.now(),
          lastMessageSender: "",
          unread: { [uid]: 0, [userId]: 0 },
        });
      }
      const data = (await getDoc(refDoc)).data();
      return {
        id,
        ...data,
        other: await profile(userId),
        unread: data.unread?.[uid] || 0,
      };
    },
    async listMessages(id) {
      const snap = await getDocs(
        query(
          collection(firestore, "conversations", id, "messages"),
          orderBy("createdAt", "asc"),
          limit(400)
        )
      );
      const uid = auth.currentUser?.uid;
      return snap.docs
        .map((d) => ({
          id: d.id,
          conversationId: id,
          ...d.data(),
          createdAt: d.data().createdAt?.toMillis?.() || Date.now(),
        }))
        .filter((m) => !m.deletedFor || !m.deletedFor.includes(uid));
    },
    async markRead(id) {
      const uid = auth.currentUser.uid;
      await updateDoc(doc(firestore, "conversations", id), { [`unread.${uid}`]: 0 });
    },
    async deleteMessage(messageId, conversationId, mode = "everyone") {
      if (!conversationId) return;
      const uid = auth.currentUser?.uid;
      const msgRef = doc(firestore, "conversations", conversationId, "messages", messageId);
      if (mode === "me") {
        if (!uid) return;
        await updateDoc(msgRef, {
          deletedFor: arrayUnion(uid),
        });
      } else {
        await updateDoc(msgRef, {
          deleted: true,
          deletedEveryone: true,
          text: "",
          mediaUrl: "",
          reactions: {},
        });
      }
    },
    async toggleReaction(conversationId, messageId, emoji) {
      if (!conversationId || !messageId || !emoji) return;
      const msgRef = doc(firestore, "conversations", conversationId, "messages", messageId);
      const snap = await getDoc(msgRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const reactions = { ...(data.reactions || {}) };
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const currentList = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
      if (currentList.includes(uid)) {
        reactions[emoji] = currentList.filter((id) => id !== uid);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...currentList, uid];
      }
      await updateDoc(msgRef, { reactions });
    },
    async editMessage(conversationId, messageId, text) {
      if (!conversationId || !messageId) return;
      await updateDoc(doc(firestore, "conversations", conversationId, "messages", messageId), {
        text,
        edited: true,
        editedAt: Date.now(),
      });
    },
    async upload(file) {
      const uid = auth.currentUser.uid;
      const path = `uploads/${uid}/${Date.now()}-${file.name}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file);
      return {
        url: await getDownloadURL(fileRef),
        name: file.name,
        mime: file.type,
        size: file.size,
      };
    },
    connectRealtime({ onEvent }) {
      const uid = auth.currentUser?.uid;
      if (!uid) return { send() {}, close() {} };

      const unsubConv = onSnapshot(
        query(collection(firestore, "conversations"), where("participants", "array-contains", uid)),
        async (snap) => {
          for (const change of snap.docChanges()) {
            const data = change.doc.data();
            const otherId = data.participants.find((id) => id !== uid);
            onEvent({
              type: "conversation",
              conversation: {
                id: change.doc.id,
                ...data,
                other: otherId ? await profile(otherId) : null,
                unread: data.unread?.[uid] || 0,
              },
            });
            if (data.typing) {
              Object.entries(data.typing).forEach(([userId, value]) => {
                if (userId !== uid) {
                  onEvent({
                    type: "typing",
                    conversationId: change.doc.id,
                    userId,
                    value: Boolean(value),
                  });
                }
              });
            }
          }
        }
      );

      const messageUnsubs = new Map();
      const watch = (conversationId) => {
        if (messageUnsubs.has(conversationId)) return;
        const unsub = onSnapshot(
          query(
            collection(firestore, "conversations", conversationId, "messages"),
            orderBy("createdAt", "asc")
          ),
          (snap) => {
            snap.docChanges().forEach((change) => {
              const data = change.doc.data();
              if (data.deletedFor && data.deletedFor.includes(uid)) {
                onEvent({
                  type: "delete_for_me",
                  conversationId,
                  messageId: change.doc.id,
                });
                return;
              }
              onEvent({
                type: "message",
                message: {
                  id: change.doc.id,
                  conversationId,
                  ...data,
                  createdAt: data.createdAt?.toMillis?.() || Date.now(),
                },
                self: data.senderId === uid,
              });
            });
          }
        );
        messageUnsubs.set(conversationId, unsub);
      };

      return {
        async send(payload) {
          if (payload.type === "watch") {
            watch(payload.conversationId);
            return;
          }
          if (payload.type === "typing") {
            await updateDoc(doc(firestore, "conversations", payload.conversationId), {
              [`typing.${uid}`]: payload.value ? true : deleteField(),
            });
            return;
          }
          if (payload.type === "reaction") {
            const msgRef = doc(firestore, "conversations", payload.conversationId, "messages", payload.messageId);
            const snap = await getDoc(msgRef);
            if (!snap.exists()) return;
            const data = snap.data();
            const reactions = { ...(data.reactions || {}) };
            const currentList = Array.isArray(reactions[payload.emoji]) ? reactions[payload.emoji] : [];
            if (currentList.includes(uid)) {
              reactions[payload.emoji] = currentList.filter((id) => id !== uid);
              if (reactions[payload.emoji].length === 0) delete reactions[payload.emoji];
            } else {
              reactions[payload.emoji] = [...currentList, uid];
            }
            await updateDoc(msgRef, { reactions });
            return;
          }
          if (payload.type === "message") {
            const convRef = doc(firestore, "conversations", payload.conversationId);
            const conv = (await getDoc(convRef)).data();
            const otherId = conv.participants.find((id) => id !== uid);
            const lastPreview =
              payload.kind === "text"
                ? payload.text
                : payload.kind === "audio"
                ? "🎤 Voice message"
                : payload.kind === "image"
                ? "📷 Photo"
                : payload.kind === "video"
                ? "🎥 Video"
                : `📄 ${payload.fileName || "Document"}`;
            await addDoc(collection(firestore, "conversations", payload.conversationId, "messages"), {
              senderId: uid,
              type: payload.kind || "text",
              text: payload.text || "",
              mediaUrl: payload.mediaUrl || "",
              fileName: payload.fileName || "",
              fileSize: payload.fileSize || 0,
              replyTo: payload.replyTo || null,
              reactions: {},
              createdAt: serverTimestamp(),
              status: "sent",
              deleted: false,
            });
            await updateDoc(convRef, {
              lastMessage: lastPreview,
              lastMessageAt: Date.now(),
              lastMessageSender: uid,
              [`unread.${otherId}`]: (conv.unread?.[otherId] || 0) + 1,
            });
          }
        },
        close() {
          unsubConv();
          messageUnsubs.forEach((fn) => fn());
        },
      };
    },
  };
}
