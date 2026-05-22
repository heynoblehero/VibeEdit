CREATE TABLE `workerTokens` (
	`token` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text DEFAULT 'default' NOT NULL,
	`lastSeenAt` integer,
	`createdAt` integer NOT NULL,
	`revokedAt` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
