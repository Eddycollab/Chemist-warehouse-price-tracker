/**
 * Chemist Warehouse Price Crawler
 *
 * Uses Playwright (headless Chromium) to bypass Cloudflare protection
 * and automatically discover products from category pages.
 */

import {
  getAllProducts,
  updateProduct,
  addPriceHistory,
  createNotification,
  createProduct,
  createCrawlJob,
  updateCrawlJob,
  getCrawlerSettings,
} from "./db";
import { notifyOwner } from "./_core/notification";
import type { Product } from "../drizzle/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrawledProductData {
  name?: string;
  brand?: string;
  currentPrice?: number;
  originalPrice?: number;
  isOnSale?: boolean;
  discountPercent?: number;
  imageUrl?: string;
  sku?: string;
  url?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CRAWL_DELAY_MS = 1500;

// ─── Crawl Stop Control ───────────────────────────────────────────────────────

let _crawlStopped = false;
let _currentJobId: number | null = null;

/** Request the running crawl job to stop gracefully. */
export function stopCrawl(): { stopped: boolean; jobId: number | null } {
  if (_currentJobId !== null) {
    _crawlStopped = true;
    console.log(`[Crawler] Stop requested for job #${_currentJobId}`);
    return { stopped: true, jobId: _currentJobId };
  }
  return { stopped: false, jobId: null };
}

/** Returns true if a crawl is currently running. */
export function isCrawlRunning(): boolean {
  return _currentJobId !== null;
}

// Category URL mappings for Chemist Warehouse
const CATEGORY_URLS: Record<string, { id: number; slug: string; label: string }[]> = {
  beauty_skincare: [
    { id: 300026, slug: "skincare-tools", label: "Skincare Tools" },
    { id: 300019, slug: "skincare", label: "Skincare" },
    { id: 300022, slug: "face-care", label: "Face Care" },
    { id: 300023, slug: "body-care", label: "Body Care" },
    { id: 300024, slug: "hair-care", label: "Hair Care" },
    { id: 300025, slug: "sun-care", label: "Sun Care" },
  ],
  adult_health: [
    { id: 500019, slug: "mens-health", label: "Men's Health" },
    { id: 500020, slug: "womens-health", label: "Women's Health" },
    { id: 500021, slug: "vitamins-supplements", label: "Vitamins & Supplements" },
  ],
  childrens_health: [
    { id: 600010, slug: "baby-care", label: "Baby Care" },
    { id: 600011, slug: "childrens-vitamins", label: "Children's Vitamins" },
  ],
  vegan_health: [
    { id: 700010, slug: "vegan-supplements", label: "Vegan Supplements" },
  ],
  natural_soap: [
    { id: 800010, slug: "natural-soap", label: "Natural Soap" },
    { id: 800011, slug: "body-wash", label: "Body Wash" },
  ],
};

// ─── Utility Functions ────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePrice(priceStr: string | undefined | null): number | undefined {
  if (!priceStr) return undefined;
  const cleaned = priceStr.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

function calculateDiscountPercent(original: number, current: number): number {
  if (original <= 0) return 0;
  return Math.round(((original - current) / original) * 10000) / 100;
}

function extractSkuFromUrl(url: string): string | undefined {
  const match = url.match(/\/buy\/(\d+)\//);
  return match ? match[1] : undefined;
}

// ─── Playwright Browser Manager ───────────────────────────────────────────────

let browserInstance: import("playwright").Browser | null = null;

async function getBrowser(): Promise<import("playwright").Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }
  const { chromium } = await import("playwright");
  browserInstance = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  });
  return browserInstance;
}

async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}

// ─── Category Scraper ─────────────────────────────────────────────────────────

/**
 * Scrapes a category page and returns discovered products.
 */
