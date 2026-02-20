import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { usePassword } from "@/contexts/PasswordContext";
import { TrendingDown, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PasswordGate() {
  const { verify } = usePassword();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const verifyMutation = trpc.access.verify.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        verify();
      } else {
        setError(data.error ?? "密碼錯誤，請重試");
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setPassword("");
        inputRef.current?.focus();
      }
    },
    onError: () => {
      setError("連線錯誤，請稍後再試");
    },
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("請輸入密碼");
      return;
    }
    setError("");
    verifyMutation.mutate({ password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Background subtle grid */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-transparent" />

          <div className="p-8">
            {/* Logo */}
            <div className="flex flex-col items-center gap-3 mb-8">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <TrendingDown className="h-7 w-7 text-primary" />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  CW 價格追蹤
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Chemist Warehouse 價格監控系統
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  訪問密碼
                </label>
                <div
                  className={`relative transition-transform duration-100 ${
                    shake ? "animate-[shake_0.4s_ease-in-out]" : ""
                  }`}
                >
                  <Input
                    ref={inputRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="請輸入密碼"
                    className={`pr-10 bg-background border-border focus-visible:ring-primary ${
                      error ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                    disabled={verifyMutation.isPending}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmit(e as unknown as React.FormEvent);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {error && (
                  <p className="text-xs text-destructive flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                    <span className="h-1 w-1 rounded-full bg-destructive shrink-0" />
                    {error}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={verifyMutation.isPending || !password.trim()}
              >
                {verifyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    驗證中...
                  </>
                ) : (
                  "進入系統"
                )}
              </Button>
            </form>

            {/* Footer hint */}
            <p className="text-center text-xs text-muted-foreground mt-6">
              驗證後 7 天內無需重新輸入密碼
            </p>
          </div>
        </div>

        {/* Bottom label */}
        <p className="text-center text-xs text-muted-foreground/40 mt-4">
          CW Price Tracker · 僅供內部使用
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
