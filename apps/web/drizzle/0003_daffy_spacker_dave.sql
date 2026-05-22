CREATE TABLE `affiliateClicks` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`visitorIp` text,
	`userAgent` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `brandKits` (
	`userId` text PRIMARY KEY NOT NULL,
	`logoPath` text,
	`primaryColor` text,
	`accentColor` text,
	`fontFamily` text,
	`watermarkPath` text,
	`channelName` text,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `waitlistSignups` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`referrer` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `waitlistSignups_email_unique` ON `waitlistSignups` (`email`);