# 火哥的个人站

由 Cloudflare Pages 免费托管的个人静态站点（PWA，可添加到手机桌面）。

- **首页**：`index.html` — 个人工作台（苹果黑白灰风）
  - 计划安排：待办 + 四象限优先级 + 定时提醒（弹窗 + 响铃，需页面打开）
  - 知识库：灵感 / 素材 / 案例 / 方法论SOP / 人脉 五个小本本
  - 每日新闻：热搜抓取 + 内置模板生成文案与选题建议
  - AI训练师复习：链接到 `ai-trainer/` 板块
  - 设置 / 数据：导出/导入 JSON、导出知识库 Markdown
- **数据**：全部存浏览器 localStorage，刷新不丢

## 本地预览

```bash
python -m http.server 8099
# 打开 http://127.0.0.1:8099/
```

## 部署

Cloudflare Pages 连接本仓库后自动构建部署；`git push` 即自动上线。

> ⚠️ `.cloudflare.env`（Cloudflare API 凭证）已被 `.gitignore` 排除，严禁提交。
