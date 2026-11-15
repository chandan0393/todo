import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "db.json");

const empty = () => ({
  users: [],
  contacts: [],
  conversations: [],
  messages: [],
});

export function loadDb() {
  try {
    return { ...empty(), ...JSON.parse(fs.readFileSync(FILE, "utf8")) };
  } catch {
    return empty();
  }
}

export function saveDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

export const uploadsDir = path.join(DATA_DIR, "uploads");
