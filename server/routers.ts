import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats,
  getPriceHistory,
  getCrawlJobs,
  getLatestCrawlJob,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
  getCrawlerSettings,
  updateCrawlerSetting,
  getAccessPassword,
  resetStuckJobs,
} from "./db";
import { runCrawl, stopCrawl, isCrawlRunning } from "./crawler";
import * as XLSX from "xlsx";
import { getSchedulerStatus } from "./scheduler";
import { PRODUCT_CATEGORIES } from "../drizzle/schema";

// ─── Product Router ───────────────────────────────────────────────────────────

const productRouter = router({
  list: publicProcedure
    .input(
      z.object({
        category: z.enum(PRODUCT_CATEGORIES).optional(),
        isOnSale: z.boolean().optional(),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return getAllProducts({
        category: input?.category,
        isActive: true,
        isOnSale: input?.isOnSale,
        search: input?.search,
      });
    }),

  stats: publicProcedure.query(async () => {
    return getProductStats();
  }),

  byId: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const product = await getProductById(input.id);
      if (!product) throw new Error("Product not found");
      return product;
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(500),
        brand: z.string().max(200).optional(),
        url: z.string().url(),
        category: z.enum(PRODUCT_CATEGORIES),
        sku: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ input }) => {
      await createProduct({
        name: input.name,
        brand: input.brand,
        url: input.url,
        category: input.category,
        sku: input.sku,
        isActive: true,
        isOnSale: false,
      });
      return { success: true };
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(500).optional(),
        brand: z.string().max(200).optional(),
        url: z.string().url().optional(),
        category: z.enum(PRODUCT_CATEGORIES).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateProduct(id, data);
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteProduct(input.id);
      return { success: true };
    }),

  importFromExcel: publicProcedure
    .input(
      z.object({
        // base64-encoded xlsx file content
        fileBase64: z.string(),
        fileName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Decode base64 to buffer
      const buffer = Buffer.from(input.fileBase64, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error("Excel 檔案為空，請檢查格式");
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      if (rows.length === 0) throw new Error("資料為空，請檢查 Excel 內容");

      const validCategories = new Set(PRODUCT_CATEGORIES);
      const results: { success: number; failed: number; errors: string[] } = {
        success: 0,
        failed: 0,
        errors: [],
      };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const rowNum = i + 2; // Excel row number (1-indexed + header)

        // Flexible column name matching (support Chinese and English headers)
        const name = String(
          row["name"] ?? row["\u5546\u54c1\u540d\u7a31"] ?? row["\u540d\u7a31"] ?? ""
        ).trim();
        const url = String(
          row["url"] ?? row["URL"] ?? row["\u5546\u54c1\u9023\u7d50"] ?? row["\u9023\u7d50"] ?? ""
        ).trim();
        const brand = String(
          row["brand"] ?? row["\u54c1\u724c"] ?? ""
        ).trim();
        const categoryRaw = String(
          row["category"] ?? row["\u54c1\u985e"] ?? row["\u5206\u985e"] ?? ""
        ).trim();
        const sku = String(
          row["sku"] ?? row["SKU"] ?? ""
        ).trim();

        if (!name) {
          results.errors.push(`\u7b2c ${rowNum} \u884c\uff1a\u5546\u54c1\u540d\u7a31\u4e0d\u80fd\u70ba\u7a7a`);
          results.failed++;
          continue;
        }
        if (!url || !url.startsWith("http")) {
          results.errors.push(`\u7b2c ${rowNum} \u884c (${name})\uff1aURL \u683c\u5f0f\u4e0d\u6b63\u78ba`);
          results.failed++;
          continue;
        }

        // Map category
        let category: typeof PRODUCT_CATEGORIES[number] = "beauty_skincare";
        const catMap: Record<string, typeof PRODUCT_CATEGORIES[number]> = {
          beauty: "beauty_skincare",
          beauty_skincare: "beauty_skincare",
          "\u7f8e\u599a\u8b77\u819a": "beauty_skincare",
          "\u7f8e\u5bb9": "beauty_skincare",
          adult_health: "adult_health",
          "\u6210\u4eba\u4fdd\u5065": "adult_health",
          children_health: "childrens_health",
          childrens_health: "childrens_health",
          "\u5152\u7ae5\u4fdd\u5065": "childrens_health",
          vegan_health: "vegan_health",
          "\u7d14\u7d20\u4fdd\u5065": "vegan_health",
          natural_soap: "natural_soap",
          "\u5929\u7136\u9999\u7682": "natural_soap",
          other: "other",
          "\u5176\u4ed6": "other",
        };
        if (categoryRaw && catMap[categoryRaw.toLowerCase()]) {
          category = catMap[categoryRaw.toLowerCase()]!;
        } else if (validCategories.has(categoryRaw as typeof PRODUCT_CATEGORIES[number])) {
          category = categoryRaw as typeof PRODUCT_CATEGORIES[number];
        }

        try {
          await createProduct({
            name,
            brand: brand || undefined,
            url,
            category,
            sku: sku || undefined,
            isActive: true,
            isOnSale: false,
          });
          results.success++;
        } catch (err) {
          results.errors.push(`\u7b2c ${rowNum} \u884c (${name})\uff1a${err instanceof Error ? err.message : "\u672a\u77e5\u932f\u8aa4"}`);
          results.failed++;
        }
      }

      return results;
    }),

  downloadTemplate: publicProcedure.query(() => {
    // Return template column definitions for frontend to generate
    return {
      headers: [
        { key: "name", label: "\u5546\u54c1\u540d\u7a31", required: true, example: "Swisse Ultiboost Vitamin C 1000mg 120\u9821" },
        { key: "url", label: "\u5546\u54c1\u9023\u7d50", required: true, example: "https://www.chemistwarehouse.com.au/buy/..." },
        { key: "brand", label: "\u54c1\u724c", required: false, example: "Swisse" },
        { key: "category", label: "\u54c1\u985e", required: false, example: "adult_health" },
        { key: "sku", label: "SKU", required: false, example: "SW001" },
      ],
      categories: PRODUCT_CATEGORIES,
      categoryLabels: {
        beauty: "\u7f8e\u599a\u8b77\u819a",
        adult_health: "\u6210\u4eba\u4fdd\u5065",
        children_health: "\u5152\u7ae5\u4fdd\u5065",
        vegan_health: "\u7d14\u7d20\u4fdd\u5065",
        natural_soap: "\u5929\u7136\u9999\u7682",
      },
    };
  }),
});

