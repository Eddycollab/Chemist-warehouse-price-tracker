/**
 * Scheduler module for automated crawl jobs.
 * Runs weekly crawls automatically using setInterval.
 */

import { runCrawl } from "./crawler";
import { getCrawlerSettings } from "./db";

let schedulerInterval: NodeJS.Timeout | null = null;
let nextRunTime: Date | null = null;

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Calculate the next run time (next Monday at 9:00 AM AEST)
 */
function getNextWeeklyRunTime(): Date {
  const now = new Date();
  const next = new Date(now);

  // Set to next Monday
  const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, ...
  const daysUntilMonday = dayOfWeek === 1 ? 7 : (8 - dayOfWeek) % 7 || 7;
  next.setDate(now.getDate() + daysUntilMonday);
  next.setHours(9, 0, 0, 0);

  return next;
}

/**
 * Start the weekly scheduler
 */
export function startScheduler(): void {
  if (schedulerInterval) {
    console.log("[Scheduler] Already running, skipping start");
    return;
  }

  console.log("[Scheduler] Starting weekly crawl scheduler...");

  const scheduleNextRun = async () => {
    nextRunTime = getNextWeeklyRunTime();
    const msUntilRun = nextRunTime.getTime() - Date.now();

    console.log(`[Scheduler] Next crawl scheduled for: ${nextRunTime.toLocaleString("zh-TW", { timeZone: "Australia/Sydney" })}`);

    schedulerInterval = setTimeout(async () => {
      console.log("[Scheduler] Running scheduled weekly crawl...");
      try {
        await runCrawl({ jobType: "scheduled", category: "all" });
        console.log("[Scheduler] Weekly crawl completed successfully");
      } catch (error) {
        console.error("[Scheduler] Weekly crawl failed:", error);
      }

      // Schedule the next run
      schedulerInterval = null;
      scheduleNextRun();
    }, msUntilRun);
  };

  scheduleNextRun();
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearTimeout(schedulerInterval);
    schedulerInterval = null;
    nextRunTime = null;
    console.log("[Scheduler] Scheduler stopped");
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
  isRunning: boolean;
  nextRunTime: string | null;
  msUntilNextRun: number | null;
} {
  return {
    isRunning: schedulerInterval !== null,
    nextRunTime: nextRunTime ? nextRunTime.toISOString() : null,
    msUntilNextRun: nextRunTime ? nextRunTime.getTime() - Date.now() : null,
  };
}
