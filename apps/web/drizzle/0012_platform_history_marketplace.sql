CREATE TABLE `creatorInsights` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`confidence` real DEFAULT 0.5 NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `creatorInsights_user_key_idx` ON `creatorInsights` (`userId`,`key`);--> statement-breakpoint
CREATE TABLE `projectSnapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`userId` text NOT NULL,
	`renderJobId` text,
	`html` text NOT NULL,
	`label` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `projectSnapshots_project_created_idx` ON `projectSnapshots` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `publishConnections` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`platform` text NOT NULL,
	`platformAccountId` text,
	`platformAccountName` text,
	`accessTokenEnc` text NOT NULL,
	`refreshTokenEnc` text,
	`expiresAt` integer,
	`scope` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `publishConnections_user_platform_idx` ON `publishConnections` (`userId`,`platform`);--> statement-breakpoint
CREATE TABLE `snippetLikes` (
	`userId` text NOT NULL,
	`snippetId` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`snippetId`) REFERENCES `snippets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `snippetLikes_pk_idx` ON `snippetLikes` (`userId`,`snippetId`);--> statement-breakpoint
ALTER TABLE `projects` ADD `platform` text DEFAULT 'youtube' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `aspectRatio` text DEFAULT '16:9' NOT NULL;--> statement-breakpoint
ALTER TABLE `renderJobs` ADD `durationSeconds` integer;--> statement-breakpoint
ALTER TABLE `snippets` ADD `isPublic` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `snippets` ADD `description` text;--> statement-breakpoint
ALTER TABLE `snippets` ADD `likesCount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `snippets` ADD `platform` text;--> statement-breakpoint
ALTER TABLE `snippets` ADD `aspectRatio` text;