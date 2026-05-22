CREATE TABLE `snippets` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`sourceProjectId` text,
	`label` text NOT NULL,
	`html` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
