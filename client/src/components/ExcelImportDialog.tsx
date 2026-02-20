import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface PreviewRow {
  name: string;
  url: string;
  brand: string;
  category: string;
  sku: string;
  valid: boolean;
  error?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  beauty_skincare: "美妝護膚",
  adult_health: "成人保健",
  childrens_health: "兒童保健",
  vegan_health: "純素保健",
  natural_soap: "天然香皂",
  other: "其他",
};

function generateTemplate() {
  const wb = XLSX.utils.book_new();
  const data = [
    ["商品名稱", "商品連結", "品牌", "品類", "SKU"],
    [
      "Swisse Ultiboost Vitamin C 1000mg 120錠",
      "https://www.chemistwarehouse.com.au/buy/12345/swisse-vitamin-c",
      "Swisse",
      "adult_health",
      "SW001",
    ],
    [
      "Neutrogena 深層清潔洗面乳",
      "https://www.chemistwarehouse.com.au/buy/67890/neutrogena-cleanser",
      "Neutrogena",
      "beauty_skincare",
      "",
    ],
    [
      "Blackmores Bio C 1000mg 150錠",
      "https://www.chemistwarehouse.com.au/buy/11111/blackmores-bio-c",
      "Blackmores",
      "adult_health",
      "BM001",
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  // Set column widths
  ws["!cols"] = [
    { wch: 45 },
    { wch: 60 },
    { wch: 15 },
    { wch: 18 },
    { wch: 12 },
  ];
  // Add note sheet
  const noteData = [
    ["品類代碼說明"],
    ["beauty_skincare", "美妝護膚"],
    ["adult_health", "成人保健"],
    ["childrens_health", "兒童保健"],
    ["vegan_health", "純素保健"],
    ["natural_soap", "天然香皂"],
    ["other", "其他"],
  ];
  const wsNote = XLSX.utils.aoa_to_sheet(noteData);
  wsNote["!cols"] = [{ wch: 20 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws, "產品清單");
  XLSX.utils.book_append_sheet(wb, wsNote, "品類代碼說明");
  XLSX.writeFile(wb, "CW產品匯入範本.xlsx");
}

function parsePreview(file: File): Promise<PreviewRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) {
          reject(new Error("Excel 檔案為空"));
          return;
        }
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: "",
        });
        const preview: PreviewRow[] = rows.slice(0, 100).map((row) => {
          const name = String(
            row["name"] ?? row["商品名稱"] ?? row["名稱"] ?? ""
          ).trim();
          const url = String(
            row["url"] ?? row["URL"] ?? row["商品連結"] ?? row["連結"] ?? ""
          ).trim();
          const brand = String(row["brand"] ?? row["品牌"] ?? "").trim();
          const category = String(
            row["category"] ?? row["品類"] ?? row["分類"] ?? ""
          ).trim();
          const sku = String(row["sku"] ?? row["SKU"] ?? "").trim();

          let valid = true;
          let error: string | undefined;
          if (!name) {
            valid = false;
            error = "商品名稱為空";
          } else if (!url || !url.startsWith("http")) {
            valid = false;
            error = "URL 格式不正確";
          }

          return { name, url, brand, category, sku, valid, error };
        });
        resolve(preview);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("讀取檔案失敗"));
    reader.readAsBinaryString(file);
  });
}

