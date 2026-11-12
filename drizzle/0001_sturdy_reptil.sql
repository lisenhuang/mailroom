CREATE TABLE `domain_preferences` (
	`owner` text NOT NULL,
	`domain` text NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`owner`, `domain`)
);
