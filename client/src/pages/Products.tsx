import { useState } from "react";
import ExcelImportDialog from "@/components/ExcelImportDialog";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Search,
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  Tag,
  Package,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { CATEGORY_LABELS } from "../lib/categoryLabels";

const CATEGORIES = [
  { value: "all", label: "全部品類" },
  { value: "beauty_skincare", label: "美妝護膚" },
  { value: "adult_health", label: "成人保健" },
  { value: "childrens_health", label: "兒童保健" },
  { value: "vegan_health", label: "純素保健" },
  { value: "natural_soap", label: "天然香皂" },
  { value: "other", label: "其他" },
];

function formatPrice(price: string | number | null | undefined): string {
  if (!price) return "N/A";
  return `$${parseFloat(String(price)).toFixed(2)}`;
}

function AddProductDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    brand: "",
    url: "",
    category: "beauty_skincare" as const,
    sku: "",
  });

  const createProduct = trpc.product.create.useMutation({
    onSuccess: () => {
      toast.success("產品已成功新增！");
      setOpen(false);
      setForm({ name: "", brand: "", url: "", category: "beauty_skincare", sku: "" });
      onSuccess();
    },
    onError: (err) => toast.error(`新增失敗：${err.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          新增產品
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle>新增追蹤產品</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">產品名稱 *</Label>
            <Input
              placeholder="例：Neutrogena Hydro Boost Water Gel 50g"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-secondary border-border"
            />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">品牌</Label>
            <Input
              placeholder="例：Neutrogena"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              className="bg-secondary border-border"
            />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">Chemist Warehouse 產品頁面 URL *</Label>
            <Input
              placeholder="https://www.chemistwarehouse.com.au/buy/..."
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="bg-secondary border-border"
            />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">品類 *</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm({ ...form, category: v as typeof form.category })}
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {CATEGORIES.filter(c => c.value !== "all").map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground mb-1.5 block">SKU（選填）</Label>
            <Input
              placeholder="產品編號"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="bg-secondary border-border"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1"
              onClick={() => createProduct.mutate(form)}
              disabled={!form.name || !form.url || createProduct.isPending}
            >
              {createProduct.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              新增產品
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} className="border-border">
              取消
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Products() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [showSaleOnly, setShowSaleOnly] = useState(false);
  const [showExcelImport, setShowExcelImport] = useState(false);

  const { data: products, isLoading, refetch } = trpc.product.list.useQuery({
    category: category !== "all" ? (category as "beauty_skincare" | "adult_health" | "childrens_health" | "vegan_health" | "natural_soap" | "other") : undefined,
    isOnSale: showSaleOnly ? true : undefined,
    search: search || undefined,
  });

  const deleteProduct = trpc.product.delete.useMutation({
    onSuccess: () => {
      toast.success("產品已刪除");
      refetch();
    },
    onError: () => toast.error("刪除失敗"),
  });

  const filteredProducts = products ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            產品列表
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            管理所有追蹤中的 Chemist Warehouse 產品
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExcelImport(true)}
            className="gap-2 border-border"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel 匯入
          </Button>
          <AddProductDialog onSuccess={refetch} />
        </div>
        <ExcelImportDialog
          open={showExcelImport}
          onOpenChange={setShowExcelImport}
          onSuccess={refetch}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜尋產品名稱或品牌..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40 bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showSaleOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowSaleOnly(!showSaleOnly)}
          className={`gap-2 ${!showSaleOnly ? "border-border" : ""}`}
        >
          <Tag className="h-4 w-4" />
          僅顯示特價
        </Button>
      </div>

      {/* Product Count */}
      <p className="text-sm text-muted-foreground">
        共 {filteredProducts.length} 個產品
      </p>

      {/* Products Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>沒有找到符合條件的產品</p>
          <p className="text-sm mt-1">試試調整篩選條件，或新增要追蹤的產品</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group"
              onClick={() => setLocation(`/products/${product.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs px-1.5 py-0 border-border shrink-0">
                        {CATEGORY_LABELS[product.category] ?? product.category}
                      </Badge>
                      {product.isOnSale && (
                        <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30 shrink-0">
                          特價
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                      {product.name}
                    </h3>
                    {product.brand && (
                      <p className="text-xs text-muted-foreground mt-1">{product.brand}</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-lg font-bold text-foreground">
                      {formatPrice(product.currentPrice)}
                    </p>
                    {product.originalPrice &&
                      parseFloat(String(product.originalPrice)) > parseFloat(String(product.currentPrice ?? 0)) && (
                      <p className="text-xs text-muted-foreground line-through">
                        {formatPrice(product.originalPrice)}
                      </p>
                    )}
                    {product.discountPercent && (
                      <Badge className="text-xs bg-red-500/20 text-red-400 border-red-500/30 mt-1">
                        省 {parseFloat(String(product.discountPercent)).toFixed(0)}%
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(product.url, "_blank");
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`確定要刪除「${product.name}」嗎？`)) {
                          deleteProduct.mutate({ id: product.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {product.lastCrawledAt && (
                  <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">
                    最後更新：{new Date(product.lastCrawledAt).toLocaleDateString("zh-TW")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