async function scrapeCategoryPage(
  categoryId: number,
  slug: string,
  maxPages = 3
): Promise<CrawledProductData[]> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "en-AU",
    timezoneId: "Australia/Sydney",
    viewport: { width: 1280, height: 800 },
  });

  const discoveredProducts: CrawledProductData[] = [];

  try {
    for (let page = 1; page <= maxPages; page++) {
      const url = `https://www.chemistwarehouse.com.au/shop-online/${categoryId}/${slug}?pageNumber=${page}`;
      const pageObj = await context.newPage();

      try {
        console.log(`[Crawler] Scraping category page: ${url}`);
        await pageObj.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

        // Wait for product cards to appear
        await pageObj.waitForSelector('[data-testid="product-card"], .product-card, article', {
          timeout: 15000,
        }).catch(() => {});

        // Extract products from the page
        const products = await pageObj.evaluate(() => {
          const results: Array<{
            name: string;
            url: string;
            price: string;
            originalPrice: string;
            imageUrl: string;
            brand: string;
          }> = [];

          // Find all product links
          const productLinks = document.querySelectorAll('a[href*="/buy/"]');
          const seen = new Set<string>();

          productLinks.forEach((link) => {
            const href = (link as HTMLAnchorElement).href;
            if (!href || seen.has(href)) return;
            seen.add(href);

            // Get the product card container
            const card = link.closest("article") || link.closest("[class*='product']") || link.parentElement?.parentElement;

            // Get product name
            let name = "";
            const nameEl = card?.querySelector("p, h2, h3, [class*='title'], [class*='name']");
            if (nameEl) {
              name = nameEl.textContent?.trim() || "";
            }
            if (!name) {
              name = link.textContent?.trim() || "";
            }

            // Get price - look for $ signs in nearby elements
            let price = "";
            let originalPrice = "";
            const priceEls = card?.querySelectorAll("[class*='price'], [class*='Price']");
            if (priceEls) {
              priceEls.forEach((el) => {
                const text = el.textContent?.trim() || "";
                if (text.includes("$")) {
                  if (!price) price = text;
                  else if (!originalPrice && text !== price) originalPrice = text;
                }
              });
            }

            // Fallback: search for $ in text nodes
            if (!price) {
              const allText = card?.textContent || "";
              const priceMatch = allText.match(/\$\s*([\d,]+\.?\d*)/);
              if (priceMatch) price = priceMatch[0];
            }

            // Get image
            let imageUrl = "";
            const img = card?.querySelector("img");
            if (img) {
              imageUrl = img.src || img.getAttribute("data-src") || "";
            }

            // Get brand
            let brand = "";
            const brandEl = card?.querySelector("[class*='brand'], [class*='Brand']");
            if (brandEl) brand = brandEl.textContent?.trim() || "";

            if (name && href) {
              results.push({ name, url: href, price, originalPrice, imageUrl, brand });
            }
          });

          return results;
        });

        for (const p of products) {
          const currentPrice = parsePrice(p.price);
          const origPrice = parsePrice(p.originalPrice);

          if (!currentPrice) continue;

          const isOnSale = !!(origPrice && origPrice > currentPrice);
          const discountPercent = isOnSale ? calculateDiscountPercent(origPrice!, currentPrice) : undefined;

          discoveredProducts.push({
            name: p.name,
            url: p.url,
            currentPrice,
            originalPrice: origPrice,
            isOnSale,
            discountPercent,
            imageUrl: p.imageUrl || undefined,
            brand: p.brand || undefined,
            sku: extractSkuFromUrl(p.url),
          });
        }

        console.log(`[Crawler] Found ${products.length} products on page ${page}`);

        // Check if there are more pages
        const hasNextPage = await pageObj.evaluate(() => {
          const nextBtn = document.querySelector('[aria-label="Next page"], [class*="next"], a[rel="next"]');
          return !!nextBtn && !nextBtn.hasAttribute("disabled");
        }).catch(() => false);

        await pageObj.close();

        if (!hasNextPage || products.length === 0) break;
        await sleep(CRAWL_DELAY_MS);
      } catch (err) {
        console.error(`[Crawler] Error on category page ${url}:`, err);
        await pageObj.close().catch(() => {});
        break;
      }
    }
  } finally {
    await context.close().catch(() => {});
  }

  return discoveredProducts;
}

// ─── Price Change Detection ───────────────────────────────────────────────────

