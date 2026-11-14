ALTER TABLE `draftPresets` ADD `featured` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `draftPresets` ADD `title` text;--> statement-breakpoint
ALTER TABLE `draftPresets` ADD `description` text;--> statement-breakpoint
ALTER TABLE `draftPresets` ADD `sortOrder` integer DEFAULT 0 NOT NULL;