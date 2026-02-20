import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, CheckCheck, TrendingDown, TrendingUp, Tag, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { NOTIFICATION_TYPE_LABELS } from "../lib/categoryLabels";

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleString("zh-TW", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "price_drop": return <TrendingDown className="h-4 w-4 text-green-400" />;
    case "price_increase": return <TrendingUp className="h-4 w-4 text-red-400" />;
    case "new_sale": return <Tag className="h-4 w-4 text-yellow-400" />;
    case "sale_ended": return <X className="h-4 w-4 text-muted-foreground" />;
    default: return <Bell className="h-4 w-4 text-primary" />;
  }
}

function getNotificationColor(type: string) {
  switch (type) {
    case "price_drop": return "border-l-green-400";
    case "price_increase": return "border-l-red-400";
    case "new_sale": return "border-l-yellow-400";
    case "sale_ended": return "border-l-muted-foreground";
    default: return "border-l-primary";
  }
}

export default function Notifications() {
  const { data: notifications, isLoading, refetch } = trpc.notification.list.useQuery({ limit: 100 });
  const { data: unreadData } = trpc.notification.unreadCount.useQuery();
  const utils = trpc.useUtils();

  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });

  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      toast.success("已標記全部通知為已讀");
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });

  const unreadCount = unreadData?.count ?? 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            通知中心
            {unreadCount > 0 && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                {unreadCount} 未讀
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            價格變動與特價商品通知記錄
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="gap-2 border-border"
          >
            <CheckCheck className="h-4 w-4" />
            全部標為已讀
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">通知記錄</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>暫無通知記錄</p>
              <p className="text-sm mt-1">當偵測到價格變動或特價商品時，通知將顯示在此處</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`px-4 py-4 border-l-2 transition-colors ${getNotificationColor(notif.type)} ${
                    !notif.isRead ? "bg-primary/5" : "hover:bg-secondary/20"
                  } cursor-pointer`}
                  onClick={() => {
                    if (!notif.isRead) markRead.mutate({ id: notif.id });
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">{notif.title}</p>
                            <Badge variant="outline" className="text-xs border-border px-1.5 py-0">
                              {NOTIFICATION_TYPE_LABELS[notif.type] ?? notif.type}
                            </Badge>
                            {!notif.isRead && (
                              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{notif.message}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-2">
                        {notif.oldPrice && notif.newPrice && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground line-through">
                              ${parseFloat(notif.oldPrice).toFixed(2)}
                            </span>
                            <span className="text-foreground">→</span>
                            <span className={
                              parseFloat(notif.newPrice) < parseFloat(notif.oldPrice)
                                ? "text-green-400 font-semibold"
                                : "text-red-400 font-semibold"
                            }>
                              ${parseFloat(notif.newPrice).toFixed(2)}
                            </span>
                            {notif.changePercent && Math.abs(parseFloat(notif.changePercent)) > 0 && (
                              <Badge className={`text-xs ${
                                parseFloat(notif.changePercent) < 0
                                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                                  : "bg-red-500/20 text-red-400 border-red-500/30"
                              }`}>
                                {parseFloat(notif.changePercent) < 0 ? "" : "+"}
                                {parseFloat(notif.changePercent).toFixed(1)}%
                              </Badge>
                            )}
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDate(notif.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
