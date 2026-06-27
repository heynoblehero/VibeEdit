CREATE TABLE `renderReviews` (
	`id` text PRIMARY KEY NOT NULL,
	`renderJobId` text NOT NULL,
	`userId` text NOT NULL,
	`timestampSeconds` real NOT NULL,
	`text` text NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`renderJobId`) REFERENCES `renderJobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `renderReviews_render_job_idx` ON `renderReviews` (`renderJobId`);--> statement-breakpoint
CREATE TABLE `scheduledPublishes` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`projectId` text NOT NULL,
	`renderJobId` text,
	`platform` text NOT NULL,
	`title` text,
	`description` text,
	`scheduledAt` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`publishedAt` integer,
	`error` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scheduledPublishes_user_status_idx` ON `scheduledPublishes` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `scheduledPublishes_due_idx` ON `scheduledPublishes` (`status`,`scheduledAt`);--> statement-breakpoint
CREATE TABLE `videoAnalytics` (
	`id` text PRIMARY KEY NOT NULL,
	`renderJobId` text NOT NULL,
	`userId` text NOT NULL,
	`platform` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`comments` integer DEFAULT 0 NOT NULL,
	`watchTimeSeconds` integer DEFAULT 0 NOT NULL,
	`ctr` real,
	`avgViewDurationSeconds` real,
	`fetchedAt` integer NOT NULL,
	FOREIGN KEY (`renderJobId`) REFERENCES `renderJobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `videoAnalytics_user_platform_idx` ON `videoAnalytics` (`userId`,`platform`);--> statement-breakpoint
CREATE INDEX `videoAnalytics_render_job_idx` ON `videoAnalytics` (`renderJobId`);--> statement-breakpoint
CREATE TABLE `workspaceMembers` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`userId` text,
	`role` text DEFAULT 'editor' NOT NULL,
	`inviteEmail` text NOT NULL,
	`inviteToken` text,
	`joinedAt` integer,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workspaceMembers_workspace_idx` ON `workspaceMembers` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `workspaceMembers_invite_token_idx` ON `workspaceMembers` (`inviteToken`);--> statement-breakpoint
CREATE INDEX `workspaceMembers_user_idx` ON `workspaceMembers` (`userId`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`ownerId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `brandKits` ADD `voiceId` text;--> statement-breakpoint
ALTER TABLE `brandKits` ADD `voiceSamplePath` text;--> statement-breakpoint
ALTER TABLE `projectSnapshots` ADD `messageId` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `workspaceId` text;--> statement-breakpoint
ALTER TABLE `renderJobs` ADD `attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `renderJobs` ADD `lastError` text;--> statement-breakpoint
ALTER TABLE `renderJobs` ADD `priority` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `renderJobs` ADD `showcased` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `renderCredits` integer DEFAULT 0 NOT NULL;