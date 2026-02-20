import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { ArrowLeft, ExternalLink, TrendingDown, TrendingUp, Loader2, RefreshCw } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { CATEGORY_LABELS } from "../lib/categoryLabels";
import { useState } from "react";

function formatPrice(price: string | number | null | undefined): string {
  if (!price) return "N/A";
  return `$${parseFloat(String(price)).toFixed(2)}`;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="text-sm font-semibold text-foreground">
            ${entry.value.toFixed(2)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ProductDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [days, setDays] = useState(30);
  const productId = parseInt(params.id ?? "0");

  const { data: product, isLoading } = trpc.product.byId.useQuery({ id: productId });
  const { data: history } = trpc.priceHistory.byProduct.useQuery({ productId, days });
  const utils = trpc.useUtils();

  const triggerCrawl = trpc.crawl.trigger.useMutation({
    onSuccess: () => {
      toast.success("已觸發此產品的價格更新！");
      setTimeout(() => {
        utils.product.byId.invalidate({ id: productId });
        utils.priceHistory.byProduct.invalidate({ productId, days });
      }, 3000);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">找不到此產品</p>
        <Button variant="ghost" onClick={() => setLocation("/products")} className="mt-4">
          返回產品列表
        </Button>
      </div>
    );
  }

  const chartData = history?.map((h) => ({
    date: new Date(h.crawledAt).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" }),
    price: parseFloat(String(h.price)),
    originalPrice: h.originalPrice ? parseFloat(String(h.originalPrice)) : null,
  })) ?? [];

  const currentPrice = product.currentPrice ? parseFloat(String(product.currentPrice)) : null;
  const originalPrice = product.originalPrice ? parseFloat(String(product.originalPrice)) : null;
  const savings = currentPrice && originalPrice && originalPrice > currentPrice
    ? originalPrice - currentPrice
    : null;

  const priceMin = chartData.length > 0 ? Math.min(...chartData.map(d => d.price)) : 0;
  const priceMax = chartData.length > 0 ? Math.max(...chartData.map(d => d.price)) : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocation("/products")}
        className="gap-2 text-muted-foreground -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        返回產品列表
      </Button>

      {/* Product Header */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="outline" className="border-border text-muted-foreground">
              {CATEGORY_LABELS[product.category] ?? product.category}
            </Badge>
            {product.isOnSale && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                特價中
              </Badge>
            )}
          </div>
          <h1 className="text-xl font-bold text-foreground">{product.name}</h1>
          {product.brand && (
            <p className="text-muted-foreground text-sm mt-1">{product.brand}</p>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(product.url, "_blank")}
            className="gap-2 border-border"
          >
            <ExternalLink className="h-4 w-4" />
            在 CW 查看
          </Button>
          <Button
            size="sm"
            onClick={() => triggerCrawl.mutate({ productIds: [product.id] })}
            disabled={triggerCrawl.isPending}
            className="gap-2"
          >
            {triggerCrawl.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            更新價格
          </Button>
        </div>
      </div>

      {/* Price Info Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">目前售價</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {formatPrice(product.currentPrice)}
            </p>
          </CardContent>
        </Card>

        {originalPrice && originalPrice !== currentPrice && (
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">原始售價</p>
              <p className="text-2xl font-bold text-muted-foreground mt-1 line-through">
                {formatPrice(product.originalPrice)}
              </p>
            </CardContent>
          </Card>
        )}

        {savings && (
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">節省金額</p>
              <p className="text-2xl font-bold text-green-400 mt-1 flex items-center gap-1">
                <TrendingDown className="h-5 w-5" />
                ${savings.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        )}

        {product.discountPercent && (
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">折扣幅度</p>
              <p className="text-2xl font-bold text-red-400 mt-1">
                -{parseFloat(String(product.discountPercent)).toFixed(0)}%
              </p>
            </CardContent>
          </Card>
        )}

        {chartData.length > 0 && (
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">歷史最低</p>
              <p className="text-2xl font-bold text-primary mt-1">
                ${priceMin.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Price History Chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">價格歷史趨勢</CardTitle>
            <div className="flex gap-2">
              {[7, 14, 30, 90].map((d) => (
                <Button
                  key={d}
                  variant={days === d ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setDays(d)}
                  className="h-7 px-2 text-xs"
                >
                  {d}天
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              此時間範圍內無價格記錄
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.02 240)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "oklch(0.60 0.02 240)", fontSize: 11 }}
                  axisLine={{ stroke: "oklch(0.30 0.02 240)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "oklch(0.60 0.02 240)", fontSize: 11 }}
                  axisLine={{ stroke: "oklch(0.30 0.02 240)" }}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={<CustomTooltip />} />
                {currentPrice && (
                  <ReferenceLine
                    y={currentPrice}
                    stroke="oklch(0.72 0.10 205)"
                    strokeDasharray="4 4"
                    label={{ value: "目前", fill: "oklch(0.72 0.10 205)", fontSize: 11 }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="oklch(0.72 0.10 205)"
                  strokeWidth={2}
                  dot={{ fill: "oklch(0.72 0.10 205)", r: 3 }}
                  activeDot={{ r: 5 }}
                  name="售價"
                />
                {chartData.some(d => d.originalPrice) && (
                  <Line
                    type="monotone"
                    dataKey="originalPrice"
                    stroke="oklch(0.60 0.02 240)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    name="原價"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Price History Table */}
      {history && history.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold">價格記錄明細</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">日期</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">售價</th>
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">原價</th>
                    <th className="text-center px-4 py-2.5 text-muted-foreground font-medium">狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map((record) => (
                    <tr key={record.id} className="border-b border-border/50 hover:bg-secondary/20">
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {new Date(record.crawledAt).toLocaleString("zh-TW", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-foreground">
                        {formatPrice(record.price)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {record.originalPrice ? formatPrice(record.originalPrice) : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {record.isOnSale ? (
                          <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                            特價
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            正常
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
