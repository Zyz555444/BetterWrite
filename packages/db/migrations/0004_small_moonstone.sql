CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`target_role` text DEFAULT 'all',
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
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
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "password_hash", "name", "role", "school_id", "student_no", "avatar_url", "is_active", "last_login_at", "created_at", "updated_at") SELECT "id", "email", "password_hash", "name", "role", "school_id", "student_no", "avatar_url", "is_active", "last_login_at", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "user_id", "expires_at") SELECT "id", "user_id", "expires_at" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
CREATE TABLE `__new_essay_tasks` (
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
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_essay_tasks`("id", "class_id", "created_by", "title", "topic_type", "topic_category", "requirements", "key_points", "reference_essay", "word_limit_min", "word_limit_max", "time_limit_minutes", "status", "due_date", "created_at", "updated_at") SELECT "id", "class_id", "created_by", "title", "topic_type", "topic_category", "requirements", "key_points", "reference_essay", "word_limit_min", "word_limit_max", "time_limit_minutes", "status", "due_date", "created_at", "updated_at" FROM `essay_tasks`;--> statement-breakpoint
DROP TABLE `essay_tasks`;--> statement-breakpoint
ALTER TABLE `__new_essay_tasks` RENAME TO `essay_tasks`;--> statement-breakpoint
CREATE INDEX `essay_tasks_class_idx` ON `essay_tasks` (`class_id`);--> statement-breakpoint
CREATE INDEX `essay_tasks_status_idx` ON `essay_tasks` (`status`);--> statement-breakpoint
CREATE TABLE `__new_essays` (
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
	FOREIGN KEY (`task_id`) REFERENCES `essay_tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_essays`("id", "task_id", "student_id", "title", "content", "word_count", "submit_type", "ocr_image_url", "ocr_confidence", "handwriting_score", "handwriting_details", "status", "total_score", "score_tier", "correction_id", "teacher_review", "teacher_score", "submitted_at", "corrected_at", "created_at", "updated_at") SELECT "id", "task_id", "student_id", "title", "content", "word_count", "submit_type", "ocr_image_url", "ocr_confidence", "handwriting_score", "handwriting_details", "status", "total_score", "score_tier", "correction_id", "teacher_review", "teacher_score", "submitted_at", "corrected_at", "created_at", "updated_at" FROM `essays`;--> statement-breakpoint
DROP TABLE `essays`;--> statement-breakpoint
ALTER TABLE `__new_essays` RENAME TO `essays`;--> statement-breakpoint
CREATE INDEX `essays_student_idx` ON `essays` (`student_id`);--> statement-breakpoint
CREATE INDEX `essays_task_idx` ON `essays` (`task_id`);--> statement-breakpoint
CREATE INDEX `essays_status_idx` ON `essays` (`status`);--> statement-breakpoint
CREATE INDEX `essays_score_tier_idx` ON `essays` (`score_tier`);--> statement-breakpoint
CREATE TABLE `__new_teaching_resources` (
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
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_teaching_resources`("id", "type", "title", "topic_type", "difficulty", "content", "highlights", "tags", "created_by", "created_at", "updated_at") SELECT "id", "type", "title", "topic_type", "difficulty", "content", "highlights", "tags", "created_by", "created_at", "updated_at" FROM `teaching_resources`;--> statement-breakpoint
DROP TABLE `teaching_resources`;--> statement-breakpoint
ALTER TABLE `__new_teaching_resources` RENAME TO `teaching_resources`;--> statement-breakpoint
CREATE TABLE `__new_student_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`tag` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_student_tags`("id", "student_id", "tag", "updated_by", "updated_at") SELECT "id", "student_id", "tag", "updated_by", "updated_at" FROM `student_tags`;--> statement-breakpoint
DROP TABLE `student_tags`;--> statement-breakpoint
ALTER TABLE `__new_student_tags` RENAME TO `student_tags`;--> statement-breakpoint
CREATE UNIQUE INDEX `student_tags_student_id_unique` ON `student_tags` (`student_id`);--> statement-breakpoint
CREATE TABLE `__new_error_books` (
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
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`essay_id`) REFERENCES `essays`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`correction_id`) REFERENCES `corrections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_error_books`("id", "student_id", "essay_id", "correction_id", "error_type", "original", "corrected", "explanation", "position", "status", "practice_count", "mastered_at", "created_at", "updated_at") SELECT "id", "student_id", "essay_id", "correction_id", "error_type", "original", "corrected", "explanation", "position", "status", "practice_count", "mastered_at", "created_at", "updated_at" FROM `error_books`;--> statement-breakpoint
DROP TABLE `error_books`;--> statement-breakpoint
ALTER TABLE `__new_error_books` RENAME TO `error_books`;--> statement-breakpoint
CREATE INDEX `error_books_student_idx` ON `error_books` (`student_id`);--> statement-breakpoint
CREATE INDEX `error_books_essay_idx` ON `error_books` (`essay_id`);--> statement-breakpoint
CREATE TABLE `__new_practice_exercises` (
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
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `question_bank`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_practice_exercises`("id", "student_id", "exercise_type", "question_id", "topic_type", "title", "content", "word_count", "score", "score_tier", "ai_feedback", "duration_ms", "status", "started_at", "submitted_at", "created_at") SELECT "id", "student_id", "exercise_type", "question_id", "topic_type", "title", "content", "word_count", "score", "score_tier", "ai_feedback", "duration_ms", "status", "started_at", "submitted_at", "created_at" FROM `practice_exercises`;--> statement-breakpoint
DROP TABLE `practice_exercises`;--> statement-breakpoint
ALTER TABLE `__new_practice_exercises` RENAME TO `practice_exercises`;--> statement-breakpoint
CREATE INDEX `practice_exercises_student_idx` ON `practice_exercises` (`student_id`);--> statement-breakpoint
CREATE TABLE `__new_ai_conversations` (
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
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_ai_conversations`("id", "student_id", "mode", "input_text", "output_text", "metadata", "ai_provider", "ai_model", "tokens_used", "created_at") SELECT "id", "student_id", "mode", "input_text", "output_text", "metadata", "ai_provider", "ai_model", "tokens_used", "created_at" FROM `ai_conversations`;--> statement-breakpoint
DROP TABLE `ai_conversations`;--> statement-breakpoint
ALTER TABLE `__new_ai_conversations` RENAME TO `ai_conversations`;--> statement-breakpoint
CREATE INDEX `ai_conversations_student_idx` ON `ai_conversations` (`student_id`);--> statement-breakpoint
CREATE TABLE `__new_achievements` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`code` text NOT NULL,
	`tier` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`icon` text,
	`earned_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_achievements`("id", "student_id", "code", "tier", "title", "description", "icon", "earned_at", "created_at") SELECT "id", "student_id", "code", "tier", "title", "description", "icon", "earned_at", "created_at" FROM `achievements`;--> statement-breakpoint
DROP TABLE `achievements`;--> statement-breakpoint
ALTER TABLE `__new_achievements` RENAME TO `achievements`;--> statement-breakpoint
CREATE UNIQUE INDEX `achievements_student_code_idx` ON `achievements` (`student_id`,`code`);--> statement-breakpoint
CREATE TABLE `__new_essay_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`task_id` text NOT NULL,
	`content` text NOT NULL,
	`word_count` integer,
	`duration_ms` integer,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `essay_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_essay_drafts`("id", "student_id", "task_id", "content", "word_count", "duration_ms", "updated_at") SELECT "id", "student_id", "task_id", "content", "word_count", "duration_ms", "updated_at" FROM `essay_drafts`;--> statement-breakpoint
DROP TABLE `essay_drafts`;--> statement-breakpoint
ALTER TABLE `__new_essay_drafts` RENAME TO `essay_drafts`;--> statement-breakpoint
CREATE UNIQUE INDEX `essay_drafts_student_task_idx` ON `essay_drafts` (`student_id`,`task_id`);--> statement-breakpoint
CREATE TABLE `__new_api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`platform` text NOT NULL,
	`device_name` text,
	`expires_at` text NOT NULL,
	`last_used_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_api_tokens`("id", "user_id", "token", "platform", "device_name", "expires_at", "last_used_at", "created_at") SELECT "id", "user_id", "token", "platform", "device_name", "expires_at", "last_used_at", "created_at" FROM `api_tokens`;--> statement-breakpoint
DROP TABLE `api_tokens`;--> statement-breakpoint
ALTER TABLE `__new_api_tokens` RENAME TO `api_tokens`;--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_idx` ON `api_tokens` (`token`);--> statement-breakpoint
CREATE TABLE `__new_device_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`platform` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_device_tokens`("id", "user_id", "token", "platform", "created_at", "updated_at") SELECT "id", "user_id", "token", "platform", "created_at", "updated_at" FROM `device_tokens`;--> statement-breakpoint
DROP TABLE `device_tokens`;--> statement-breakpoint
ALTER TABLE `__new_device_tokens` RENAME TO `device_tokens`;--> statement-breakpoint
CREATE UNIQUE INDEX `device_tokens_user_token_idx` ON `device_tokens` (`user_id`,`token`);--> statement-breakpoint
CREATE INDEX `api_call_logs_created_idx` ON `api_call_logs` (`created_at`);--> statement-breakpoint
ALTER TABLE `api_call_logs` ALTER COLUMN "essay_id" TO "essay_id" text REFERENCES essays(id) ON DELETE set null ON UPDATE no action;