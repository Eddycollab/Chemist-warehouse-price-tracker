import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bot,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
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
  const utils = trpc.useUtils();

  const triggerCrawl = trpc.crawl.trigger.useMutation({
    onSuccess: (_, vars) => {
      const catLabel = vars?.category
        ? (CATEGORY_LABELS[vars.category] ?? vars.category)
        : "全部品類";
      toast.success(`已啟動爬蟲任務（${catLabel}）！`);
      setTimeout(() => {
        refetchJobs();
        utils.crawl.latestJob.invalidate();
      }, 2000);
    },
    onError: () => toast.error("啟動爬蟲失敗"),
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
          <div className="flex flex-wrap gap-2">
            {CRAWL_CATEGORIES.map((cat) => (
              <Button
                key={cat.value}
                variant="outline"
                size="sm"
                className="gap-2 border-border hover:border-primary/50"
                disabled={triggerCrawl.isPending}
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
