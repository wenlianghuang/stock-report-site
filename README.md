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
| `STT_API_URL` | （可選）Whisper STT 公網 URL。未設定時正式站自動用瀏覽器語音；本機預設 `http://127.0.0.1:8787` |
| `SMTP_USER` | Gmail 帳號（寄件者） |
| `SMTP_PASS` | Gmail App Password（需先開 2FA） |
| `EMAIL_FROM` | （可選）寄件者顯示名稱，例如 `Stock Report <wenliangmatt@gmail.com>` |

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

### 3. STT 語音服務（可選，本機 Whisper 品質較佳）

正式站（Vercel）**不需**設定 `STT_API_URL`，會自動使用瀏覽器內建語音辨識（Chrome / Edge / Safari）。

若要用本機 Whisper（品質較好），需本機已建好 [AI_Speech/stt](../AI_Speech/stt)（whisper.cpp + `ggml-medium.bin`，並安裝 `ffmpeg`）：

```bash
cd ../AI_Speech/stt
make serve
# 預設 http://127.0.0.1:8787 ；POST /transcribe、GET /health
```

本機開發在 `.env.local` 設定 `STT_API_URL=http://127.0.0.1:8787`（見 `.env.local.example`）。

若將 Whisper 部署到有公網 URL 的機器，在 Vercel 設定 `STT_API_URL=https://stt.yourdomain.com` 即可切回伺服器辨識。

Dashboard「語音填寫」：錄音 → 辨識 → 預覽／微調 →「確認並開始分析」或「只填入表單」。不會在未確認時自動送出。

### 4. 啟動網站

```bash
npm install
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000) → 註冊 → 輸入股號（或語音填表）。

### 5. 測試 Auth API

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
5. **彙整 Email** — Dashboard 可針對某交易日按「寄出彙整 Email」，後端會：
   - 讀取該日所有 `done` 報告（同一使用者）
   - 呼叫 Stock API `/digest` 使用 agy 融合精簡（subject + 摘要 Markdown）
   - 將摘要 Markdown 轉成 HTML 後寄信（Gmail SMTP）

## 注意

- **本機 `.data/` 已不再使用**；請在 Vercel 上重新註冊帳號。
- 籌碼資料約 **21:30 後**較完整。
- Vercel 無法連 `127.0.0.1:8765`；線上分析需將 Stock API 部署到有 public URL 的機器。