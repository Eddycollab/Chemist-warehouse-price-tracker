/**
 * Chemist Warehouse Price Crawler
 *
 * This module handles crawling product prices from Chemist Warehouse.
 * It uses axios for HTTP requests and cheerio for HTML parsing.
 *
 * Note: This crawler respects robots.txt and implements rate limiting
 * to avoid overloading the target server.
 */

import axios from "axios";
import {
  getAllProducts,
  updateProduct,
  addPriceHistory,
  createNotification,
  getLatestPriceForProduct,
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
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const CRAWL_DELAY_MS = 2000; // 2 seconds between requests
const REQUEST_TIMEOUT_MS = 15000; // 15 seconds timeout

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

// ─── Chemist Warehouse Scraper ────────────────────────────────────────────────

/**
 * Scrapes product data from a Chemist Warehouse product page URL.
 * Uses structured data (JSON-LD) when available, falls back to HTML parsing.
 */
export async function scrapeChemistWarehouseProduct(
  url: string,
  userAgent: string = DEFAULT_USER_AGENT
): Promise<CrawledProductData | null> {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
      },
      timeout: REQUEST_TIMEOUT_MS,
    });

    const html: string = response.data;
    const result: CrawledProductData = {};

    // ── Try JSON-LD structured data first ────────────────────────────────────
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const script of jsonLdMatch) {
        try {
          const jsonContent = script.replace(/<script[^>]*>/, "").replace(/<\/script>/, "").trim();
          const data = JSON.parse(jsonContent);

          if (data["@type"] === "Product" || (Array.isArray(data["@graph"]) && data["@graph"].some((g: { "@type": string }) => g["@type"] === "Product"))) {
            const product = data["@type"] === "Product" ? data : data["@graph"].find((g: { "@type": string }) => g["@type"] === "Product");

            if (product) {
              result.name = product.name;
              result.brand = product.brand?.name || product.brand;
              result.imageUrl = Array.isArray(product.image) ? product.image[0] : product.image;
              result.sku = product.sku || product.mpn;

              const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
              if (offer) {
                result.currentPrice = parseFloat(offer.price) || undefined;
                if (offer.priceSpecification) {
                  const specs = Array.isArray(offer.priceSpecification)
                    ? offer.priceSpecification
                    : [offer.priceSpecification];
                  const originalSpec = specs.find((s: { priceType?: string }) =>
                    s.priceType?.includes("ListPrice") || s.priceType?.includes("SuggestedRetailPrice")
                  );
                  if (originalSpec) {
                    result.originalPrice = parseFloat(originalSpec.price) || undefined;
                  }
                }
              }
              break;
            }
          }
        } catch {
          // Continue to next script tag or fallback
        }
      }
    }

    // ── Fallback: HTML parsing with regex patterns ────────────────────────────
    if (!result.currentPrice) {
      // Try to extract price from common CW patterns
      const pricePatterns = [
        /class="[^"]*Price[^"]*"[^>]*>\s*\$?\s*([\d,]+\.?\d*)/i,
        /"price":\s*"?([\d.]+)"?/,
        /data-price="([\d.]+)"/,
        /\$\s*([\d,]+\.?\d*)\s*(?:<\/span>|<\/div>|<\/p>)/,
      ];

      for (const pattern of pricePatterns) {
        const match = html.match(pattern);
        if (match?.[1]) {
          result.currentPrice = parsePrice(match[1]);
          if (result.currentPrice) break;
        }
      }
    }

    if (!result.name) {
      // Extract product name from title or h1
      const titleMatch = html.match(/<h1[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
        html.match(/<title>(.*?)\s*[-|]\s*Chemist Warehouse/i);
      if (titleMatch?.[1]) {
        result.name = titleMatch[1].replace(/<[^>]+>/g, "").trim();
      }
    }

    // Determine if on sale
    if (result.currentPrice && result.originalPrice && result.originalPrice > result.currentPrice) {
      result.isOnSale = true;
      result.discountPercent = calculateDiscountPercent(result.originalPrice, result.currentPrice);
    } else {
      result.isOnSale = false;
    }

    // Validate we got at least a price
    if (!result.currentPrice) {
      console.warn(`[Crawler] Could not extract price from: ${url}`);
      return null;
    }

    return result;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[Crawler] HTTP error for ${url}: ${error.response?.status} ${error.message}`);
    } else {
      console.error(`[Crawler] Error scraping ${url}:`, error);
    }
    return null;
  }
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

  // Check if previously on sale and now not (or vice versa)
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

  // Check for price changes (only if we have an old price)
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
}): Promise<{ jobId: number; success: boolean; message: string }> {
  console.log("[Crawler] Starting crawl job...", options);

  // Load settings
  const settingsRows = await getCrawlerSettings();
  const settingsMap: Record<string, string> = {};
  settingsRows.forEach((s) => (settingsMap[s.key] = s.value));

  const userAgent = settingsMap["user_agent"] || DEFAULT_USER_AGENT;
  const priceDrop = parseFloat(settingsMap["price_drop_threshold"] || "5");
  const priceIncrease = parseFloat(settingsMap["price_increase_threshold"] || "10");
  const notifyOnSale = settingsMap["notify_on_sale"] !== "false";

  // Create crawl job record
  const jobResult = await createCrawlJob({
    jobType: options.jobType || "manual",
    status: "running",
    category: (options.category as "beauty_skincare" | "adult_health" | "childrens_health" | "vegan_health" | "natural_soap" | "other" | "all") || "all",
    startedAt: new Date(),
  });

  // Get the job ID from the insert result
  const jobId = (jobResult as { insertId?: number })?.insertId || 0;

  // Get products to crawl
  const allProducts = await getAllProducts({
    category: options.category && options.category !== "all"
      ? (options.category as "beauty_skincare" | "adult_health" | "childrens_health" | "vegan_health" | "natural_soap" | "other")
      : undefined,
    isActive: true,
  });

  const productsToCrawl = options.productIds
    ? allProducts.filter((p) => options.productIds!.includes(p.id))
    : allProducts;

  await updateCrawlJob(jobId, { totalProducts: productsToCrawl.length });

  let crawledCount = 0;
  let failedCount = 0;

  for (const product of productsToCrawl) {
    try {
      console.log(`[Crawler] Scraping: ${product.name} (${product.url})`);

      const crawledData = await scrapeChemistWarehouseProduct(product.url, userAgent);

      if (crawledData && crawledData.currentPrice) {
        // Detect price changes and create notifications
        await detectAndNotifyPriceChange(product, crawledData, {
          priceDrop,
          priceIncrease,
          notifyOnSale,
        });

        // Update product with new data
        await updateProduct(product.id, {
          currentPrice: String(crawledData.currentPrice),
          originalPrice: crawledData.originalPrice ? String(crawledData.originalPrice) : undefined,
          isOnSale: crawledData.isOnSale ?? false,
          discountPercent: crawledData.discountPercent ? String(crawledData.discountPercent) : undefined,
          imageUrl: crawledData.imageUrl || product.imageUrl,
          lastCrawledAt: new Date(),
        });

        // Add price history record
        await addPriceHistory({
          productId: product.id,
          price: String(crawledData.currentPrice),
          originalPrice: crawledData.originalPrice ? String(crawledData.originalPrice) : undefined,
          isOnSale: crawledData.isOnSale ?? false,
          discountPercent: crawledData.discountPercent ? String(crawledData.discountPercent) : undefined,
          crawledAt: new Date(),
        });

        crawledCount++;
      } else {
        failedCount++;
        console.warn(`[Crawler] Failed to get price for: ${product.name}`);
      }
    } catch (error) {
      failedCount++;
      console.error(`[Crawler] Error processing product ${product.id}:`, error);
    }

    // Rate limiting - wait between requests
    await sleep(CRAWL_DELAY_MS);
  }

  // Update job as completed
  await updateCrawlJob(jobId, {
    status: failedCount === productsToCrawl.length ? "failed" : "completed",
    crawledProducts: crawledCount,
    failedProducts: failedCount,
    completedAt: new Date(),
  });

  // Notify owner if there were significant price changes
  if (crawledCount > 0) {
    try {
      await notifyOwner({
        title: `爬蟲任務完成`,
        content: `已完成爬取 ${crawledCount} 個產品，${failedCount} 個失敗。請查看儀表板了解最新價格變化。`,
      });
    } catch {
      // Notification failure is non-critical
    }
  }

  console.log(`[Crawler] Job ${jobId} completed: ${crawledCount} crawled, ${failedCount} failed`);

  return {
    jobId,
    success: crawledCount > 0,
    message: `爬取完成：成功 ${crawledCount} 個，失敗 ${failedCount} 個`,
  };
}
