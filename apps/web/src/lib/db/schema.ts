import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
	id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
	email: text("email").notNull().unique(),
	name: text("name").notNull().default(""),
	emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
	image: text("image"),
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	token: text("token").notNull().unique(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const accounts = sqliteTable("accounts", {
	id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
	refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
	scope: text("scope"),
	password: text("password"),
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const verifications = sqliteTable("verifications", {
	id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const credits = sqliteTable("credits", {
	id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
	balance: integer("balance").notNull().default(10),
	updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const creditTransactions = sqliteTable("credit_transactions", {
	id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	amount: integer("amount").notNull(),
	type: text("type").notNull(),
	description: text("description"),
	toolName: text("tool_name"),
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const projects = sqliteTable("projects", {
	id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	name: text("name").notNull().default("Untitled Project"),
	settings: text("settings"),
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const apiKeys = sqliteTable("api_keys", {
	id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	service: text("service").notNull(),
	encryptedKey: text("encrypted_key").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