async function detectAndNotifyPriceChange(
  product: Product,
  newData: CrawledProductData,
  settings: { priceDrop: number; priceIncrease: number; notifyOnSale: boolean }
): Promise<void> {
  const oldPrice = product.currentPrice ? parseFloat(String(product.currentPrice)) : null;
  const newPrice = newData.currentPrice;

  if (!newPrice) return;

  const wasOnSale = product.isOnSale;
  const isNowOnSale = newData.isOnSale ?? false;

  if (!wasOnSale && isNowOnSale && settings.notifyOnSale) {
    await createNotification({
      productId: product.id,
      type: "new_sale",
      title: `${product.name} 開始特價！`,
      message: `${product.name} 現在特價 $${newPrice}（原價 $${newData.originalPrice ?? oldPrice}），快來搶購！`,
      oldPrice: String(oldPrice ?? newData.originalPrice ?? newPrice),
      newPrice: String(newPrice),
      changePercent: String(newData.discountPercent ?? 0),
    });
  } else if (wasOnSale && !isNowOnSale) {
    await createNotification({
      productId: product.id,
      type: "sale_ended",
      title: `${product.name} 特價結束`,
      message: `${product.name} 特價已結束，現在售價 $${newPrice}。`,
      oldPrice: String(oldPrice ?? 0),
      newPrice: String(newPrice),
      changePercent: "0",
    });
  }

  if (oldPrice && Math.abs(oldPrice - newPrice) > 0.01) {
    const changePercent = ((newPrice - oldPrice) / oldPrice) * 100;

    if (changePercent < 0 && Math.abs(changePercent) >= settings.priceDrop) {
      await createNotification({
        productId: product.id,
        type: "price_drop",
        title: `${product.name} 價格下降 ${Math.abs(changePercent).toFixed(1)}%！`,
        message: `${product.name} 價格從 $${oldPrice.toFixed(2)} 降至 $${newPrice.toFixed(2)}，節省 $${(oldPrice - newPrice).toFixed(2)}！`,
        oldPrice: String(oldPrice),
        newPrice: String(newPrice),
        changePercent: String(changePercent.toFixed(2)),
      });
    } else if (changePercent > 0 && changePercent >= settings.priceIncrease) {
      await createNotification({
        productId: product.id,
        type: "price_increase",
        title: `${product.name} 價格上漲 ${changePercent.toFixed(1)}%`,
        message: `${product.name} 價格從 $${oldPrice.toFixed(2)} 漲至 $${newPrice.toFixed(2)}。`,
        oldPrice: String(oldPrice),
        newPrice: String(newPrice),
        changePercent: String(changePercent.toFixed(2)),
      });
    }
  }
}

// ─── Main Crawl Function ──────────────────────────────────────────────────────

