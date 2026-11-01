CREATE TABLE `coop_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `coop_monitors` (
	`user_id` text PRIMARY KEY NOT NULL,
	`config` text NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	`last_run` integer,
	`last_error` text,
	`last_weather` text
);
--> statement-breakpoint
CREATE TABLE `coop_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`payload` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt` integer NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `coop_rule_states` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	`last_queued` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `coop_runtime` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text,
	`lock_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `coop_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subscription` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_accepted` integer,
	`last_error` text
);
