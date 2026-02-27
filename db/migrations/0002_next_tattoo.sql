CREATE TABLE `pinned_trackings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role` text NOT NULL,
	`tracking_number` text NOT NULL,
	`carrier` text NOT NULL,
	`pinned_at` integer,
	`last_refreshed_at` integer
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role` text NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_role_unique` ON `users` (`role`);