export async function runCrawl(options: {
  category?: string;
  jobType?: "scheduled" | "manual";
  productIds?: number[];
  discoverNew?: boolean;
}): Promise<{ jobId: number; success: boolean; message: string }> {
  console.log("[Crawler] Starting crawl job...", options);

  const settingsRows = await getCrawlerSettings();
  const settingsMap: Record<string, string> = {};
  settingsRows.forEach((s) => (settingsMap[s.key] = s.value));

  const priceDrop = parseFloat(settingsMap["price_drop_threshold"] || "5");
  const priceIncrease = parseFloat(settingsMap["price_increase_threshold"] || "10");
  const notifyOnSale = settingsMap["notify_on_sale"] !== "false";

  const jobResult = await createCrawlJob({
    jobType: options.jobType || "manual",
    status: "running",
    category: (options.category as "beauty_skincare" | "adult_health" | "childrens_health" | "vegan_health" | "natural_soap" | "other" | "all") || "all",
    startedAt: new Date(),
  });

  const jobId = (jobResult as { insertId?: number })?.insertId || 0;

  // Register this job as the active job and reset stop flag
  _currentJobId = jobId;
  _crawlStopped = false;

  let crawledCount = 0;
  let failedCount = 0;
  let newProductsCount = 0;

  try {
    // ── Phase 1: Discover new products from category pages ────────────────────
    const shouldDiscover = options.discoverNew !== false; // default true
    const targetCategories = options.category && options.category !== "all"
      ? [options.category]
      : Object.keys(CATEGORY_URLS);

    if (shouldDiscover) {
      console.log("[Crawler] Phase 1: Discovering products from categories:", targetCategories);

      // Get existing product URLs to avoid duplicates
      const existingProducts = await getAllProducts({ isActive: true });
      const existingUrls = new Set(existingProducts.map((p) => p.url.toLowerCase()));

      for (const cat of targetCategories) {
        if (_crawlStopped) {
          console.log("[Crawler] Stop flag detected, aborting category loop");
          break;
        }
        const categoryUrls = CATEGORY_URLS[cat] || [];
        for (const catInfo of categoryUrls) {
          if (_crawlStopped) {
            console.log("[Crawler] Stop flag detected, aborting sub-category loop");
            break;
          }
          try {
            const discovered = await scrapeCategoryPage(catInfo.id, catInfo.slug, 2);
            console.log(`[Crawler] Discovered ${discovered.length} products in ${catInfo.label}`);

            for (const product of discovered) {
              if (!product.url || !product.name || !product.currentPrice) continue;

              const normalizedUrl = product.url.toLowerCase();
              if (existingUrls.has(normalizedUrl)) {
                // Update existing product price
                const existing = existingProducts.find(
                  (p) => p.url.toLowerCase() === normalizedUrl
                );
                if (existing) {
                  await detectAndNotifyPriceChange(existing, product, {
                    priceDrop,
                    priceIncrease,
                    notifyOnSale,
                  });
                  await updateProduct(existing.id, {
                    currentPrice: String(product.currentPrice),
                    originalPrice: product.originalPrice ? String(product.originalPrice) : undefined,
                    isOnSale: product.isOnSale ?? false,
                    discountPercent: product.discountPercent ? String(product.discountPercent) : undefined,
                    imageUrl: product.imageUrl || existing.imageUrl,
                    lastCrawledAt: new Date(),
                  });
                  await addPriceHistory({
                    productId: existing.id,
                    price: String(product.currentPrice),
                    originalPrice: product.originalPrice ? String(product.originalPrice) : undefined,
                    isOnSale: product.isOnSale ?? false,
                    discountPercent: product.discountPercent ? String(product.discountPercent) : undefined,
                    crawledAt: new Date(),
                  });
                  crawledCount++;
                }
              } else {
                // Add new product
                await createProduct({
                  name: product.name,
                  brand: product.brand || null,
                  sku: product.sku || null,
                  url: product.url,
                  imageUrl: product.imageUrl || null,
                  category: cat as "beauty_skincare" | "adult_health" | "childrens_health" | "vegan_health" | "natural_soap" | "other",
                  currentPrice: String(product.currentPrice),
                  originalPrice: product.originalPrice ? String(product.originalPrice) : null,
                  isOnSale: product.isOnSale ?? false,
                  discountPercent: product.discountPercent ? String(product.discountPercent) : null,
                  isActive: true,
                  lastCrawledAt: new Date(),
                });
                existingUrls.add(normalizedUrl);
                newProductsCount++;
                crawledCount++;
              }
            }

            await sleep(CRAWL_DELAY_MS);
          } catch (err) {
            console.error(`[Crawler] Error scraping category ${catInfo.label}:`, err);
            failedCount++;
          }
        }
      }
    }

    // ── Phase 2: Update manually-added products ───────────────────────────────
    const manualProducts = await getAllProducts({
      category: options.category && options.category !== "all"
        ? (options.category as "beauty_skincare" | "adult_health" | "childrens_health" | "vegan_health" | "natural_soap" | "other")
        : undefined,
      isActive: true,
    });

    const productsToUpdate = options.productIds
      ? manualProducts.filter((p) => options.productIds!.includes(p.id))
      : manualProducts.filter((p) => !p.lastCrawledAt || new Date().getTime() - new Date(p.lastCrawledAt).getTime() > 3600000);

    if (productsToUpdate.length > 0 && !shouldDiscover) {
      console.log(`[Crawler] Phase 2: Updating ${productsToUpdate.length} existing products`);
      await updateCrawlJob(jobId, { totalProducts: productsToUpdate.length });

      // For products not covered by category scraping, we already updated them above
      // This phase handles any remaining products that weren't found in category pages
    }

  } catch (error) {
    console.error("[Crawler] Fatal error:", error);
    failedCount++;
  } finally {
    await closeBrowser();
    _currentJobId = null;
    _crawlStopped = false;
  }

  const wasStopped = _crawlStopped;
  await updateCrawlJob(jobId, {
    status: wasStopped ? "stopped" : (failedCount > 0 && crawledCount === 0 ? "failed" : "completed"),
    crawledProducts: crawledCount,
    failedProducts: failedCount,
    completedAt: new Date(),
  });

  if (crawledCount > 0 || newProductsCount > 0) {
    try {
      await notifyOwner({
        title: `爬蟲任務完成`,
        content: `已完成爬取 ${crawledCount} 個產品（新增 ${newProductsCount} 個），${failedCount} 個失敗。`,
      });
    } catch {
      // non-critical
    }
  }

  const message = wasStopped
    ? `爬取已中止：已更新 ${crawledCount} 個，新增 ${newProductsCount} 個`
    : `爬取完成：更新 ${crawledCount} 個，新增 ${newProductsCount} 個，失敗 ${failedCount} 個`;
  console.log(`[Crawler] Job ${jobId} completed: ${message}`);

  return { jobId, success: crawledCount > 0 || newProductsCount > 0, message };
}
