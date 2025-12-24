CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`custom_domain` text,
	`subscription_tier` text DEFAULT 'free' NOT NULL,
	`feature_flags` text DEFAULT '{}',
	`settings` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_custom_domain_unique` ON `tenants` (`custom_domain`);--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `refresh_token_user_idx` ON `refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_tenant_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`role` text NOT NULL,
	`permissions` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `membership_user_idx` ON `user_tenant_memberships` (`user_id`);--> statement-breakpoint
CREATE INDEX `membership_tenant_idx` ON `user_tenant_memberships` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`role` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`mfa_enabled` integer DEFAULT false NOT NULL,
	`mfa_secret` text,
	`profile_data` text DEFAULT '{}',
	`dietary_requirements` text DEFAULT '{}',
	`accessibility_needs` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `event_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`room_id` text,
	`max_participants` integer,
	`session_type` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sessions_event_idx` ON `event_sessions` (`event_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`venue_id` text,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`short_description` text,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`timezone` text DEFAULT 'UTC',
	`max_attendees` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`pricing_tiers` text DEFAULT '[]',
	`custom_fields` text DEFAULT '[]',
	`settings` text DEFAULT '{}',
	`images` text DEFAULT '[]',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`published_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `events_tenant_idx` ON `events` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `events_slug_idx` ON `events` (`tenant_id`,`slug`);--> statement-breakpoint
CREATE INDEX `events_status_idx` ON `events` (`status`);--> statement-breakpoint
CREATE INDEX `events_dates_idx` ON `events` (`start_date`,`end_date`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`venue_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`capacity` integer NOT NULL,
	`price_per_night` real,
	`currency` text DEFAULT 'USD',
	`accessibility_features` text DEFAULT '[]',
	`amenities` text DEFAULT '[]',
	`images` text DEFAULT '[]',
	`floor_number` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rooms_venue_idx` ON `rooms` (`venue_id`);--> statement-breakpoint
CREATE INDEX `rooms_tenant_idx` ON `rooms` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`address` text,
	`city` text,
	`country` text,
	`latitude` real,
	`longitude` real,
	`capacity` integer,
	`amenities` text DEFAULT '[]',
	`images` text DEFAULT '[]',
	`contact_info` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `venues_tenant_idx` ON `venues` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`pricing_tier` text NOT NULL,
	`base_amount` real NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`room_allocation_id` text,
	`custom_field_responses` text DEFAULT '{}',
	`dietary_notes` text,
	`accessibility_notes` text,
	`internal_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`confirmed_at` integer,
	`cancelled_at` integer,
	`cancellation_reason` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_allocation_id`) REFERENCES `room_allocations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `bookings_event_idx` ON `bookings` (`event_id`);--> statement-breakpoint
CREATE INDEX `bookings_user_idx` ON `bookings` (`user_id`);--> statement-breakpoint
CREATE INDEX `bookings_tenant_idx` ON `bookings` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `bookings_status_idx` ON `bookings` (`status`);--> statement-breakpoint
CREATE TABLE `room_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`event_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`booking_id` text,
	`check_in_date` integer NOT NULL,
	`check_out_date` integer NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `allocations_room_idx` ON `room_allocations` (`room_id`);--> statement-breakpoint
CREATE INDEX `allocations_event_idx` ON `room_allocations` (`event_id`);--> statement-breakpoint
CREATE INDEX `allocations_booking_idx` ON `room_allocations` (`booking_id`);--> statement-breakpoint
CREATE TABLE `waitlist_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`position` integer NOT NULL,
	`pricing_tier` text,
	`created_at` integer NOT NULL,
	`notified_at` integer,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `waitlist_event_idx` ON `waitlist_entries` (`event_id`);--> statement-breakpoint
CREATE INDEX `waitlist_position_idx` ON `waitlist_entries` (`event_id`,`position`);--> statement-breakpoint
CREATE TABLE `payment_installments` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_plan_id` text NOT NULL,
	`payment_id` text,
	`amount` real NOT NULL,
	`due_date` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`payment_plan_id`) REFERENCES `payment_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `installments_plan_idx` ON `payment_installments` (`payment_plan_id`);--> statement-breakpoint
CREATE INDEX `installments_due_idx` ON `payment_installments` (`due_date`,`status`);--> statement-breakpoint
CREATE TABLE `payment_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`total_amount` real NOT NULL,
	`currency` text NOT NULL,
	`installment_count` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plans_booking_idx` ON `payment_plans` (`booking_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider` text NOT NULL,
	`provider_payment_intent_id` text,
	`provider_charge_id` text,
	`payment_method` text,
	`metadata` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payments_booking_idx` ON `payments` (`booking_id`);--> statement-breakpoint
CREATE INDEX `payments_tenant_idx` ON `payments` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `payments_status_idx` ON `payments` (`status`);--> statement-breakpoint
CREATE INDEX `payments_provider_idx` ON `payments` (`provider`,`provider_payment_intent_id`);--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`amount` real NOT NULL,
	`reason` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_refund_id` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `refunds_payment_idx` ON `refunds` (`payment_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`user_id` text,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`details` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_tenant_idx` ON `audit_logs` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `audit_user_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_resource_idx` ON `audit_logs` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`created_at`);