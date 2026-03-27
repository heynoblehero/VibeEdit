import { db } from "@/lib/db";
import { credits, creditTransactions } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { SIGNUP_BONUS_CREDITS } from "./costs";

export function getBalance(userId: string): number {
  const records = db
    .select()
    .from(credits)
    .where(eq(credits.userId, userId))
    .all();
  return records[0]?.balance ?? 0;
}

export function ensureCreditRecord(userId: string): void {
  const existing = db
    .select()
    .from(credits)
    .where(eq(credits.userId, userId))
    .get();

  if (!existing) {
    db.insert(credits)
      .values({
        userId,
        balance: SIGNUP_BONUS_CREDITS,
      })
      .run();
    db.insert(creditTransactions)
      .values({
        userId,
        amount: SIGNUP_BONUS_CREDITS,
        type: "signup",
        description: "Welcome bonus credits",
      })
      .run();
  }
}

export function hasEnoughCredits(
  userId: string,
  amount: number,
): boolean {
  const balance = getBalance(userId);
  return balance >= amount;
}

export function deductCredits(
  userId: string,
  amount: number,
  toolName: string,
  description: string,
): boolean {
  if (amount <= 0) return true; // Free operations always succeed

  const balance = getBalance(userId);
  if (balance < amount) return false;

  db.update(credits)
    .set({
      balance: sql`${credits.balance} - ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(credits.userId, userId))
    .run();

  db.insert(creditTransactions)
    .values({
      userId,
      amount: -amount,
      type: "usage",
      description,
      toolName,
    })
    .run();

  return true;
}

export function addCredits(
  userId: string,
  amount: number,
  type: "purchase" | "bonus",
  description: string,
): void {
  ensureCreditRecord(userId);

  db.update(credits)
    .set({
      balance: sql`${credits.balance} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(credits.userId, userId))
    .run();

  db.insert(creditTransactions)
    .values({
      userId,
      amount,
      type,
      description,
    })
    .run();
}

export function getTransactionHistory(
  userId: string,
  limit: number = 50,
) {
  return db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit)
    .all();
}
