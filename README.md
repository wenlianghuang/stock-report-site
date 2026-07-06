# stock-report-site

台股籌碼報告網站：使用者註冊／登入後輸入股號，由 [stock-winning-rate](../stock-winning-rate) 執行 `tw-stock-report` → `report-gate`（agy loop engineering），完成後在網頁渲染 Markdown 報告。

## 架構

```
使用者 (Next.js on Vercel)
  ├─ Supabase Auth      → signup / login
  ├─ Supabase Postgres  → reports 表
  └─ Stock API          → 籌碼抓取 + agy 報告（需另部署或有 public URL）
```

## 一次性設定：Supabase

1. 至 [supabase.com](https://supabase.com) 建立專案
2. **SQL Editor** 貼上並執行 [`supabase/schema.sql`](./supabase/schema.sql)
3. **Authentication → Providers → Email**：開發期可關閉 **Confirm email**（否則註冊後需收信確認）
4. **Project Settings → API** 複製：
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Vercel 環境變數

在 Vercel → Settings → Environment Variables 設定：

| 變數 | 說明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `ANTIGRAVITY_API_URL` | Stock API 公網 URL（本機開發用 `http://127.0.0.1:8765`） |

設定後 **Redeploy**。

## 本機開發

### 1. 環境變數

```bash
cp .env.local.example .env.local
# 填入 Supabase URL 與 anon key
```

### 2. Stock API（分析功能需要）

```bash
cd ../stock-winning-rate
uv sync --extra server --extra ui --extra stock
uv run --extra server --extra ui --extra stock python main.py api
```

### 3. 啟動網站

```bash
npm install
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000) → 註冊 → 輸入股號。

### 4. 測試 Auth API

```bash
npm run dev   # 另一個終端
npm run test:auth
```

## 流程

1. **Signup / Login** — Supabase Auth（帳號存在雲端，Vercel 可正常使用）
2. **選股號** — Dashboard 輸入 4～6 位台股代號
3. **背景 pipeline** — stock-winning-rate worker：
   - `fetch_chip_report.py --stocks {代碼}`
   - `report_gate.py {代碼}`
4. **報告頁** — 輪詢狀態，完成後渲染 Markdown（並寫入 Supabase `reports.markdown`）

## 注意

- **本機 `.data/` 已不再使用**；請在 Vercel 上重新註冊帳號。
- 籌碼資料約 **21:30 後**較完整。
- Vercel 無法連 `127.0.0.1:8765`；線上分析需將 Stock API 部署到有 public URL 的機器。
