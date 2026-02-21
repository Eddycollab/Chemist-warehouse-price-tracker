import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bot,
  Play,
  Square,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_LABELS } from "../lib/categoryLabels";

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "從未";
  return new Date(date).toLocaleString("zh-TW", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">已完成</Badge>;
    case "running":
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">執行中</Badge>;
    case "failed":
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">失敗</Badge>;
    case "stopped":
      return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">已中止</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">待機</Badge>;
  }
}

const CRAWL_CATEGORIES = [
  { value: "all", label: "全部品類" },
  { value: "beauty_skincare", label: "美妝護膚" },
  { value: "adult_health", label: "成人保健" },
  { value: "childrens_health", label: "兒童保健" },
  { value: "vegan_health", label: "純素保健" },
  { value: "natural_soap", label: "天然香皂" },
];

export default function CrawlerManager() {
  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = trpc.crawl.jobs.useQuery({ limit: 20 });
  const { data: schedulerStatus } = trpc.crawl.schedulerStatus.useQuery(undefined, { refetchInterval: 10000 });
  const { data: runningStatus, refetch: refetchRunning } = trpc.crawl.isRunning.useQuery(undefined, {
    refetchInterval: 3000,
  });
  const { data: crawlProgress } = trpc.crawl.progress.useQuery(undefined, {
    refetchInterval: 2000,
    enabled: runningStatus?.running ?? false,
  });
  const utils = trpc.useUtils();

  const isCrawling = runningStatus?.running ?? false;

  const triggerCrawl = trpc.crawl.trigger.useMutation({
    onSuccess: (data, vars) => {
      toast.success(data.message);
      setTimeout(() => {
        refetchJobs();
        refetchRunning();
        utils.crawl.latestJob.invalidate();
      }, 2000);
    },
    onError: () => toast.error("啟動爬蟲失敗"),
  });

  const resetStuck = trpc.crawl.resetStuck.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setTimeout(() => {
        refetchJobs();
        refetchRunning();
        utils.crawl.latestJob.invalidate();
      }, 500);
    },
    onError: () => toast.error("重置失敗"),
  });

  // Detect if there are stuck running jobs in DB but no actual running process
  const hasStuckJobs = !isCrawling && jobs?.some((j) => j.status === "running");

  const stopCrawl = trpc.crawl.stop.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.info(data.message);
      }
      setTimeout(() => {
        refetchJobs();
        refetchRunning();
        utils.crawl.latestJob.invalidate();
      }, 2000);
    },
    onError: () => toast.error("停止爬蟲失敗"),
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          爬蟲管理
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          手動觸發爬蟲任務或查看爬取歷史記錄
        </p>
      </div>

      {/* Stuck Jobs Warning Banner */}
      {hasStuckJobs && (
        <div className="flex items-center justify-between rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-orange-400" />
            <div>
              <p className="text-sm font-medium text-orange-300">偵測到卡住的任務</p>
              <p className="text-xs text-orange-400/70">伺服器重啟後有任務狀態未更新，請點擊重置</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300"
            disabled={resetStuck.isPending}
            onClick={() => resetStuck.mutate()}
          >
            {resetStuck.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            重置狀態
          </Button>
        </div>
      )}

      {/* Running Status Banner */}
      {isCrawling && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-yellow-400 animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-300">
                  {crawlProgress?.isTestMode ? "測試模式執行中" : "爬蟲任務執行中"}
                </p>
                <p className="text-xs text-yellow-400/70">
                  {crawlProgress?.currentCategoryLabel
                    ? `目前品類：${crawlProgress.currentCategoryLabel}`
                    : "正在準備爬取..."
                  }
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              disabled={stopCrawl.isPending}
              onClick={() => stopCrawl.mutate()}
            >
              {stopCrawl.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Square className="h-3.5 w-3.5 fill-current" />
              )}
              停止爬取
            </Button>
          </div>
          {/* Progress bar */}
          {crawlProgress && crawlProgress.totalCategories > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-yellow-400/70">
                <span>進度</span>
                <span>{crawlProgress.completedCategories} / {crawlProgress.totalCategories} 個品類</span>
              </div>
              <div className="w-full bg-yellow-900/30 rounded-full h-1.5">
                <div
                  className="bg-yellow-400 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((crawlProgress.completedCategories / crawlProgress.totalCategories) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scheduler Status */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            自動排程狀態
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">排程狀態</span>
            <Badge variant={schedulerStatus?.isRunning ? "default" : "secondary"}>
              {schedulerStatus?.isRunning ? "運行中" : "未啟動"}
            </Badge>
          </div>
          {schedulerStatus?.nextRunTime && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">下次執行時間</span>
              <span className="text-sm text-foreground">{formatDate(schedulerStatus.nextRunTime)}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            系統每週一上午 9:00（澳洲東部時間）自動執行全品類爬蟲任務
          </p>
        </CardContent>
      </Card>

      {/* Manual Trigger */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" />
            手動觸發爬蟲
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            選擇要爬取的品類，或一次爬取所有追蹤中的產品。爬蟲任務在背景執行，請稍後查看結果。
          </p>

          {/* Test Mode */}
          <div className="mb-4 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-300">✨ 測試模式</p>
                <p className="text-xs text-blue-400/70 mt-0.5">只爬取第一個品類第 1 頁（約 20 個產品），快速驗證爬蟲是否正常運作</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 ml-4"
                disabled={triggerCrawl.isPending || isCrawling}
                onClick={() => triggerCrawl.mutate({ testMode: true })}
              >
                {triggerCrawl.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                啟動測試
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {CRAWL_CATEGORIES.map((cat) => (
              <Button
                key={cat.value}
                variant="outline"
                size="sm"
                className="gap-2 border-border hover:border-primary/50"
                disabled={triggerCrawl.isPending || isCrawling}
                onClick={() => triggerCrawl.mutate({ category: cat.value })}
              >
                {triggerCrawl.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {cat.label}
              </Button>
            ))}
          </div>
          {isCrawling && (
            <p className="text-xs text-yellow-400/70 mt-3 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              爬蟲執行中，請先停止後再啟動新任務
            </p>
          )}
        </CardContent>
      </Card>

      {/* Job History */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">爬蟲任務歷史</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetchJobs()} className="gap-2 text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {jobsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !jobs || jobs.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              尚無爬蟲任務記錄
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">任務 ID</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">類型</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">品類</th>
                    <th className="text-center px-4 py-3 text-muted-foreground font-medium">狀態</th>
                    <th className="text-right px-4 py-3 text-muted-foreground font-medium">爬取/失敗</th>
                    <th className="text-right px-4 py-3 text-muted-foreground font-medium">開始時間</th>
                    <th className="text-right px-4 py-3 text-muted-foreground font-medium">完成時間</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b border-border/50 hover:bg-secondary/20">
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">#{job.id}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs border-border">
                          {job.jobType === "scheduled" ? "自動" : "手動"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {CATEGORY_LABELS[job.category as keyof typeof CATEGORY_LABELS] ?? job.category ?? "全部"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {job.status === "running" ? (
                            <Loader2 className="h-3.5 w-3.5 text-yellow-400 animate-spin" />
                          ) : job.status === "completed" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                          ) : job.status === "stopped" ? (
                            <XCircle className="h-3.5 w-3.5 text-orange-400" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                          )}
                          {getStatusBadge(job.status)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs">
                        <span className="text-green-400">{job.crawledProducts ?? 0}</span>
                        <span className="text-muted-foreground mx-1">/</span>
                        <span className="text-red-400">{job.failedProducts ?? 0}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {formatDate(job.startedAt)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {job.completedAt ? formatDate(job.completedAt) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
