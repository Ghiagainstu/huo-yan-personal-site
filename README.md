# 火哥的个人站

由 Cloudflare Pages 免费托管的个人静态站点。

- **首页**：`index.html`（板块网格，可扩展）
- **板块**：`ai-trainer/` — 人工智能训练师三级备考复习（综合题库 / 上机代码 / 单选 / 多选 / 判断）

## 本地预览

```bash
python -m http.server 8099
# 打开 http://127.0.0.1:8099/
```

## 部署

Cloudflare Pages 连接本仓库后自动构建部署；新增板块只需在 `index.html` 里加一个 `.card` 卡片并创建对应目录。

> ⚠️ `.cloudflare.env`（Cloudflare API 凭证）已被 `.gitignore` 排除，严禁提交。
