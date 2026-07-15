CREATE TABLE `teaching_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`topic_type` text,
	`difficulty` text DEFAULT 'medium' NOT NULL,
	`content` text NOT NULL,
	`highlights` text DEFAULT '',
	`tags` text DEFAULT '[]',
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `student_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`tag` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_tags_student_id_unique` ON `student_tags` (`student_id`);