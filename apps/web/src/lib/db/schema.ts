import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

// Better-Auth required tables ----------------------------------------------

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
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
  // Optional workspace this project belongs to.
  workspaceId: text("workspaceId"),
  // Platform and aspect ratio tell the agent which format to target from the
  // first message. Stored here so every session for this project is consistent.
  platform: text("platform").notNull().default("youtube"),
  aspectRatio: text("aspectRatio").notNull().default("16:9"),
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
    projectCreatedIdx: index("messages_project_created_idx").on(table.projectId, table.createdAt),
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
    // Higher = processed sooner. 0=free, 1=creator, 2=studio.
    // Paid jobs are sorted before free jobs in the pending queue.
    priority: integer("priority").notNull().default(0),
    // Wall-clock seconds from startedAt to finishedAt. Populated on completion.
    // Used for render-minutes billing metering.
    durationSeconds: integer("durationSeconds"),
    // User opted this render into the public /showcase gallery.
    // Requires publicShareSlug to be set (showcase toggle auto-creates it).
    showcased: integer("showcased", { mode: "boolean" }).notNull().default(false),
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
    shareSlugIdx: index("renderJobs_share_slug_idx").on(table.publicShareSlug),
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
  onboardingCompleted: integer("onboardingCompleted", { mode: "boolean" }).notNull().default(false),
  tourCompleted: integer("tourCompleted", { mode: "boolean" }).notNull().default(false),
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
  // Voice and audience context injected into every composition system prompt.
  toneVoice: text("toneVoice"),
  targetAudience: text("targetAudience"),
  // Cloned ElevenLabs voice — created via POST /api/brand-kit/voice.
  // Stored so every generate_voiceover call uses the user's own voice automatically.
  voiceId: text("voiceId"),
  voiceSamplePath: text("voiceSamplePath"),
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
  // Marketplace fields — null = private, true = public gallery listing.
  isPublic: integer("isPublic", { mode: "boolean" }).notNull().default(false),
  description: text("description"),
  likesCount: integer("likesCount").notNull().default(0),
  platform: text("platform"),
  aspectRatio: text("aspectRatio"),
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
  cancelAtPeriodEnd: integer("cancelAtPeriodEnd", { mode: "boolean" }).notNull().default(false),
  // Pay-per-render credits — each credit unlocks one 1080p render outside the plan limit.
  renderCredits: integer("renderCredits").notNull().default(0),
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

// Taste memory per creator — agent saves learned preferences here and reads
// them back at the start of each conversation to personalize edits.
export const creatorInsights = sqliteTable(
  "creatorInsights",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Stable slug, e.g. "caption_style", "color_grade_preference", "pacing"
    key: text("key").notNull(),
    // JSON value — string, number, array, or object
    value: text("value").notNull(),
    // 0-1; agent bumps confidence each time the insight is confirmed
    confidence: real("confidence").notNull().default(0.5),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    // load_insights query: WHERE userId=? — also uniqueness for upsert
    userKeyIdx: index("creatorInsights_user_key_idx").on(table.userId, table.key),
  }),
);

// Composition snapshots captured at each render — enables version history and
// one-click rollback. html is the full index.html at time of capture.
export const projectSnapshots = sqliteTable(
  "projectSnapshots",
  {
    id: text("id").primaryKey(),
    projectId: text("projectId")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // The render job that triggered this snapshot, if any.
    renderJobId: text("renderJobId"),
    // Full index.html at time of snapshot.
    html: text("html").notNull(),
    // Optional human label (e.g. "before color grade change").
    label: text("label"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    projectCreatedIdx: index("projectSnapshots_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  }),
);

// OAuth connections for platform publishing (YouTube, TikTok, Instagram).
export const publishConnections = sqliteTable(
  "publishConnections",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // "youtube" | "tiktok" | "instagram"
    platform: text("platform").notNull(),
    // Platform's user/channel identifier (for display).
    platformAccountId: text("platformAccountId"),
    platformAccountName: text("platformAccountName"),
    // Encrypted OAuth tokens — never logged. Encryption key = PUBLISH_TOKEN_SECRET env var.
    accessTokenEnc: text("accessTokenEnc").notNull(),
    refreshTokenEnc: text("refreshTokenEnc"),
    expiresAt: integer("expiresAt", { mode: "timestamp" }),
    scope: text("scope"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    // One connection per user per platform.
    userPlatformIdx: index("publishConnections_user_platform_idx").on(table.userId, table.platform),
  }),
);

// Workspaces — shared project buckets with role-based access.
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("ownerId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const workspaceMembers = sqliteTable(
  "workspaceMembers",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("userId").references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("editor"), // "owner" | "editor" | "viewer"
    inviteEmail: text("inviteEmail").notNull(),
    // Null once the invite is accepted.
    inviteToken: text("inviteToken"),
    joinedAt: integer("joinedAt", { mode: "timestamp" }),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    workspaceIdx: index("workspaceMembers_workspace_idx").on(table.workspaceId),
    inviteTokenIdx: index("workspaceMembers_invite_token_idx").on(table.inviteToken),
    userIdx: index("workspaceMembers_user_idx").on(table.userId),
  }),
);

