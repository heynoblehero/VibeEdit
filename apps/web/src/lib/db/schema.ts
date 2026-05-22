import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

// Better-Auth required tables ----------------------------------------------

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("emailVerified", { mode: "boolean" })
		.notNull()
		.default(false),
	image: text("image"),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
	id: text("id").primaryKey(),
	expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
	token: text("token").notNull().unique(),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
	ipAddress: text("ipAddress"),
	userAgent: text("userAgent"),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
	id: text("id").primaryKey(),
	accountId: text("accountId").notNull(),
	providerId: text("providerId").notNull(),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accessToken: text("accessToken"),
	refreshToken: text("refreshToken"),
	idToken: text("idToken"),
	accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
	refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp" }),
	scope: text("scope"),
	password: text("password"),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }),
	updatedAt: integer("updatedAt", { mode: "timestamp" }),
});

// App tables ---------------------------------------------------------------

export const projects = sqliteTable("projects", {
	id: text("id").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const messages = sqliteTable(
	"messages",
	{
		id: text("id").primaryKey(),
		projectId: text("projectId")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		role: text("role").notNull(),
		// JSON-encoded array of Anthropic content blocks
		content: text("content").notNull(),
		createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		// Per-project chat history scrolls back through this index every editor load.
		projectCreatedIdx: index("messages_project_created_idx").on(
			table.projectId,
			table.createdAt,
		),
	}),
);

export const renderJobs = sqliteTable(
	"renderJobs",
	{
		id: text("id").primaryKey(),
		projectId: text("projectId")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		userId: text("userId")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		status: text("status").notNull().default("queued"),
		progress: real("progress").notNull().default(0),
		outputPath: text("outputPath"),
		error: text("error"),
		fps: integer("fps").notNull().default(30),
		quality: text("quality").notNull().default("standard"),
		createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
		startedAt: integer("startedAt", { mode: "timestamp" }),
		finishedAt: integer("finishedAt", { mode: "timestamp" }),
		publicShareSlug: text("publicShareSlug"),
	},
	(table) => ({
		// Worker poll: WHERE userId=? AND status='queued' ORDER BY createdAt
		userStatusCreatedIdx: index("renderJobs_user_status_created_idx").on(
			table.userId,
			table.status,
			table.createdAt,
		),
		// Share lookups: WHERE publicShareSlug=?
		shareSlugIdx: index("renderJobs_share_slug_idx").on(
			table.publicShareSlug,
		),
		// Project list join: WHERE userId=? AND projectId=? AND status='done'
		userProjectStatusIdx: index("renderJobs_user_project_status_idx").on(
			table.userId,
			table.projectId,
			table.status,
		),
	}),
);

export const userPreferences = sqliteTable("userPreferences", {
	userId: text("userId")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	niche: text("niche"),
	formatPreference: text("formatPreference"),
	postFrequency: text("postFrequency"),
	onboardingCompleted: integer("onboardingCompleted", { mode: "boolean" })
		.notNull()
		.default(false),
	tourCompleted: integer("tourCompleted", { mode: "boolean" })
		.notNull()
		.default(false),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const brandKits = sqliteTable("brandKits", {
	userId: text("userId")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	logoPath: text("logoPath"),
	primaryColor: text("primaryColor"),
	accentColor: text("accentColor"),
	fontFamily: text("fontFamily"),
	watermarkPath: text("watermarkPath"),
	channelName: text("channelName"),
	// Host identity — short text the agent uses to keep the on-screen
	// presenter (illustration / archetype) consistent across scenes & projects.
	hostName: text("hostName"),
	hostDescription: text("hostDescription"),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const workerTokens = sqliteTable("workerTokens", {
	token: text("token").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	name: text("name").notNull().default("default"),
	lastSeenAt: integer("lastSeenAt", { mode: "timestamp" }),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	revokedAt: integer("revokedAt", { mode: "timestamp" }),
});

export const waitlistSignups = sqliteTable("waitlistSignups", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	referrer: text("referrer"),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export const bugReports = sqliteTable("bugReports", {
	id: text("id").primaryKey(),
	userId: text("userId").references(() => user.id, { onDelete: "set null" }),
	url: text("url").notNull(),
	description: text("description").notNull(),
	userAgent: text("userAgent"),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export const snippets = sqliteTable("snippets", {
	id: text("id").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	sourceProjectId: text("sourceProjectId"),
	label: text("label").notNull(),
	html: text("html").notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export const affiliateClicks = sqliteTable("affiliateClicks", {
	id: text("id").primaryKey(),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	visitorIp: text("visitorIp"),
	userAgent: text("userAgent"),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
	id: text("id").primaryKey(),
	userId: text("userId")
		.notNull()
		.unique()
		.references(() => user.id, { onDelete: "cascade" }),
	stripeCustomerId: text("stripeCustomerId"),
	stripeSubscriptionId: text("stripeSubscriptionId"),
	// Polar.sh equivalents — added when we migrated from Stripe. The Stripe
	// fields stay so any pre-existing rows aren't lost during the cutover.
	polarCustomerId: text("polarCustomerId"),
	polarSubscriptionId: text("polarSubscriptionId"),
	plan: text("plan").notNull().default("free"),
	status: text("status").notNull().default("active"),
	trialEndsAt: integer("trialEndsAt", { mode: "timestamp" }),
	currentPeriodEnd: integer("currentPeriodEnd", { mode: "timestamp" }),
	cancelAtPeriodEnd: integer("cancelAtPeriodEnd", { mode: "boolean" })
		.notNull()
		.default(false),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const usageEvents = sqliteTable(
	"usageEvents",
	{
		id: text("id").primaryKey(),
		userId: text("userId")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		kind: text("kind").notNull(),
		amount: integer("amount").notNull().default(1),
		meta: text("meta"),
		createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		// Usage cap checks: WHERE userId=? AND kind=? AND createdAt >= ?
		userKindCreatedIdx: index("usageEvents_user_kind_created_idx").on(
			table.userId,
			table.kind,
			table.createdAt,
		),
	}),
);

export const errorLog = sqliteTable(
	"errorLog",
	{
		id: text("id").primaryKey(),
		source: text("source").notNull(),
		message: text("message").notNull(),
		stack: text("stack"),
		context: text("context"),
		createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		createdIdx: index("errorLog_created_idx").on(table.createdAt),
	}),
);

// Stripe webhook deduplication. Insert event.id before applying; the unique
// constraint ensures a retried delivery becomes a no-op.
export const processedWebhooks = sqliteTable("processedWebhooks", {
	eventId: text("eventId").primaryKey(),
	source: text("source").notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export type Project = typeof projects.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type RenderJob = typeof renderJobs.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type UserPreference = typeof userPreferences.$inferSelect;
export type BrandKit = typeof brandKits.$inferSelect;
export type WorkerToken = typeof workerTokens.$inferSelect;
export type WaitlistSignup = typeof waitlistSignups.$inferSelect;
export type AffiliateClick = typeof affiliateClicks.$inferSelect;
export type Snippet = typeof snippets.$inferSelect;
export type BugReport = typeof bugReports.$inferSelect;
