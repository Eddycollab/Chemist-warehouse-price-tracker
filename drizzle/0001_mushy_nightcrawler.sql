CREATE TABLE `crawl_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobType` enum('scheduled','manual') NOT NULL DEFAULT 'manual',
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`category` enum('beauty_skincare','adult_health','childrens_health','vegan_health','natural_soap','other','all') DEFAULT 'all',
	`totalProducts` int DEFAULT 0,
	`crawledProducts` int DEFAULT 0,
	`failedProducts` int DEFAULT 0,
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crawl_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crawler_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crawler_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `crawler_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`type` enum('price_drop','price_increase','new_sale','sale_ended') NOT NULL,
	`title` varchar(500) NOT NULL,
	`message` text NOT NULL,
	`oldPrice` decimal(10,2),
	`newPrice` decimal(10,2),
	`changePercent` decimal(5,2),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`originalPrice` decimal(10,2),
	`isOnSale` boolean NOT NULL DEFAULT false,
	`discountPercent` decimal(5,2),
	`crawledAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(500) NOT NULL,
	`brand` varchar(200),
	`sku` varchar(100),
	`url` text NOT NULL,
	`imageUrl` text,
	`category` enum('beauty_skincare','adult_health','childrens_health','vegan_health','natural_soap','other') NOT NULL DEFAULT 'other',
	`currentPrice` decimal(10,2),
	`originalPrice` decimal(10,2),
	`isOnSale` boolean NOT NULL DEFAULT false,
	`discountPercent` decimal(5,2),
	`isActive` boolean NOT NULL DEFAULT true,
	`lastCrawledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
