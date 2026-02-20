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
