import { randomBytes, scrypt } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./db";
import { user, account } from "./db/schema";

// Matches @better-auth/utils/password format: "salt:scryptHash"
async function hashForBetterAuth(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      64,
      { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
      (error, derivedKey) => (error ? reject(error) : resolve(derivedKey)),
    );
  });
  return `${salt}:${key.toString("hex")}`;
}

/**
 * Ensure the admin account exists with the password from ADMIN_PASSWORD.
 * Idempotent — runs on every startup, resets password each time so a new
 * ADMIN_PASSWORD deploy takes effect immediately.
 */
export async function seedAdmin(): Promise<void> {
  const email = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .find(Boolean);
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const hashed = await hashForBetterAuth(password);
  const now = new Date();

  let adminUser = db.select({ id: user.id }).from(user).where(eq(user.email, email)).get();

  if (!adminUser) {
    const id = nanoid(10);
    db.insert(user)
      .values({
        id,
        name: "Admin",
        email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    adminUser = { id };
  } else {
    db.update(user)
      .set({ emailVerified: true, updatedAt: now })
      .where(eq(user.id, adminUser.id))
      .run();
  }

  const existing = db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, adminUser.id), eq(account.providerId, "credential")))
    .get();

  if (existing) {
    db.update(account).set({ password: hashed }).where(eq(account.id, existing.id)).run();
  } else {
    db.insert(account)
      .values({
        id: nanoid(10),
        accountId: adminUser.id,
        providerId: "credential",
        userId: adminUser.id,
        password: hashed,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  console.log(`[seed-admin] account ready: ${email}`);
}
