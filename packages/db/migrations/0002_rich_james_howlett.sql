CREATE TABLE `error_books` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`essay_id` text,
	`correction_id` text,
	`error_type` text NOT NULL,
	`original` text NOT NULL,
	`corrected` text NOT NULL,
	`explanation` text,
	`position` text DEFAULT '{}',
	`status` text DEFAULT 'unresolved' NOT NULL,
	`practice_count` integer DEFAULT 0,
	`mastered_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`essay_id`) REFERENCES `essays`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`correction_id`) REFERENCES `corrections`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `question_bank` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_type` text NOT NULL,
	`topic_category` text,
	`title` text NOT NULL,
	`requirements` text NOT NULL,
	`key_points` text DEFAULT '[]',
	`reference_essay` text,
	`word_limit_min` integer DEFAULT 80 NOT NULL,
	`word_limit_max` integer DEFAULT 125 NOT NULL,
	`time_limit_minutes` integer DEFAULT 15,
	`difficulty` text DEFAULT 'medium',
	`source` text,
	`is_public` integer DEFAULT 1,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `practice_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`exercise_type` text NOT NULL,
	`question_id` text,
	`topic_type` text,
	`title` text,
	`content` text NOT NULL,
	`word_count` integer,
	`score` real,
	`score_tier` text,
	`ai_feedback` text DEFAULT '{}',
	`duration_ms` integer,
	`status` text DEFAULT 'completed' NOT NULL,
	`started_at` text,
	`submitted_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`question_id`) REFERENCES `question_bank`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ai_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`mode` text NOT NULL,
	`input_text` text NOT NULL,
	`output_text` text NOT NULL,
	`metadata` text DEFAULT '{}',
	`ai_provider` text,
	`ai_model` text,
	`tokens_used` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `achievements` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`code` text NOT NULL,
	`tier` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`icon` text,
	`earned_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `achievements_student_code_idx` ON `achievements` (`student_id`,`code`);--> statement-breakpoint
CREATE TABLE `essay_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`task_id` text NOT NULL,
	`content` text NOT NULL,
	`word_count` integer,
	`duration_ms` integer,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `essay_drafts_student_task_idx` ON `essay_drafts` (`student_id`,`task_id`);