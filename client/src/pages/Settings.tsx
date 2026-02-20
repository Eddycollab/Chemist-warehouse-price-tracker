import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Save, Loader2, Lock, Eye, EyeOff, LogOut } from "lucide-react";
import { toast } from "sonner";
import { usePassword } from "@/contexts/PasswordContext";

interface SettingItem {
  key: string;
  value: string;
  label: string;
  description: string;
  type: "text" | "number" | "boolean";
  min?: number;
  max?: number;
}

const SETTING_DEFINITIONS: SettingItem[] = [
  {
    key: "price_drop_threshold",
    value: "5",
    label: "價格下降通知門檻 (%)",
    description: "當價格下降超過此百分比時，發送通知",
    type: "number",
    min: 1,
    max: 100,
  },
  {
    key: "price_increase_threshold",
    value: "10",
    label: "價格上漲通知門檻 (%)",
    description: "當價格上漲超過此百分比時，發送通知",
    type: "number",
    min: 1,
    max: 100,
  },
  {
    key: "notify_on_sale",
    value: "true",
    label: "特價開始通知",
    description: "當商品開始特價時，發送通知",
    type: "boolean",
  },
  {
    key: "crawl_delay_ms",
    value: "2000",
    label: "爬蟲請求間隔 (毫秒)",
    description: "每次請求之間的等待時間，避免對目標網站造成過大負擔",
    type: "number",
    min: 500,
    max: 10000,
  },
];

export default function SettingsPage() {
  const { logout } = usePassword();
  const { data: settingsData, isLoading } = trpc.settings.list.useQuery();
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdError, setPwdError] = useState("");

  const updateSetting = trpc.settings.update.useMutation({
    onSuccess: () => {},
    onError: (err) => toast.error(`更新失敗：${err.message}`),
  });

  useEffect(() => {
    if (settingsData) {
      const map: Record<string, string> = {};
      settingsData.forEach((s) => (map[s.key] = s.value));
      SETTING_DEFINITIONS.forEach((def) => {
        if (!map[def.key]) map[def.key] = def.value;
      });
      setLocalSettings(map);
    }
  }, [settingsData]);

  const handleChange = (key: string, value: string) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    const updates = Object.entries(localSettings).map(([key, value]) =>
      updateSetting.mutateAsync({ key, value })
    );
    try {
      await Promise.all(updates);
      toast.success("設定已儲存！");
      setHasChanges(false);
    } catch {
      // Individual errors handled above
    }
  };

  const handlePasswordChange = async () => {
    setPwdError("");
    if (!newPassword.trim()) {
      setPwdError("請輸入新密碼");
      return;
    }
    if (newPassword.length < 4) {
      setPwdError("密碼至少需要 4 個字元");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError("兩次輸入的密碼不一致");
      return;
    }
    try {
      await updateSetting.mutateAsync({ key: "access_password", value: newPassword });
      toast.success("密碼已更新！下次訪問時需使用新密碼");
      setNewPassword("");
      setConfirmPassword("");
      // Force re-login with new password
      setTimeout(() => {
        logout();
      }, 1500);
    } catch {
      setPwdError("密碼更新失敗，請稍後再試");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-primary" />
            系統設定
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            調整爬蟲行為、通知偏好與訪問安全設定
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateSetting.isPending}
          className="gap-2"
        >
          {updateSetting.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          儲存設定
        </Button>
      </div>

      {/* Access Password */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            訪問密碼
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            修改儀表板的訪問密碼。更新後將自動登出，需使用新密碼重新登入。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">新密碼</Label>
            <div className="relative">
              <Input
                type={showNewPwd ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPwdError("");
                }}
                placeholder="輸入新密碼（至少 4 個字元）"
                className="pr-10 bg-background border-border"
              />
              <button
                type="button"
                onClick={() => setShowNewPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">確認新密碼</Label>
            <div className="relative">
              <Input
                type={showConfirmPwd ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPwdError("");
                }}
                placeholder="再次輸入新密碼"
                className={`pr-10 bg-background border-border ${
                  pwdError ? "border-destructive" : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showConfirmPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {pwdError && (
              <p className="text-xs text-destructive">{pwdError}</p>
            )}
          </div>

          <Button
            onClick={handlePasswordChange}
            disabled={!newPassword || !confirmPassword || updateSetting.isPending}
            variant="outline"
            className="gap-2"
          >
            {updateSetting.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            更新密碼
          </Button>

          <div className="pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="gap-2 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              登出系統
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold">通知設定</CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            設定何時發送價格變動通知
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {SETTING_DEFINITIONS.filter(s => s.key.includes("notify") || s.key.includes("threshold")).map((setting) => (
            <div key={setting.key} className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Label className="text-sm font-medium text-foreground">{setting.label}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
              </div>
              {setting.type === "boolean" ? (
                <Switch
                  checked={localSettings[setting.key] === "true"}
                  onCheckedChange={(checked) => handleChange(setting.key, String(checked))}
                />
              ) : (
                <Input
                  type="number"
                  min={setting.min}
                  max={setting.max}
                  value={localSettings[setting.key] ?? setting.value}
                  onChange={(e) => handleChange(setting.key, e.target.value)}
                  className="w-24 bg-secondary border-border text-right"
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Crawler Settings */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold">爬蟲設定</CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            調整爬蟲的請求行為與速率限制
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {SETTING_DEFINITIONS.filter(s => s.key.includes("delay") || s.key.includes("agent")).map((setting) => (
            <div key={setting.key} className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Label className="text-sm font-medium text-foreground">{setting.label}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
              </div>
              <Input
                type="number"
                min={setting.min}
                max={setting.max}
                value={localSettings[setting.key] ?? setting.value}
                onChange={(e) => handleChange(setting.key, e.target.value)}
                className="w-28 bg-secondary border-border text-right"
              />
            </div>
          ))}

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">User Agent</Label>
            <p className="text-xs text-muted-foreground">爬蟲使用的瀏覽器識別字串</p>
            <Input
              value={localSettings["user_agent"] ?? ""}
              onChange={(e) => handleChange("user_agent", e.target.value)}
              className="bg-secondary border-border font-mono text-xs"
              placeholder="Mozilla/5.0 ..."
            />
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold">關於系統</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>系統版本</span>
            <span className="text-foreground">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span>目標網站</span>
            <a
              href="https://www.chemistwarehouse.com.au"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              chemistwarehouse.com.au
            </a>
          </div>
          <div className="flex justify-between">
            <span>排程頻率</span>
            <span className="text-foreground">每週一 09:00 AEST</span>
          </div>
          <p className="text-xs mt-3 pt-3 border-t border-border">
            本系統僅供個人學習與研究使用。爬蟲行為已實施速率限制，請遵守目標網站的使用條款。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
