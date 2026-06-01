ALTER TABLE `renderJobs` ADD `priority` integer NOT NULL DEFAULT 0;--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`ownerId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workspaceMembers` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`userId` text,
	`role` text NOT NULL DEFAULT 'editor',
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
ALTER TABLE `projects` ADD `workspaceId` text REFERENCES workspaces(id);--> statement-breakpoint
CREATE TABLE `scheduledPublishes` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`projectId` text NOT NULL,
	`renderJobId` text,
	`platform` text NOT NULL,
	`title` text,
	`description` text,
	`scheduledAt` integer NOT NULL,
	`status` text NOT NULL DEFAULT 'pending',
	`publishedAt` integer,
	`error` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scheduledPublishes_user_status_idx` ON `scheduledPublishes` (`userId`, `status`);--> statement-breakpoint
CREATE INDEX `scheduledPublishes_due_idx` ON `scheduledPublishes` (`status`, `scheduledAt`);
