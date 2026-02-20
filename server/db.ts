import { eq, desc, and, gte, lte, like, or, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  products,
  priceHistory,
  crawlJobs,
  notifications,
  crawlerSettings,
  InsertProduct,
  InsertPriceHistory,
  InsertCrawlJob,
  InsertNotification,
  ProductCategory,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User Helpers ───────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Product Helpers ─────────────────────────────────────────────────────────

export async function getAllProducts(filters?: {
  category?: ProductCategory;
  isActive?: boolean;
  isOnSale?: boolean;
  search?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters?.category) conditions.push(eq(products.category, filters.category));
  if (filters?.isActive !== undefined) conditions.push(eq(products.isActive, filters.isActive));
  if (filters?.isOnSale !== undefined) conditions.push(eq(products.isOnSale, filters.isOnSale));
  if (filters?.search) {
    conditions.push(
      or(
        like(products.name, `%${filters.search}%`),
        like(products.brand, `%${filters.search}%`)
      )
    );
  }

  const query = conditions.length > 0
    ? db.select().from(products).where(and(...conditions)).orderBy(desc(products.updatedAt))
    : db.select().from(products).orderBy(desc(products.updatedAt));

  return query;
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values(data);
  return result;
}

export async function updateProduct(id: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(products).where(eq(products.id, id));
}

export async function getProductStats() {
  const db = await getDb();
  if (!db) return { total: 0, onSale: 0, active: 0, categories: {} };

  const allProducts = await db.select().from(products).where(eq(products.isActive, true));
  const onSale = allProducts.filter((p) => p.isOnSale).length;

  const categories: Record<string, number> = {};
  allProducts.forEach((p) => {
    categories[p.category] = (categories[p.category] || 0) + 1;
  });

  return {
    total: allProducts.length,
    onSale,
    active: allProducts.length,
    categories,
  };
}

// ─── Price History Helpers ────────────────────────────────────────────────────

export async function getPriceHistory(productId: number, days = 30) {
  const db = await getDb();
  if (!db) return [];

  const since = new Date();
  since.setDate(since.getDate() - days);

  return db
    .select()
    .from(priceHistory)
    .where(and(eq(priceHistory.productId, productId), gte(priceHistory.crawledAt, since)))
    .orderBy(priceHistory.crawledAt);
}

export async function addPriceHistory(data: InsertPriceHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(priceHistory).values(data);
}

export async function getLatestPriceForProduct(productId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(priceHistory)
    .where(eq(priceHistory.productId, productId))
    .orderBy(desc(priceHistory.crawledAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Crawl Job Helpers ────────────────────────────────────────────────────────

export async function createCrawlJob(data: InsertCrawlJob) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(crawlJobs).values(data);
  return result;
}

export async function updateCrawlJob(id: number, data: Partial<InsertCrawlJob>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(crawlJobs).set(data).where(eq(crawlJobs.id, id));
}

export async function getCrawlJobs(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(crawlJobs).orderBy(desc(crawlJobs.createdAt)).limit(limit);
}

export async function getLatestCrawlJob() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(crawlJobs).orderBy(desc(crawlJobs.createdAt)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ─── Notification Helpers ─────────────────────────────────────────────────────

export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(notifications).values(data);
}

export async function getNotifications(limit = 50, unreadOnly = false) {
  const db = await getDb();
  if (!db) return [];

  const query = unreadOnly
    ? db
        .select()
        .from(notifications)
        .where(eq(notifications.isRead, false))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
    : db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(limit);

  return query;
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

export async function markAllNotificationsRead() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(notifications).set({ isRead: true }).where(eq(notifications.isRead, false));
}

export async function getUnreadNotificationCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(eq(notifications.isRead, false));
  return result[0]?.count ?? 0;
}

// ─── Crawler Settings Helpers ─────────────────────────────────────────────────

export async function getCrawlerSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(crawlerSettings);
}

export async function updateCrawlerSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .insert(crawlerSettings)
    .values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}