export default function ExcelImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: ExcelImportDialogProps) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = trpc.product.importFromExcel.useMutation({
    onSuccess: (result) => {
      setImportResult(result);
      if (result.success > 0) {
        toast.success(`成功匯入 ${result.success} 個產品！`);
        onSuccess?.();
      }
    },
    onError: (err) => {
      toast.error(`匯入失敗：${err.message}`);
    },
  });

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      setParseError("請上傳 .xlsx 或 .xls 格式的 Excel 檔案");
      return;
    }
    setFile(f);
    setParseError("");
    setImportResult(null);
    setIsParsing(true);
    try {
      const rows = await parsePreview(f);
      setPreview(rows);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "解析失敗");
      setPreview([]);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleImport = async () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      if (!base64) return;
      importMutation.mutate({ fileBase64: base64, fileName: file.name });
    };
    reader.readAsDataURL(file);
  };

  const reset = () => {
    setFile(null);
    setPreview([]);
    setParseError("");
    setImportResult(null);
  };

  const validCount = preview.filter((r) => r.valid).length;
  const invalidCount = preview.filter((r) => !r.valid).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-3xl bg-card border-border max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Excel 批次匯入產品
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            上傳 Excel 檔案批次新增追蹤產品。支援 .xlsx 和 .xls 格式。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Download Template */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
            <div className="text-sm text-muted-foreground">
              尚未有範本？下載範本後填寫再上傳。
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={generateTemplate}
              className="gap-2 shrink-0"
            >
              <Download className="h-4 w-4" />
              下載範本
            </Button>
          </div>

          {/* Drop Zone */}
          {!file && (
            <div
              className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-secondary/30"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">
                拖曳 Excel 檔案到此處，或點擊選擇檔案
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                支援 .xlsx、.xls 格式，最多 100 筆資料
              </p>
            </div>
          )}

          {/* Parsing */}
          {isParsing && (
            <div className="flex items-center justify-center py-8 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">解析中...</span>
            </div>
          )}

          {/* Parse Error */}
          {parseError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {parseError}
            </div>
          )}

          {/* File Info + Preview */}
          {file && !isParsing && preview.length > 0 && !importResult && (
            <div className="space-y-3">
              {/* File info bar */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-2 text-sm">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">{file.name}</span>
                  <span className="text-muted-foreground">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {validCount} 筆有效
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">
                      <XCircle className="h-3 w-3 mr-1" />
                      {invalidCount} 筆錯誤
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={reset}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-secondary/80 border-b border-border">
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium w-8">#</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium min-w-[180px]">商品名稱</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium min-w-[80px]">品牌</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium min-w-[90px]">品類</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium min-w-[60px]">SKU</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium w-20">狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr
                          key={i}
                          className={`border-b border-border last:border-0 ${
                            row.valid ? "" : "bg-destructive/5"
                          }`}
                        >
                          <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-2 text-foreground max-w-[200px] truncate" title={row.name}>
                            {row.name || <span className="text-muted-foreground italic">（空）</span>}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{row.brand || "—"}</td>
                          <td className="px-3 py-2">
                            {row.category ? (
                              <span className="text-primary text-xs">
                                {CATEGORY_LABELS[row.category] ?? row.category}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">美妝護膚</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{row.sku || "—"}</td>
                          <td className="px-3 py-2">
                            {row.valid ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <span className="text-destructive text-xs" title={row.error}>
                                <XCircle className="h-3.5 w-3.5 inline mr-1" />
                                {row.error}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {preview.length >= 100 && (
                <p className="text-xs text-muted-foreground text-center">
                  僅顯示前 100 筆預覽，實際匯入將處理全部資料
                </p>
              )}
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="space-y-3">
              <div className={`p-4 rounded-lg border ${
                importResult.failed === 0
                  ? "bg-emerald-400/10 border-emerald-400/20"
                  : "bg-amber-400/10 border-amber-400/20"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="font-medium text-foreground">匯入完成</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-emerald-400">✓ 成功：{importResult.success} 筆</span>
                  {importResult.failed > 0 && (
                    <span className="text-destructive">✗ 失敗：{importResult.failed} 筆</span>
                  )}
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs font-medium text-destructive mb-2">錯誤詳情：</p>
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => { onOpenChange(false); reset(); }}
          >
            {importResult ? "關閉" : "取消"}
          </Button>
          {file && preview.length > 0 && !importResult && (
            <Button
              onClick={handleImport}
              disabled={importMutation.isPending || validCount === 0}
              className="gap-2"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  匯入中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  確認匯入 {validCount} 筆產品
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