// Scheduled social publishes — queued by the user, processed by background worker.
export const scheduledPublishes = sqliteTable(
  "scheduledPublishes",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("projectId")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // The render job whose output.mp4 will be uploaded. Null until the render completes.
    renderJobId: text("renderJobId"),
    platform: text("platform").notNull(), // "youtube" | "tiktok" | "instagram"
    title: text("title"),
    description: text("description"),
    scheduledAt: integer("scheduledAt", { mode: "timestamp" }).notNull(),
    // "pending" | "published" | "failed" | "cancelled"
    status: text("status").notNull().default("pending"),
    publishedAt: integer("publishedAt", { mode: "timestamp" }),
    error: text("error"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    userStatusIdx: index("scheduledPublishes_user_status_idx").on(table.userId, table.status),
    dueIdx: index("scheduledPublishes_due_idx").on(table.status, table.scheduledAt),
  }),
);

// Snippet likes — one row per (userId, snippetId) pair.
export const snippetLikes = sqliteTable(
  "snippetLikes",
  {
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    snippetId: text("snippetId")
      .notNull()
      .references(() => snippets.id, { onDelete: "cascade" }),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    pk: index("snippetLikes_pk_idx").on(table.userId, table.snippetId),
  }),
);

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
export type CreatorInsight = typeof creatorInsights.$inferSelect;
export type ProjectSnapshot = typeof projectSnapshots.$inferSelect;
export type PublishConnection = typeof publishConnections.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type ScheduledPublish = typeof scheduledPublishes.$inferSelect;

// Timestamped review comments left by workspace collaborators on rendered videos.
// Stored per render job so any team member can annotate "at 0:14 change the CTA".
export const renderReviews = sqliteTable(
  "renderReviews",
  {
    id: text("id").primaryKey(),
    renderJobId: text("renderJobId")
      .notNull()
      .references(() => renderJobs.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Position in the video where the comment applies.
    timestampSeconds: real("timestampSeconds").notNull(),
    text: text("text").notNull(),
    resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    renderJobIdx: index("renderReviews_render_job_idx").on(table.renderJobId),
  }),
);

// Analytics pulled periodically from YouTube/TikTok after publishing.
// Used by the agent's creator-insights feedback loop.
export const videoAnalytics = sqliteTable(
  "videoAnalytics",
  {
    id: text("id").primaryKey(),
    renderJobId: text("renderJobId")
      .notNull()
      .references(() => renderJobs.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(), // "youtube" | "tiktok"
    views: integer("views").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    watchTimeSeconds: integer("watchTimeSeconds").notNull().default(0),
    // Click-through rate 0–1
    ctr: real("ctr"),
    avgViewDurationSeconds: real("avgViewDurationSeconds"),
    fetchedAt: integer("fetchedAt", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    userPlatformIdx: index("videoAnalytics_user_platform_idx").on(table.userId, table.platform),
    renderJobIdx: index("videoAnalytics_render_job_idx").on(table.renderJobId),
  }),
);

export type RenderReview = typeof renderReviews.$inferSelect;
export type VideoAnalytics = typeof videoAnalytics.$inferSelect;
