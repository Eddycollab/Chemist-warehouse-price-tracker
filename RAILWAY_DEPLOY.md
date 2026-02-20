# Railway 部署指南

本文件說明如何將 **CW 價格追蹤系統**部署至 [Railway](https://railway.app/) 平台，並連接 GitHub Repository 實現自動部署。

---

## 部署架構概覽

| 元件 | 說明 |
|------|------|
| **Web Service** | Node.js Express + React 前端（單一容器） |
| **MySQL Database** | Railway 內建 MySQL 服務 |
| **自動部署** | 每次推送至 GitHub `main` 分支自動觸發 |

---

## 步驟一：準備 GitHub Repository

### 1.1 下載代碼

在 Manus 管理面板右側 → **Code** 頁籤 → 點擊「**Download All Files**」下載完整代碼壓縮包。

### 1.2 建立 GitHub Repository

前往 [github.com/new](https://github.com/new)，建立一個新的 Repository（例如 `Chemist-warehouse-price-tracker`）。

### 1.3 推送代碼

在本地解壓縮後，執行以下指令：

```bash
cd Chemist-warehouse-price-tracker

# 初始化 git
git init
git add -A
git commit -m "feat: CW 價格追蹤系統初始版本"

# 連接 GitHub 並推送
git remote add origin https://github.com/Eddycollab/Chemist-warehouse-price-tracker.git
git branch -M main
git push -u origin main
```

---

## 步驟二：在 Railway 建立專案

### 2.1 登入 Railway

前往 [railway.app](https://railway.app/) 並使用 GitHub 帳號登入。

### 2.2 建立新專案

1. 點擊「**New Project**」
2. 選擇「**Deploy from GitHub repo**」
3. 搜尋並選擇 `Chemist-warehouse-price-tracker`
4. Railway 會自動偵測 `railway.json` 配置並開始建置

---

## 步驟三：新增 MySQL 資料庫

### 3.1 加入 MySQL 服務

在 Railway 專案頁面：

1. 點擊「**+ New**」→「**Database**」→「**Add MySQL**」
2. Railway 會自動建立 MySQL 服務並生成連線資訊

### 3.2 取得連線字串

點擊 MySQL 服務 → **Variables** 頁籤，複製 `DATABASE_URL` 的值，格式如下：

```
mysql://root:password@containers-us-west-xxx.railway.app:6543/railway
```

---

## 步驟四：設定環境變數

在 Railway Web Service → **Variables** 頁籤，加入以下環境變數：

| 變數名稱 | 說明 | 範例值 |
|---------|------|--------|
| `DATABASE_URL` | MySQL 連線字串（從步驟 3.2 複製） | `mysql://root:...` |
| `JWT_SECRET` | Session 加密金鑰（自行設定一組隨機字串） | `my-super-secret-key-2024` |
| `NODE_ENV` | 執行環境 | `production` |

> **重要**：`DATABASE_URL` 可以使用 Railway 的「**Reference Variable**」功能，直接引用 MySQL 服務的變數，避免手動複製。在 Variables 頁面點擊「**Add Reference**」→ 選擇 MySQL 服務的 `DATABASE_URL`。

---

## 步驟五：執行資料庫初始化

首次部署後，需要建立資料庫表格。

### 方法一：透過 Railway Shell（推薦）

在 Railway Web Service → **Deploy** 頁籤 → 點擊「**Shell**」，執行：

```bash
pnpm drizzle-kit migrate
```

### 方法二：手動執行 SQL

在 Railway MySQL 服務 → **Data** 頁籤，貼上 `drizzle/migrations/` 目錄下的 SQL 檔案內容並執行。

---

## 步驟六：確認部署成功

### 6.1 查看部署日誌

在 Railway Web Service → **Deployments** 頁籤，點擊最新的部署記錄，確認日誌顯示：

```
[Scheduler] Starting weekly crawl scheduler...
[Scheduler] Next crawl scheduled for: ...
Server running on http://localhost:PORT/
```

### 6.2 取得公開網址

部署成功後，Railway 會自動分配一個網址，格式為：

```
https://chemist-warehouse-price-tracker-production.up.railway.app
```

在 Railway Web Service → **Settings** → **Networking** → 點擊「**Generate Domain**」即可取得。

---

## 步驟七：設定自動部署

Railway 預設已啟用 GitHub 自動部署。每次您推送代碼到 `main` 分支，Railway 會自動重新建置並部署。

```bash
# 日後更新代碼只需
git add -A
git commit -m "update: 新增追蹤產品"
git push origin main
# Railway 會自動部署最新版本
```

---

## 常見問題排解

### 問題：建置失敗（Build Failed）

**原因**：通常是 Node.js 版本不相容。

**解決方法**：在 Railway Web Service → **Settings** → **Build** 中，確認 Node.js 版本設定為 `22`。

### 問題：資料庫連線失敗

**原因**：`DATABASE_URL` 環境變數未正確設定。

**解決方法**：
1. 確認 `DATABASE_URL` 已在 Variables 頁籤中設定
2. 確認 MySQL 服務正在運行（狀態顯示綠色）
3. 嘗試使用 Reference Variable 重新連結

### 問題：爬蟲無法執行

**原因**：Railway 免費方案的容器在閒置時會進入休眠狀態，可能導致排程任務錯過。

**解決方法**：升級至 Railway 的付費方案（Hobby Plan，$5/月），確保服務持續運行。

### 問題：首次訪問顯示密碼頁面

這是正常的！系統預設密碼為 `CW150721`，輸入後可進入儀表板。密碼可在「系統設定」頁面修改。

---

## 費用估算

| 方案 | 費用 | 適用情境 |
|------|------|---------|
| **Hobby（免費）** | $0/月 | 測試用途，容器可能休眠 |
| **Hobby（付費）** | $5/月 | 個人使用，持續運行 |
| **Pro** | $20/月 | 團隊使用，高可用性 |

> 建議選擇 **Hobby 付費方案**（$5/月），確保每週定時爬蟲能夠正常執行，不因容器休眠而錯過排程。

---

## 部署檢查清單

完成部署後，請確認以下項目：

- [ ] GitHub Repository 已建立並推送代碼
- [ ] Railway 專案已建立並連接 GitHub
- [ ] MySQL 資料庫服務已加入
- [ ] `DATABASE_URL` 和 `JWT_SECRET` 環境變數已設定
- [ ] 資料庫表格已初始化（`pnpm drizzle-kit migrate`）
- [ ] 公開網址已生成並可正常訪問
- [ ] 使用密碼 `CW150721` 可成功登入
- [ ] 儀表板顯示產品列表和統計資料
- [ ] 爬蟲排程器已啟動（日誌顯示下次執行時間）
