# 晴舍｜雞舍氣象守護

目前版本已加入伺服器背景監測與 Web Push。

- [線上使用](https://fangyuan-flock-weather.a0321000000.chatgpt.site/)（需登入）
- [完整伺服器與開發說明](server/README.md)
- [完整可部署原始碼](server/)

此層保留網頁 PWA 檔案；背景 API 需要部署 server/ 專案、D1、推播金鑰與每小時排程，單純 GitHub Pages 不會啟動伺服器。手機需至警戒設定親自允許通知，再按伺服器測試推播。背景每小時檢查；前景每十分鐘更新。
