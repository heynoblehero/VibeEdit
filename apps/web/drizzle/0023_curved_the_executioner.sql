CREATE TABLE `platformSettings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `providerCredentials` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`kind` text DEFAULT 'key' NOT NULL,
	`label` text,
	`secretEnc` text NOT NULL,
	`endpoint` text,
	`last4` text,
	`enabled` integer DEFAULT true NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`usageCount` integer DEFAULT 0 NOT NULL,
	`lastUsedAt` integer,
	`disabledReason` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `providerCredentials_provider_idx` ON `providerCredentials` (`provider`);