CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`school_id` text,
	`student_no` text,
	`avatar_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`last_login_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `schools` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text DEFAULT '' NOT NULL,
	`name` text NOT NULL,
	`region` text NOT NULL,
	`contact_name` text,
	`contact_phone` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schools_code_unique` ON `schools` (`code`);--> statement-breakpoint
CREATE TABLE `class_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`code` text DEFAULT '' NOT NULL,
	`name` text NOT NULL,
	`grade` text NOT NULL,
	`teacher_id` text,
	`academic_year` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `essay_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`created_by` text NOT NULL,
	`title` text NOT NULL,
	`topic_type` text NOT NULL,
	`topic_category` text,
	`requirements` text NOT NULL,
	`key_points` text DEFAULT '[]',
	`reference_essay` text,
	`word_limit_min` integer DEFAULT 80 NOT NULL,
	`word_limit_max` integer DEFAULT 125 NOT NULL,
	`time_limit_minutes` integer DEFAULT 15,
	`status` text DEFAULT 'draft' NOT NULL,
	`due_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `essays` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text,
	`student_id` text NOT NULL,
	`title` text,
	`content` text NOT NULL,
	`word_count` integer NOT NULL,
	`submit_type` text DEFAULT 'typed' NOT NULL,
	`ocr_image_url` text,
	`ocr_confidence` real,
	`handwriting_score` real,
	`handwriting_details` text DEFAULT '{}',
	`status` text DEFAULT 'pending' NOT NULL,
	`total_score` real,
	`score_tier` text,
	`correction_id` text,
	`teacher_review` text,
	`teacher_score` real,
	`submitted_at` text NOT NULL,
	`corrected_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`essay_id` text NOT NULL,
	`content_score` real,
	`language_score` real,
	`structure_score` real,
	`presentation_score` real,
	`total_score` real,
	`score_tier` text,
	`errors` text DEFAULT '[]',
	`error_stats` text DEFAULT '{}',
	`highlights` text DEFAULT '[]',
	`sentence_analysis` text DEFAULT '[]',
	`revised_essay` text,
	`suggestions` text DEFAULT '[]',
	`ai_provider` text,
	`ai_model` text,
	`correction_time_ms` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`essay_id`) REFERENCES `essays`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_call_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`model` text,
	`endpoint` text,
	`tokens_used` integer,
	`latency_ms` integer,
	`cost` real,
	`status` text,
	`error_message` text,
	`essay_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `api_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`api_key_encrypted` text NOT NULL,
	`base_url` text,
	`model` text,
	`is_active` integer DEFAULT true NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`max_tokens` integer DEFAULT 4096,
	`temperature` real DEFAULT 0.3,
	`rate_limit_per_min` integer DEFAULT 60,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
