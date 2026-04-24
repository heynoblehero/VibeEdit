import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

interface User {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
  unlockedWorkflows: string[];
}

interface Session {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

// Persistent data dir. Override with VIBEEDIT_DATA_DIR=/data in prod so
// the auth files survive container restarts on dokku (where /data is a
// mounted volume).
const DATA_DIR =
  process.env.VIBEEDIT_DATA_DIR || path.join(process.cwd(), ".data");
const USERS_PATH = path.join(DATA_DIR, "users.json");
const SESSIONS_PATH = path.join(DATA_DIR, "sessions.json");

try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch {
  // exists
}

function readUsers(): User[] {
  if (!fs.existsSync(USERS_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_PATH, "utf8"));
  } catch {
    return [];
  }
}
function writeUsers(users: User[]) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
}
function readSessions(): Session[] {
  if (!fs.existsSync(SESSIONS_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_PATH, "utf8"));
  } catch {
    return [];
  }
}
function writeSessions(sessions: Session[]) {
  fs.writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2));
}

function hash(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function signup(email: string, password: string): Promise<Session> {
  if (!email.includes("@")) throw new Error("invalid email");
  if (password.length < 8) throw new Error("password must be 8+ chars");
  const users = readUsers();
  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) throw new Error("email already registered");
  const salt = crypto.randomBytes(16).toString("hex");
  const user: User = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    passwordHash: hash(password, salt),
    salt,
    createdAt: Date.now(),
    // Free workflows by default — gated ones require a purchase.
    unlockedWorkflows: ["faceless", "slideshow"],
  };
  users.push(user);
  writeUsers(users);
  return createSession(user.id);
}

export async function signin(email: string, password: string): Promise<Session> {
  const users = readUsers();
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error("no such user");
  if (hash(password, user.salt) !== user.passwordHash) throw new Error("wrong password");
  return createSession(user.id);
}

function createSession(userId: string): Session {
  const sessions = readSessions();
  const session: Session = {
    token: crypto.randomBytes(24).toString("hex"),
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  const fresh = sessions.filter((s) => s.expiresAt > Date.now());
  fresh.push(session);
  writeSessions(fresh);
  return session;
}

export function sessionFor(token: string | undefined | null): Session | null {
  if (!token) return null;
  const sessions = readSessions();
  const s = sessions.find((x) => x.token === token);
  if (!s) return null;
  if (s.expiresAt < Date.now()) return null;
  return s;
}

export function userById(id: string): User | null {
  return readUsers().find((u) => u.id === id) ?? null;
}

export function unlockWorkflow(userId: string, workflowId: string): User | null {
  const users = readUsers();
  const u = users.find((x) => x.id === userId);
  if (!u) return null;
  if (!u.unlockedWorkflows.includes(workflowId)) {
    u.unlockedWorkflows.push(workflowId);
    writeUsers(users);
  }
  return u;
}
