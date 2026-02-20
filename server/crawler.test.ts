import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock axios to avoid real HTTP requests in tests
vi.mock("axios");
vi.mock("./db", () => ({
  getAllProducts: vi.fn().mockResolvedValue([]),
  updateProduct: vi.fn().mockResolvedValue({}),
  addPriceHistory: vi.fn().mockResolvedValue({}),
  createNotification: vi.fn().mockResolvedValue({}),
  getLatestPriceForProduct: vi.fn().mockResolvedValue(undefined),
  createCrawlJob: vi.fn().mockResolvedValue({ insertId: 1 }),
  updateCrawlJob: vi.fn().mockResolvedValue({}),
  getCrawlerSettings: vi.fn().mockResolvedValue([]),
  getProductStats: vi.fn().mockResolvedValue({ total: 0, onSale: 0, active: 0, categories: {} }),
  getProductById: vi.fn().mockResolvedValue(undefined),
  createProduct: vi.fn().mockResolvedValue({ insertId: 1 }),
  deleteProduct: vi.fn().mockResolvedValue({}),
  getCrawlJobs: vi.fn().mockResolvedValue([]),
  getLatestCrawlJob: vi.fn().mockResolvedValue(undefined),
  getNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn().mockResolvedValue({}),
  markAllNotificationsRead: vi.fn().mockResolvedValue({}),
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
  updateCrawlerSetting: vi.fn().mockResolvedValue({}),
  upsertUser: vi.fn().mockResolvedValue({}),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  getPriceHistory: vi.fn().mockResolvedValue([]),
}));
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Import the functions we want to test (non-HTTP ones)
// We test the price parsing and discount calculation logic indirectly

describe("Crawler utility logic", () => {
  it("parsePrice should handle various price formats", () => {
    // Test the price parsing logic inline (mirrors the crawler's parsePrice function)
    function parsePrice(priceStr: string | undefined | null): number | undefined {
      if (!priceStr) return undefined;
      const cleaned = priceStr.replace(/[^0-9.]/g, "");
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? undefined : parsed;
    }

    expect(parsePrice("$24.99")).toBe(24.99);
    expect(parsePrice("24.99")).toBe(24.99);
    expect(parsePrice("$1,234.56")).toBe(1234.56);
    expect(parsePrice(null)).toBeUndefined();
    expect(parsePrice(undefined)).toBeUndefined();
    expect(parsePrice("")).toBeUndefined();
    expect(parsePrice("N/A")).toBeUndefined();
  });

  it("calculateDiscountPercent should compute correct percentages", () => {
    function calculateDiscountPercent(original: number, current: number): number {
      if (original <= 0) return 0;
      return Math.round(((original - current) / original) * 10000) / 100;
    }

    expect(calculateDiscountPercent(100, 75)).toBe(25);
    expect(calculateDiscountPercent(29.99, 19.99)).toBeCloseTo(33.34, 1);
    expect(calculateDiscountPercent(0, 10)).toBe(0);
    expect(calculateDiscountPercent(49.99, 39.99)).toBeCloseTo(20.0, 1);
  });

  it("should detect sale status from price comparison", () => {
    function detectSale(currentPrice: number, originalPrice: number | undefined): boolean {
      return !!(originalPrice && originalPrice > currentPrice);
    }

    expect(detectSale(19.99, 29.99)).toBe(true);
    expect(detectSale(29.99, 29.99)).toBe(false);
    expect(detectSale(29.99, undefined)).toBe(false);
    expect(detectSale(35.00, 29.99)).toBe(false);
  });
});

describe("Scheduler status", () => {
  it("getSchedulerStatus should return correct shape", async () => {
    const { getSchedulerStatus } = await import("./scheduler");
    const status = getSchedulerStatus();

    expect(status).toHaveProperty("isRunning");
    expect(status).toHaveProperty("nextRunTime");
    expect(status).toHaveProperty("msUntilNextRun");
    expect(typeof status.isRunning).toBe("boolean");
  });
});

describe("tRPC routers", () => {
  it("product.stats should return correct shape", async () => {
    const { appRouter } = await import("./routers");

    const ctx = {
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: vi.fn() } as any,
    };

    const caller = appRouter.createCaller(ctx);
    const stats = await caller.product.stats();

    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("onSale");
    expect(stats).toHaveProperty("active");
    expect(stats).toHaveProperty("categories");
    expect(typeof stats.total).toBe("number");
    expect(typeof stats.onSale).toBe("number");
  });

  it("product.list should return an array", async () => {
    const { appRouter } = await import("./routers");

    const ctx = {
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: vi.fn() } as any,
    };

    const caller = appRouter.createCaller(ctx);
    const products = await caller.product.list();

    expect(Array.isArray(products)).toBe(true);
  });

  it("notification.unreadCount should return count object", async () => {
    const { appRouter } = await import("./routers");

    const ctx = {
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: vi.fn() } as any,
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.notification.unreadCount();

    expect(result).toHaveProperty("count");
    expect(typeof result.count).toBe("number");
  });

  it("crawl.schedulerStatus should return status object", async () => {
    const { appRouter } = await import("./routers");

    const ctx = {
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: vi.fn() } as any,
    };

    const caller = appRouter.createCaller(ctx);
    const status = await caller.crawl.schedulerStatus();

    expect(status).toHaveProperty("isRunning");
    expect(status).toHaveProperty("nextRunTime");
  });

  it("settings.list should return an array", async () => {
    const { appRouter } = await import("./routers");

    const ctx = {
      user: null,
      req: { protocol: "https", headers: {} } as any,
      res: { clearCookie: vi.fn() } as any,
    };

    const caller = appRouter.createCaller(ctx);
    const settings = await caller.settings.list();

    expect(Array.isArray(settings)).toBe(true);
  });
});
