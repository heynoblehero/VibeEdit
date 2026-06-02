CREATE TABLE `renderReviews` (
	`id` text PRIMARY KEY NOT NULL,
	`renderJobId` text NOT NULL REFERENCES `renderJobs`(`id`) ON DELETE CASCADE,
	`userId` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`timestampSeconds` real NOT NULL,
	`text` text NOT NULL,
	`resolved` integer NOT NULL DEFAULT 0,
	`createdAt` integer NOT NULL
);

CREATE INDEX `renderReviews_render_job_idx` ON `renderReviews` (`renderJobId`);

CREATE TABLE `videoAnalytics` (
	`id` text PRIMARY KEY NOT NULL,
	`renderJobId` text NOT NULL REFERENCES `renderJobs`(`id`) ON DELETE CASCADE,
	`userId` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`platform` text NOT NULL,
	`views` integer NOT NULL DEFAULT 0,
	`likes` integer NOT NULL DEFAULT 0,
	`comments` integer NOT NULL DEFAULT 0,
	`watchTimeSeconds` integer NOT NULL DEFAULT 0,
	`ctr` real,
	`avgViewDurationSeconds` real,
	`fetchedAt` integer NOT NULL
);

CREATE INDEX `videoAnalytics_user_platform_idx` ON `videoAnalytics` (`userId`, `platform`);
CREATE INDEX `videoAnalytics_render_job_idx` ON `videoAnalytics` (`renderJobId`);

ALTER TABLE `subscriptions` ADD `renderCredits` integer NOT NULL DEFAULT 0;
