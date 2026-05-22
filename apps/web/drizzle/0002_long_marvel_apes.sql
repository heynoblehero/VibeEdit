CREATE TABLE `userPreferences` (
	`userId` text PRIMARY KEY NOT NULL,
	`niche` text,
	`formatPreference` text,
	`postFrequency` text,
	`onboardingCompleted` integer DEFAULT false NOT NULL,
	`tourCompleted` integer DEFAULT false NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
