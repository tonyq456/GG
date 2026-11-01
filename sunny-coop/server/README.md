# 晴舍｜雞舍氣象守護

黑底白字、支援 Android Chrome 與桌面的天氣 PWA。預設彰化縣芳苑鄉，可用國土測繪地圖、經緯度或定位新增場區。

## 現在的背景功能

- 伺服器 D1 保存使用者場區、規則、推播訂閱、監測狀態與通知佇列。
- 平台雲端排程每小時呼叫監測端點，關閉網頁後仍可運作。不是即時或每 10 分鐘的背景監測；頁面開啟時每 10 分鐘更新。
- 使用 Web Push RFC 8291 / RFC 8292 加密與 VAPID 驗證，不依賴前景計時器。
- 同時監測最多 10 個雲端場區，支援最多 5 部訂閱裝置；規則共用。
- 依門檻、組合條件與迎風條件通知，支援暫停、重複提醒間隔、恢復通知、資料中斷通知。
- 發送失敗佇列會在後續監測重試，通知超過一小時即失效，404/410 訂閱會移除；HTTP 2xx 僅表示推播服務接受，不代表手機接收。
- 手機聲音、震動、延遲與顯示受 Android、瀏覽器、勿擾與省電設定影響，不提供「保證送達」。

## 手機啟用

1. 使用 Android Chrome 登入已發布網站，可加入主畫面。
2. 在「警戒設定」調整門檻、啟用需要的規則並儲存。
3. 按「啟用背景推播與監測」，親自允許通知。
4. 按「伺服器測試推播」，確認手機通知列實際收到。
5. 查看排程心跳、最後監測時間及推播服務接受狀態。其他裝置先按「載入雲端設定」再訂閱。

關閉全部背景監測不會刪除紀錄；取消此裝置推播不會停止其他裝置。清除瀏覽器資料後可能需要重新訂閱。

## 結構

- `public/`：原本的完整網頁 PWA（包含 `background.js` 與支援 push 的 `sw.js`）。
- `worker/index.ts`：保留 Sites/Vinext 整合，攔截 `/api/coop/*` 伺服器路由。
- `lib/coop/`：門檻、驗證、Web Push 加密與通知佇列。
- `db/schema.ts` / `drizzle/`：D1 結構與遷移。
- `tests/coop.test.mjs`：SQLite 監測整合、跨使用者隔離、來源檢查、獨立加解密與 JWT 驗證。
- `scripts/run-monitor.py`：以 stdin 接收服務存取權杖，呼叫伺服器監測並讀回心跳。不得把權杖放在參數、原始碼或排程提示。

## 開發與測試

使用 Node 22.13+（測試使用 `node:sqlite`，建議 Node 24+）與 pnpm：

```sh
pnpm install --frozen-lockfile
node --test tests/coop.test.mjs
pnpm run build
```

預覽前需依專案附帶的 Sites 開發流程套用 D1 遷移。單純使用靜態檔案伺服器只能測前端；背景 API 需要 Worker 與 D1。

## 部署必要條件

- Sites owner-private 存取政策，以及 `.openai/hosting.json` 的 `d1: "DB"`。
- 伺服器環境變數 `VAPID_PRIVATE_JWK`、`VAPID_PUBLIC_KEY`、`VAPID_SUBJECT`；私鑰不可加入 Git。
- D1 遷移套用。
- 每小時排程使用 Sites 即時服務權杖 POST `/api/coop/run`，再 GET `/api/coop/heartbeat` 確認新心跳。routine 執行不重新部署。
- `/api/coop/run` 與非訪客排程設定端點依賴此 Site 的 owner-private 平台存取邊界。若變更網站為公開或新增其他訪客，必須先補上對應的服務端授權；不可直接公開端點。
- 訪客操作使用 Sites 注入的使用者 ID 分隔資料；寫入拒絕跨來源 Origin。
- 部署與排程僅存在於目前 Sites 環境；複製 GitHub 原始碼不會複製金鑰、資料庫、訂閱或排程。

## 資料來源與限制

Open-Meteo（https://open-meteo.com/）提供戶外模式估算與預報，不是雞舍內實測。正式商用前須確認資料使用條款與額度。臺灣地圖由國土測繪中心 WMTS（https://maps.nlsc.gov.tw/）提供。天氣請求會傳送所選座標至 Open-Meteo。門檻範例不屬於養殖建議，預設皆關閉。伺服器通知紀錄保留 30 天，畫面顯示最近紀錄；本機紀錄最多 200 筆。
