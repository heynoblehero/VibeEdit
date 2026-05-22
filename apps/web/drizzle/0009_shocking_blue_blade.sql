CREATE INDEX `messages_project_created_idx` ON `messages` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `renderJobs_user_status_created_idx` ON `renderJobs` (`userId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `renderJobs_share_slug_idx` ON `renderJobs` (`publicShareSlug`);--> statement-breakpoint
CREATE INDEX `renderJobs_user_project_status_idx` ON `renderJobs` (`userId`,`projectId`,`status`);--> statement-breakpoint
CREATE INDEX `usageEvents_user_kind_created_idx` ON `usageEvents` (`userId`,`kind`,`createdAt`);