CREATE TABLE `errorLog` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`message` text NOT NULL,
	`stack` text,
	`context` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `errorLog_created_idx` ON `errorLog` (`createdAt`);--> statement-breakpoint
CREATE TABLE `processedWebhooks` (
	`eventId` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`createdAt` integer NOT NULL
);
