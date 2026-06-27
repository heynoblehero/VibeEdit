CREATE TABLE `supportMessages` (
	`id` text PRIMARY KEY NOT NULL,
	`threadId` text NOT NULL,
	`sender` text NOT NULL,
	`body` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`threadId`) REFERENCES `supportThreads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `supportMessages_thread_created_idx` ON `supportMessages` (`threadId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `supportThreads` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`subject` text,
	`status` text DEFAULT 'open' NOT NULL,
	`unreadForAdmin` integer DEFAULT false NOT NULL,
	`unreadForUser` integer DEFAULT false NOT NULL,
	`lastMessageAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `supportThreads_user_last_message_idx` ON `supportThreads` (`userId`,`lastMessageAt`);--> statement-breakpoint
CREATE INDEX `supportThreads_status_last_message_idx` ON `supportThreads` (`status`,`lastMessageAt`);--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `bannedReason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `bannedAt` integer;