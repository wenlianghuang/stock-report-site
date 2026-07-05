# stock-report-site

台股籌碼報告網站：使用者註冊／登入後輸入股號，由 [antigravity_agent](../antigravity_agent) 執行 `tw-stock-report` → `report-gate`（agy loop engineering），完成後在網頁渲染 Markdown 報告。

## 架構

```
使用者 (Next.js)  →  POST /api/reports  →  antigravity_agent API (8765)
                                              ├ fetch_chip_report.py
                                              └ report_gate.py (agy)
```

## 前置需求

1. **Node.js 20+**（本專案）
2. **antigravity_agent** 已安裝依賴，且 **agy CLI** 可用
3. 兩個 process 同時運行（見下方）

## 快速開始

### 1. 啟動 Antigravity API（終端 A）

```bash
cd ../antigravity_agent
uv sync --extra server --extra ui --extra stock
uv run --extra server --extra ui --extra stock python main.py api
```

預設監聽 `http://127.0.0.1:8765`。

### 2. 啟動網站（終端 B）

```bash
cp .env.local.example .env.local
# 編輯 .env.local 設定 SESSION_SECRET

npm install
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000) → 註冊 → 輸入股號（如 `2409`）→ 等待報告完成。

## 環境變數

| 變數 | 說明 | 預設 |
|------|------|------|
| `SESSION_SECRET` | JWT session 簽章密鑰 | （必填於 production） |
| `ANTIGRAVITY_API_URL` | antigravity API 位址 | `http://127.0.0.1:8765` |

## 流程說明

1. **Signup / Login** — 帳密存在 `.data/db.json`（本機 MVP）
2. **選股號** — Dashboard 輸入 4～6 位台股代號
3. **背景 pipeline** — antigravity worker 依序執行：
   - `fetch_chip_report.py --stocks {代碼}` → CSV
   - `report_gate.py {代碼}` → agy 產報 + 驗證閉環
4. **報告頁** — 每 3 秒輪詢狀態，完成後用 `react-markdown` 顯示

## 注意

- 籌碼資料約 **21:30 後**較完整；非交易時段可能使用最近交易日。
- 單檔報告通常需 **2～5 分鐘**（含 agy 多輪修正）。
- `content/reports/` 為歷史紀錄，與線上流程無關。
