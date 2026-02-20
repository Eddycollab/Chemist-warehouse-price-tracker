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
} from "./db";
import { runCrawl } from "./crawler";
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
  product: productRouter,
  priceHistory: priceHistoryRouter,
  crawl: crawlRouter,
  notification: notificationRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
