import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Product categories for Chemist Warehouse
 */
export const PRODUCT_CATEGORIES = [
  "beauty_skincare",
  "adult_health",
  "childrens_health",
  "vegan_health",
  "natural_soap",
  "other",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  beauty_skincare: "美妝護膚",
  adult_health: "成人保健",
  childrens_health: "兒童保健",
  vegan_health: "純素保健",
  natural_soap: "天然香皂",
  other: "其他",
};

/**
 * Products table - stores tracked products from Chemist Warehouse
 */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 500 }).notNull(),
  brand: varchar("brand", { length: 200 }),
  sku: varchar("sku", { length: 100 }),
  url: text("url").notNull(),
  imageUrl: text("imageUrl"),
  category: mysqlEnum("category", PRODUCT_CATEGORIES).default("other").notNull(),
  currentPrice: decimal("currentPrice", { precision: 10, scale: 2 }),
  originalPrice: decimal("originalPrice", { precision: 10, scale: 2 }),
  isOnSale: boolean("isOnSale").default(false).notNull(),
  discountPercent: decimal("discountPercent", { precision: 5, scale: 2 }),
  isActive: boolean("isActive").default(true).notNull(),
  lastCrawledAt: timestamp("lastCrawledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Price history table - tracks price changes over time
 */
export const priceHistory = mysqlTable("price_history", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("originalPrice", { precision: 10, scale: 2 }),
  isOnSale: boolean("isOnSale").default(false).notNull(),
  discountPercent: decimal("discountPercent", { precision: 5, scale: 2 }),
  crawledAt: timestamp("crawledAt").defaultNow().notNull(),
});

export type PriceHistory = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = typeof priceHistory.$inferInsert;

/**
 * Crawl jobs table - scheduled and manual crawl tasks
 */
export const crawlJobs = mysqlTable("crawl_jobs", {
  id: int("id").autoincrement().primaryKey(),
  jobType: mysqlEnum("jobType", ["scheduled", "manual"]).default("manual").notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  category: mysqlEnum("category", [...PRODUCT_CATEGORIES, "all"]).default("all"),
  totalProducts: int("totalProducts").default(0),
  crawledProducts: int("crawledProducts").default(0),
  failedProducts: int("failedProducts").default(0),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CrawlJob = typeof crawlJobs.$inferSelect;
export type InsertCrawlJob = typeof crawlJobs.$inferInsert;

/**
 * Notifications table - price change and sale alerts
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  type: mysqlEnum("type", ["price_drop", "price_increase", "new_sale", "sale_ended"]).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  message: text("message").notNull(),
  oldPrice: decimal("oldPrice", { precision: 10, scale: 2 }),
  newPrice: decimal("newPrice", { precision: 10, scale: 2 }),
  changePercent: decimal("changePercent", { precision: 5, scale: 2 }),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Crawler settings table - configurable settings
 */
export const crawlerSettings = mysqlTable("crawler_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CrawlerSettings = typeof crawlerSettings.$inferSelect;
