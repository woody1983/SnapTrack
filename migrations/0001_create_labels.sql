CREATE TABLE `labels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tracking_number` text NOT NULL,
	`carrier` text NOT NULL,
	`ship_from_address` text,
	`ship_to_address` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `labels_tracking_number_unique` ON `labels` (`tracking_number`);