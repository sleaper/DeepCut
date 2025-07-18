CREATE TABLE `clips` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`llm_reason` text NOT NULL,
	`proposed_title` text NOT NULL,
	`summary` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`final_clip_path` text,
	`thumbnail_path` text,
	`srt` text,
	`deepgram_response` text,
	`error_message` text,
	`post_url` text,
	`post_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`video_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`clip_id` text NOT NULL,
	`platform` text NOT NULL,
	`post_url` text,
	`views` integer DEFAULT 0,
	`likes` integer DEFAULT 0,
	`last_checked_at` text DEFAULT (current_timestamp) NOT NULL,
	`content` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`clip_id`) REFERENCES `clips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`video_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`channel_name` text NOT NULL,
	`youtube_channel_id` text NOT NULL,
	`published_at` integer NOT NULL,
	`context` text DEFAULT '' NOT NULL,
	`transcript` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
