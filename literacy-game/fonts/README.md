# web/fonts

把下面两个开源 / 免费字体文件放到**本目录**，应用会自动生效（`css/fonts.css` 已配置好 `@font-face`，无需改代码）：

| 文件 | 字体 | 授权 | 用途 |
|---|---|---|---|
| `lxgw-wenkai.woff2` | 霞鹜文楷 LXGW WenKai | SIL OFL（开源） | 描红 / 认字大字 |
| `zcool-kuaile.woff2` | 站酷快乐体 ZCOOL KuaiLe | 免费 | UI / 按钮 / 标题 |

## 诚实标注

- 本目录当前为**空占位**：字体文件未随原型打包（源不在本地、且避免联网下载带来的授权 / 安全风险）。
- 字体缺失时，`index.html` 的 `--font-kai` / `--font-ui` 变量会自动回退到系统字体栈（PingFang SC / KaiTi 等），**功能、布局、判定算法均不受影响**。
- Sprint 02 接入正式美术与字体后，把上面的 `woff2` 放进本目录即可，零代码改动。
