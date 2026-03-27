import { db } from "@/lib/db";
import { credits, creditTransactions } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { SIGNUP_BONUS_CREDITS } from "./costs";

export async function getBalance(userId: string): Promise<number> {
  const [record] = await db
    .select()
    .from(credits)
    .where(eq(credits.userId, userId));
  return record?.balance ?? 0;
}

export async function ensureCreditRecord(userId: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(credits)
    .where(eq(credits.userId, userId));

  if (!existing) {
    await db.insert(credits).values({
      userId,
      balance: SIGNUP_BONUS_CREDITS,
    });
    await db.insert(creditTransactions).values({
      userId,
      amount: SIGNUP_BONUS_CREDITS,
      type: "signup",
      description: "Welcome bonus credits",
    });
  }
}

export async function hasEnoughCredits(
  userId: string,
  amount: number,
): Promise<boolean> {
  const balance = await getBalance(userId);
  return balance >= amount;
}

export async function deductCredits(
  userId: string,
  amount: number,
  toolName: string,
  description: string,
): Promise<boolean> {
  if (amount <= 0) return true; // Free operations always succeed

  const balance = await getBalance(userId);
  if (balance < amount) return false;

  await db
    .update(credits)
    .set({
      balance: sql`${credits.balance} - ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(credits.userId, userId));

  await db.insert(creditTransactions).values({
    userId,
    amount: -amount,
    type: "usage",
    description,
    toolName,
  });

  return true;
}

export async function addCredits(
  userId: string,
  amount: number,
  type: "purchase" | "bonus",
  description: string,
): Promise<void> {
  await ensureCreditRecord(userId);

  await db
    .update(credits)
    .set({
      balance: sql`${credits.balance} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(credits.userId, userId));

  await db.insert(creditTransactions).values({
    userId,
    amount,
    type,
    description,
  });
}

export async function getTransactionHistory(
  userId: string,
  limit: number = 50,
) {
  return db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit);
}
