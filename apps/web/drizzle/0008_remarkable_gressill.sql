CREATE TABLE `bugReports` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text,
	`url` text NOT NULL,
	`description` text NOT NULL,
	`userAgent` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
