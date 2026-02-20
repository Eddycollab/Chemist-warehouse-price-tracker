import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  Tag,
  Bot,
  Bell,
  RefreshCw,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { CATEGORY_LABELS } from "../lib/categoryLabels";

function formatPrice(price: string | number | null | undefined): string {
  if (!price) return "N/A";
  return `$${parseFloat(String(price)).toFixed(2)}`;
}

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

function getStatusColor(status: string) {
  switch (status) {
    case "completed": return "text-green-400";
    case "running": return "text-yellow-400";
    case "failed": return "text-red-400";
    default: return "text-muted-foreground";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "completed": return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    case "running": return <Loader2 className="h-4 w-4 text-yellow-400 animate-spin" />;
    case "failed": return <AlertCircle className="h-4 w-4 text-red-400" />;
    default: return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading: statsLoading } = trpc.product.stats.useQuery();
  const { data: products } = trpc.product.list.useQuery({ isOnSale: true });
  const { data: latestJob } = trpc.crawl.latestJob.useQuery();
  const { data: notifications } = trpc.notification.list.useQuery({ limit: 5 });
  const { data: schedulerStatus } = trpc.crawl.schedulerStatus.useQuery();
  const utils = trpc.useUtils();

  const triggerCrawl = trpc.crawl.trigger.useMutation({
    onSuccess: () => {
      toast.success("爬蟲任務已啟動！請稍後查看結果。");
      utils.crawl.latestJob.invalidate();
    },
    onError: () => toast.error("啟動爬蟲失敗，請稍後再試"),
  });

  const saleProducts = products?.slice(0, 6) ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Chemist Warehouse 價格追蹤
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            即時監控澳洲藥妝特價商品，掌握最佳購物時機
          </p>
        </div>
        <Button
          onClick={() => triggerCrawl.mutate({})}
          disabled={triggerCrawl.isPending}
          className="gap-2"
        >
          {triggerCrawl.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          立即爬取
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">追蹤產品</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {statsLoading ? "..." : stats?.total ?? 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">特價商品</p>
                <p className="text-2xl font-bold text-green-400 mt-1">
                  {statsLoading ? "..." : stats?.onSale ?? 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-green-400/10 flex items-center justify-center">
                <Tag className="h-5 w-5 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">爬蟲狀態</p>
                <p className={`text-sm font-semibold mt-1 ${getStatusColor(latestJob?.status ?? "")}`}>
                  {latestJob?.status === "running" ? "執行中" :
                   latestJob?.status === "completed" ? "已完成" :
                   latestJob?.status === "failed" ? "失敗" : "待機中"}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-yellow-400/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">未讀通知</p>
                <p className="text-2xl font-bold text-red-400 mt-1">
                  {notifications?.filter(n => !n.isRead).length ?? 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-400/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sale Products */}
        <div className="lg:col-span-2">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-green-400" />
                  目前特價商品
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/products?sale=true")}
                  className="text-xs text-muted-foreground gap-1"
                >
                  查看全部 <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {saleProducts.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  目前無特價商品
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {saleProducts.map((product) => (
                    <div
                      key={product.id}
                      className="px-4 py-3 flex items-center justify-between hover:bg-secondary/30 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/products/${product.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {product.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs px-1.5 py-0 border-border text-muted-foreground">
                            {CATEGORY_LABELS[product.category as keyof typeof CATEGORY_LABELS] ?? product.category}
                          </Badge>
                          {product.brand && (
                            <span className="text-xs text-muted-foreground">{product.brand}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <p className="text-sm font-bold text-green-400">
                          {formatPrice(product.currentPrice)}
                        </p>
                        {product.originalPrice && product.originalPrice !== product.currentPrice && (
                          <p className="text-xs text-muted-foreground line-through">
                            {formatPrice(product.originalPrice)}
                          </p>
                        )}
                        {product.discountPercent && (
                          <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30 mt-0.5">
                            -{parseFloat(String(product.discountPercent)).toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Scheduler Status */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                定時排程狀態
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">排程狀態</span>
                <Badge variant={schedulerStatus?.isRunning ? "default" : "secondary"} className="text-xs">
                  {schedulerStatus?.isRunning ? "運行中" : "未啟動"}
                </Badge>
              </div>
              {schedulerStatus?.nextRunTime && (
                <div className="text-xs text-muted-foreground">
                  下次執行：{formatDate(schedulerStatus.nextRunTime)}
                </div>
              )}
              {latestJob && (
                <div className="pt-2 border-t border-border space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    {getStatusIcon(latestJob.status)}
                    <span className={getStatusColor(latestJob.status)}>
                      上次爬取：{latestJob.status === "completed" ? "成功" :
                                 latestJob.status === "failed" ? "失敗" :
                                 latestJob.status === "running" ? "執行中" : "待機"}
                    </span>
                  </div>
                  {latestJob.completedAt && (
                    <p className="text-xs text-muted-foreground pl-6">
                      {formatDate(latestJob.completedAt)}
                    </p>
                  )}
                  {latestJob.crawledProducts != null && (
                    <p className="text-xs text-muted-foreground pl-6">
                      爬取 {latestJob.crawledProducts} 個產品
                      {latestJob.failedProducts ? `，${latestJob.failedProducts} 個失敗` : ""}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Notifications */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  最新通知
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/notifications")}
                  className="text-xs text-muted-foreground h-6 px-2"
                >
                  全部
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!notifications || notifications.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">暫無通知</p>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.slice(0, 4).map((notif) => (
                    <div key={notif.id} className={`px-4 py-2.5 ${!notif.isRead ? "bg-primary/5" : ""}`}>
                      <div className="flex items-start gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${
                          notif.type === "price_drop" || notif.type === "new_sale"
                            ? "bg-green-400"
                            : "bg-yellow-400"
                        }`} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{notif.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(notif.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Stats */}
          {stats?.categories && Object.keys(stats.categories).length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">品類分佈</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(stats.categories).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}
                    </span>
                    <Badge variant="secondary" className="text-xs">{count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
