# Dayline

A personal task manager. On the surface it is a to-do list. A private messaging workspace is available only through a phrase typed into the task field.

The public UI never shows chat labels, icons, or navigation. Refreshing the page always returns to the task list. Escape does the same.

## Secret access

1. Open the app. You see only tasks.
2. Type the phrase `message` in **Add a task** and press Enter (or Add task).
3. The phrase is **not** saved as a task.
4. A messaging workspace opens. Sign in or register there — authentication is not shown on the task screen.
5. Press **Escape** to return to tasks immediately.

Change the phrase:

- Environment variable `VITE_SECRET_KEYWORD` (default `message`)
- After you are inside the messaging workspace: **Settings → Access phrase** (stored on this device)

## Local development (works without Firebase)

```bash
npm install
npm run dev
```

- App: http://localhost:5173
- API / WebSocket: http://localhost:3001

Create **two accounts** in two browsers (or a normal window and a private window). In each session, type `message`, sign in, search the other person’s email, add them, and chat.

Production-style local run:

```bash
npm run build
npm start
```

Then open http://localhost:3001

Local data lives in `data/` (accounts, messages, uploads). Do not commit that folder.

## Firebase production (Vercel / Netlify)

This is the intended hosted stack: Firebase Auth, Firestore, Storage, and Realtime Database for presence.

### 1. Create a Firebase project

1. [Firebase console](https://console.firebase.google.com/) → Add project.
2. Enable **Authentication → Email/Password**.
3. Create **Cloud Firestore** (production mode, then deploy the rules in this repo).
4. Create **Realtime Database** (used for online / last seen).
5. Enable **Storage**.
6. Project settings → add a **Web app** → copy the config.

### 2. Database schema

`users/{uid}`

| Field | Type |
| --- | --- |
| email | string |
| displayName | string |
| photoURL | string |
| createdAt | timestamp |
| lastSeen | number |

`users/{uid}/contacts/{otherUid}` → `{ addedAt: number }`

`conversations/{uidA__uidB}` (IDs sorted, joined with `__`)

| Field | Type |
| --- | --- |
| participants | string[] (exactly two uids) |
| lastMessage | string |
| lastMessageAt | number |
| lastMessageSender | string |
| unread | map uid → number |
| typing | map uid → bool |

`conversations/{id}/messages/{messageId}`

| Field | Type |
| --- | --- |
| senderId | string |
| type | `text` \| `image` \| `file` \| `audio` |
| text | string |
| mediaUrl | string |
| fileName | string |
| replyTo | map \| null |
| createdAt | timestamp |
| status | `sent` \| `delivered` \| `read` |
| deleted | bool |

Realtime Database: `status/{uid}` → `{ online: bool, lastSeen: number }`

Storage: `uploads/{uid}/{filename}`

### 3. Deploy security rules

```bash
npm i -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,storage,database
```

Rules files in this repo:

- `firestore.rules` — only members of a conversation can read or write its messages
- `storage.rules` — users may upload only under `uploads/{theirUid}/`, 12 MB cap, limited MIME types
- `database.rules.json` — a user may write only their own presence node

Hiding the chat UI is **not** security. Authorization is enforced by these rules and by the local API’s membership checks.

### 4. Environment variables

Copy `.env.example` to `.env` / Vercel env:

```
VITE_BACKEND=firebase
VITE_SECRET_KEYWORD=message
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_URL=
```

Firebase **web** config values are identifiers, not server secrets. They belong in the client. Protect data with Auth + rules. Never put a Firebase **service account** private key in frontend code or git.

### 5. GitHub and Vercel / Netlify

```bash
git init
git add .
git commit -m "Add Dayline task app"
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

**Vercel:** Import the GitHub repo. Framework: Vite. Set the `VITE_*` variables. `vercel.json` rewrites all routes to `index.html`.

**Netlify:** Build command `npm run build`, publish directory `dist`, same env vars. Add a redirect `/* /index.html 200`.

For Firebase hosting of the API-free static app, no Node server is required. Use `VITE_BACKEND=firebase`.

## Privacy notes

- Tasks are stored in **this browser** (`localStorage`).
- Messages are stored in the **backend** you configured.
- Users can only open conversations they belong to.
- File uploads are tied to the signed-in user.
- End-to-end encryption is not enabled in this version; transport is HTTPS/WSS plus server-side authorization. Treat the Firebase/local database as trusted infrastructure.

## Stack

- React 18, Vite, Tailwind CSS
- Local mode: Express, JWT, WebSockets, disk uploads
- Hosted mode: Firebase Auth, Firestore, Storage, Realtime Database