// ─── Price History Router ─────────────────────────────────────────────────────

const priceHistoryRouter = router({
  byProduct: publicProcedure
    .input(
      z.object({
        productId: z.number(),
        days: z.number().min(1).max(365).default(30),
      })
    )
    .query(async ({ input }) => {
      return getPriceHistory(input.productId, input.days);
    }),
});

// ─── Crawl Router ─────────────────────────────────────────────────────────────

const crawlRouter = router({
  jobs: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ input }) => {
      return getCrawlJobs(input?.limit ?? 20);
    }),

  latestJob: publicProcedure.query(async () => {
    return getLatestCrawlJob();
  }),

  trigger: publicProcedure
    .input(
      z.object({
        category: z.string().optional(),
        productIds: z.array(z.number()).optional(),
      }).optional()
    )
    .mutation(async ({ input }) => {
      // Run crawl in background (don't await)
      runCrawl({
        category: input?.category,
        jobType: "manual",
        productIds: input?.productIds,
      }).catch((err) => console.error("[CrawlRouter] Background crawl error:", err));

      return { success: true, message: "爬蟲任務已啟動，請稍後查看結果" };
    }),

  schedulerStatus: publicProcedure.query(() => {
    return getSchedulerStatus();
  }),

  isRunning: publicProcedure.query(() => {
    return { running: isCrawlRunning() };
  }),

  stop: publicProcedure.mutation(() => {
    const result = stopCrawl();
    if (result.stopped) {
      return { success: true, message: `已發送停止指令，爬蟲將在完成目前頁面後停止` };
    }
    return { success: false, message: "目前沒有正在執行的爬蟲任務" };
  }),

  resetStuck: publicProcedure.mutation(async () => {
    const count = await resetStuckJobs();
    return { success: true, message: count > 0 ? `已重置 ${count} 個卡住的任務` : "沒有需要重置的任務", count };
  }),
});

// ─── Notification Router ──────────────────────────────────────────────────────

const notificationRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        unreadOnly: z.boolean().default(false),
      }).optional()
    )
    .query(async ({ input }) => {
      return getNotifications(input?.limit ?? 50, input?.unreadOnly ?? false);
    }),

  unreadCount: publicProcedure.query(async () => {
    const count = await getUnreadNotificationCount();
    return { count };
  }),

  markRead: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await markNotificationRead(input.id);
      return { success: true };
    }),

  markAllRead: publicProcedure.mutation(async () => {
    await markAllNotificationsRead();
    return { success: true };
  }),
});

// ─── Settings Router ──────────────────────────────────────────────────────────

const settingsRouter = router({
  list: publicProcedure.query(async () => {
    return getCrawlerSettings();
  }),

  update: publicProcedure
    .input(
      z.object({
        key: z.string(),
        value: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await updateCrawlerSetting(input.key, input.value);
      return { success: true };
    }),
});

// ─── Access Auth Router ─────────────────────────────────────────────────────
const accessAuthRouter = router({
  verify: publicProcedure
    .input(z.object({ password: z.string() }))
    .mutation(async ({ input }) => {
      const stored = await getAccessPassword();
      if (input.password === stored) {
        return { success: true };
      }
      return { success: false, error: "密碼錯誤，請重試" };
    }),
  hasPassword: publicProcedure.query(async () => {
    const pwd = await getAccessPassword();
    return { enabled: pwd.length > 0 };
  }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  access: accessAuthRouter,
  product: productRouter,
  priceHistory: priceHistoryRouter,
  crawl: crawlRouter,
  notification: notificationRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
