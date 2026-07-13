CREATE TABLE `extensionTokens` (
	`token` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text DEFAULT 'browser extension' NOT NULL,
	`lastSeenAt` integer,
	`createdAt` integer NOT NULL,
	`revokedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `references` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`kind` text DEFAULT 'clip' NOT NULL,
	`sourceUrl` text,
	`title` text NOT NULL,
	`uploader` text,
	`thumbFile` text,
	`clipFile` text,
	`durationSeconds` real,
	`rightsBasis` text DEFAULT 'reference-only' NOT NULL,
	`notes` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `references_user_created_idx` ON `references` (`userId`,`createdAt`);