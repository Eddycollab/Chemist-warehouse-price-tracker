# Chemist Warehouse 價格追蹤系統 TODO

## 資料庫 Schema
- [x] 建立 products 表（產品資訊）
- [x] 建立 price_history 表（價格歷史記錄）
- [x] 建立 crawl_jobs 表（爬蟲任務設定）
- [x] 建立 notifications 表（通知歷史）
- [x] 執行資料庫 migration

## 後端 API
- [x] 建立爬蟲核心模組（Chemist Warehouse 爬蟲，JSON-LD + HTML 解析）
- [x] 建立產品管理 tRPC 路由（CRUD）
- [x] 建立價格歷史查詢路由
- [x] 建立爬蟲任務管理路由
- [x] 建立通知歷史路由
- [x] 建立手動觸發爬蟲路由
- [x] 建立定時任務系統（每週一 9:00 AEST 自動執行）
- [x] 建立價格變化偵測與通知機制
- [x] 建立品類管理（美妝護膚、成人保健、兒童保健、純素保健、天然香皂）

## 前端儀表板
- [x] 設定深色主題（Nord 配色方案，OKLCH 色彩空間）
- [x] 建立 DashboardLayout 側邊欄導航
- [x] 建立首頁概覽（統計卡片、最新特價商品、排程狀態）
- [x] 建立產品列表頁面（含搜尋、篩選、分類標籤）
- [x] 建立產品詳情頁面（價格歷史折線圖、記錄明細）
- [x] 建立爬蟲管理頁面（手動觸發、任務歷史）
- [x] 建立通知歷史頁面（標記已讀、類型圖示）
- [x] 建立系統設定頁面（通知門檻、爬蟲設定）
- [x] 實作價格趨勢圖表（Recharts LineChart）
- [x] 建立特價商品高亮顯示（折扣百分比 Badge）

## 部署配置
- [x] 建立 railway.json 部署配置
- [x] 建立 nixpacks.toml 建置配置
- [x] 建立 README.md 完整使用說明（含 Railway 部署步驟）
- [ ] 建立 GitHub Repository 並推送代碼（需手動操作，Token 權限限制）

## 測試
- [x] 撰寫爬蟲邏輯單元測試（10 tests passed）
- [x] 撰寫 tRPC 路由測試（product, notification, crawl, settings）
- [x] 原有 auth.logout 測試通過

## 移除登入限制（固定網址直接訪問）
- [x] 移除 DashboardLayout 的登入牆（不再要求 Manus OAuth）
- [x] 移除側邊欄底部的用戶資訊顯示，改為通知未讀數量 Badge
- [x] 確保所有 tRPC 路由改為 publicProcedure（不需要 protectedProcedure）
- [x] 測試所有頁面無需登入即可訪問（10 tests passed）

## 簡單密碼保護功能
- [x] 後端：在 crawler_settings 加入 access_password 設定（預設 cw2024）
- [x] 後端：建立 access.verify 和 access.hasPassword tRPC 路由
- [x] 前端：建立 PasswordContext（管理已驗證狀態，儲存至 localStorage，7 天有效期）
- [x] 前端：建立密碼登入頁面（Nord 深色主題，CW Logo 風格）
- [x] 前端：在 App.tsx 包裝密碼保護邏輯
- [x] 系統設定：加入密碼修改功能（輸入新密碼並確認）與登出按鈕

## 密碼修改 + Excel 匯入 + Railway 部署指南
- [x] 修改資料庫預設密碼為 CW150721
- [x] 修改後端 fallback 密碼為 CW150721
- [x] 安裝 xlsx 套件（解析 Excel 檔案）
- [x] 後端：建立 product.importFromExcel tRPC 路由
- [x] 前端：建立 Excel 匯入 UI（拖曳上傳、欄位預覽、確認匯入）
- [x] 提供 Excel 範本下載功能
- [x] 撰寫完整 Railway 部署指南（RAILWAY_DEPLOY.md）

## 停止爬取功能
- [x] 後端：在 crawler.ts 加入全域停止旗標（isCrawlStopped）
- [x] 後端：在爬蟲主迴圈各關鍵點檢查停止旗標
- [x] 後端：在 routers.ts 加入 crawl.stop tRPC mutation
- [x] 前端：在 CrawlerManager.tsx 加入「停止爬取」按鈕（執行中才顯示）
- [x] 前端：停止後更新任務狀態顯示

## 修復爬蟲狀態卡住問題
- [x] 後端 db.ts：加入 resetStuckJobs() 函式，將 running 狀態的任務改為 stopped
- [x] 後端 server startup：啟動時自動呼叫 resetStuckJobs()（處理 Railway 重啟後殘留的 running 任務）
- [x] 後端 routers.ts：加入 crawl.resetStuck mutation（手動重置）
- [x] 前端 CrawlerManager.tsx：加入「重置卡住任務」按鈕（當有 running 任務但 isRunning=false 時顯示）

## 爬蟲反偵測強化
- [x] 安裝 playwright-extra + puppeteer-extra-plugin-stealth
- [x] 改用 stealth chromium 啟動
- [x] 加入隨機延遲（1-4 秒）
- [x] Cookie 持久化（保存 session）
- [x] 加入更多反偵測措施（隨機 viewport、滑鼠移動模擬）
- [x] 更新 nixpacks.toml 確保 Railway 部署包含新依賴

## 修復爬蟲選擇器（CW HTML 結構不符）
- [x] 檢查 CW 網站實際 HTML 結構
- [x] 修正產品卡片選擇器
- [x] 修正價格選擇器
- [x] 修正 browserContext 關閉錯誤（每個品類使用獨立 context）
