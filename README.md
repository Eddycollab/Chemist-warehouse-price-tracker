# Chemist Warehouse 價格追蹤系統

一個自動化的 Chemist Warehouse 產品價格追蹤系統，具備每週定時爬蟲、價格變動通知、以及深色主題的網頁儀表板。

## 功能特色

- **自動爬蟲**：每週一上午 9:00（澳洲東部時間）自動爬取所有追蹤產品的最新價格
- **手動觸發**：可隨時手動觸發全品類或特定品類的爬蟲任務
- **價格追蹤**：完整記錄每次爬取的價格歷史，支援折線圖視覺化
- **特價通知**：當商品開始特價、價格下降或上漲時自動發送通知
- **產品管理**：可自行新增、編輯、刪除要追蹤的產品
- **深色主題**：採用 Nord 配色方案的專業深色儀表板

## 支援品類

| 品類 | 說明 |
|------|------|
| 美妝護膚 | 護膚品、彩妝、防曬等 |
| 成人保健 | 維生素、礦物質、保健食品 |
| 兒童保健 | 兒童維生素、益生菌等 |
| 純素保健 | 純素認證的保健品 |
| 天然香皂 | 天然有機香皂與沐浴品 |

## 技術架構

```
前端：React 19 + Tailwind CSS 4 + shadcn/ui + Recharts
後端：Express 4 + tRPC 11 + Drizzle ORM
資料庫：MySQL（Railway 部署）
爬蟲：Axios + HTML 解析
排程：Node.js setTimeout（每週執行）
部署：Railway
```

## 快速開始

### 本地開發

1. 複製專案：
```bash
git clone <your-repo-url>
cd chemist_warehouse_crawler
```

2. 安裝依賴：
```bash
pnpm install
```

3. 設定環境變數（複製 `.env.example` 為 `.env`）：
```bash
cp .env.example .env
```

4. 設定資料庫並執行 Migration：
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

5. 啟動開發伺服器：
```bash
pnpm dev
```

### Railway 部署

1. 在 [Railway](https://railway.app) 建立新專案
2. 連接 GitHub Repository
3. 新增 MySQL 資料庫服務
4. 設定以下環境變數：
   - `DATABASE_URL`：MySQL 連接字串（Railway 自動提供）
   - `JWT_SECRET`：JWT 簽名密鑰
   - `NODE_ENV`：`production`

5. Railway 會自動偵測 `nixpacks.toml` 並執行建置

## 新增追蹤產品

1. 前往 Chemist Warehouse 網站找到要追蹤的產品頁面
2. 複製產品頁面 URL
3. 在系統的「產品列表」頁面點擊「新增產品」
4. 填入產品名稱、品牌、URL 和品類
5. 點擊「新增產品」完成

## 爬蟲工作原理

爬蟲優先使用頁面中的 JSON-LD 結構化資料（`application/ld+json`）提取價格資訊，若無法取得則退回 HTML 正則表達式解析。每次請求之間有 2 秒的延遲，以避免對目標網站造成過大負擔。

## 通知類型

| 類型 | 觸發條件 |
|------|----------|
| 特價開始 | 商品從正常價格變為特價 |
| 特價結束 | 商品從特價恢復正常價格 |
| 價格下降 | 價格下降幅度超過設定門檻（預設 5%） |
| 價格上漲 | 價格上漲幅度超過設定門檻（預設 10%） |

## 免責聲明

本系統僅供個人學習與研究使用。爬蟲行為已實施速率限制，請遵守 Chemist Warehouse 網站的使用條款（[Terms of Use](https://www.chemistwarehouse.com.au/info/terms-of-use)）。請勿將本系統用於商業目的。
