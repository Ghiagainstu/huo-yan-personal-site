# 字精灵 · 识字游戏 — Web(HTML5) 垂直切片原型

> **目的**：面向 5 岁儿童的识字游戏，Phase 4 / Sprint 01 的 **mechanics-first 垂直切片**。
> 火哥在浏览器里**双击 `index.html` 即可玩**（零安装、`file://` 直接打开也能跑），用于验证
> 「认字 → 描红 → 结算 → 节奏 → 存档」核心循环是否"好玩"。
> 平台转向：Godot 4.3 / Mac 路线 parked；本原型在 **Web(HTML5)** 上复用全部已有资产。

---

## 1. 如何运行（零安装）

1. 直接**双击 `web/index.html`**（用 Chrome / Edge / Firefox 任一现代浏览器）。
2. 无需服务器、无需联网、无需 npm install —— 所有 JS 用经典 `<script>` 全局变量，
   无 `fetch`、无 ES module import，`file://` 下即可运行。
3. 进入后点「开始今日任务」→「开始描红」，用鼠标或手指在粉色虚线区照着写。

> 调试便利：首页有「（调试）明天再来」可模拟次日（看节奏调度如何把今天学的字排成明天复习）、
> 「重置存档」可清空进度重来；描红页「看示范」重播笔顺动画。

---

## 2. 目录说明

```
web/
├── index.html              # 单页原型入口（classic script，无构建步骤）
├── build-strokes.js        # Node 构建脚本：50 笔迹 + 字源表 → js/strokes-bundle.js
├── js/
│   ├── tolerance.js        # 容差模型 T=max(10,24×(1−0.6P))  （GDD §4.3）
│   ├── tracing.js          # 判定 judge / computeCoverageDeviation / isOrderCorrect（GDD §4.2/§4.4）
│   ├── rhythm.js           # 艾宾浩斯每日分配 allocatePlan（GDD §4.2/§4.3）
│   ├── storage.js          # localStorage 读写 + v1→v2 迁移（GDD §5）
│   ├── strokes-bundle.js   # 自动生成：window.STROKE_DATA + window.CHAR_META（50 字）
│   ├── render.js           # Canvas 绘制层（字精灵占位、描红引导层、HUD）
│   └── main.js             # 状态机 + 指针交互 + 音频占位 + 游戏循环
└── tests/
    └── node-tests.js        # 纯逻辑模块 + bundle 的真断言测试（72 项）
```

---

## 3. 复用的已有资产（未重写，直接读取）

| 资产 | 路径 | 用途 |
|---|---|---|
| 50 字笔迹中位线 | `../data/strokes/u<hex>.json` | 描红路径（Arphic Public License） |
| 字源表（拼音+释义+配色） | `../design/gdd/character-source-table-50.md` | 认字屏拼音/简义/字精灵配色 |
| 判定/节奏算法规格 | `../design/gdd/tracing-judgment-system.md`、`../design/gdd/daily-rhythm-system.md` | 算法唯一真源 |
| 美术色板与触控规格 | `../art/art-bible.md`、`../art/a11y-matrix.md` | 天空蓝/阳光黄/描红珊瑚红等、触控尺寸 |
| 署名 | `../licenses/ATTRIBUTION.md` | 关于页/页脚保留一句署名 |

Godot 旧实现（`../src/` 下 `tolerance_model.gd` 等）**仅作只读参考**，已 parked 不删除、不依赖。

---

## 4. 算法与 GDD 严格对齐（禁止自创）

- **容差**：`T = max(10, 24 × (1 − 0.6 × P))`，P=熟练度∈[0,1]，单位=1024 虚拟坐标系
  （与笔迹数据同尺度）。恒 ≥10 保零挫败。
- **单笔判定**：`通过 = 覆盖率 C ≥ 0.8 且 偏差 D ≤ T`。
  C = 中位线采样点中被玩家轨迹在 T 内覆盖的比例；D = 玩家点到中位线的最近距均值。
- **笔顺校验**：`isOrderCorrect(tracedSeq, expectedOrder)` 为规范 order 的前缀校验。
- **节奏调度**：BUDGET=8、NEW_MAX=3（clamp 2~5）、INTERVAL={R0:0,R1:1,R2:3,R3:7,R4:16,GRAD:30}；
  **复习优先填满** BUDGET，剩余槽位给新字。
- **存档**：localStorage 持久化，含 `settings / learned / characters / daily_task / active_minutes_today`；
  读写 try/catch；读到 v1 数据自动迁移补字段。

> 坐标约定：笔迹数据归一化 0..1（y-down，不翻转），×1024 进入判定空间；渲染用
> `_render_center` 居中（严格按 hanzi-writer 变换 `screen=(n−rc)×size+box`）。

---

## 5. 构建与测试（用管理版 node，勿装重依赖）

```bash
# 1) 生成 bundle（读取 50 字 + 字源表）
C:/Users/fireh/.workbuddy/binaries/node/versions/22.22.2/node.exe build-strokes.js

# 2) 跑断言测试（72 项）
C:/Users/fireh/.workbuddy/binaries/node/versions/22.22.2/node.exe tests/node-tests.js

# 3) 语法检查所有 .js
for f in build-strokes.js js/*.js tests/node-tests.js; do \
  C:/Users/fireh/.workbuddy/binaries/node/versions/22.22.2/node.exe --check "$f"; done
```

覆盖：tolerance 边界值、judge 真值表、allocatePlan 空态/填满/ clamp、
`computeCoverageDeviation` 对 `u4e00`（一）完美贴合 C≈1·D≈0 且通过 / 远离则失败、
`strokes-bundle.js` 可被 require 且 50 字齐、storage v1→v2 迁移。

---

## 6. 已知限制与诚实 caveat（需手动浏览器验证）

- **Canvas 真实渲染与触摸交互无法在此环境自动测试**：以上 node 测试只覆盖纯逻辑与 bundle；
  真实描红手感、字精灵观感、触屏书写需火哥在浏览器里**手动打开 `index.html` 验证**。
- **字精灵为占位**：用 Canvas 画的「团子」圆胖基底（天空蓝/阳光黄，按字源表配色），
  Sprint 02 换真实精灵 PNG；认字表情为简单映射（happy/think/done）。
- **发音为占位**：用 WebAudio 发轻"叮"提示音，`playSound('char')` 已留作真实人声钩子（D1 延后）。
- **`file://` 下 localStorage 可能受限**：部分浏览器（尤其 Safari）在 `file://` 不持久化
  localStorage；原型已做 try/catch + 内存回退，保证可玩，但跨刷新续学在受限浏览器可能失效
  （Chrome/Edge 通常正常）。正式工程建议起一个本地静态服务器。
- **释义为英文**：字源表 `meaning` 字段为英文（如 one），认字屏暂显示拼音 + 英文释义；
  中文释义可在 Sprint 02 补一列。
- **字格居中**用 `_render_center` + bounding-box 友好变换；像素级居中可在 Sprint 02 对照
  真实字体微调（不影响判定，判定与显示尺寸解耦）。

---

## 7. Sprint 02 接入点（给正式 Web 工程的地基）

- **真实精灵美术**：替换 `render.js` 的 `drawSprite` —— 加载 `CHAR_META.main_color/accent_color`
  对应的精灵 PNG（512×512，按字源表生成），保留团子占位作为加载失败兜底。
- **真人发音**：替换 `main.js` 的 `playSound('char')` —— 改为 `<audio>` / Web Speech / 预录音，
  触发时机在「认字」进入与「描红完成」正反馈。
- **设置系统**：`storage.js` 的 `settings`（new_per_day / reduce_motion / high_contrast /
  font_scale / sound_on）已就绪，Sprint 02 接设置页与三开关视觉。
- **防沉迷 12 分钟提醒 / 家长报告**：节奏调度已留 `active_minutes_today` 与间隔逻辑，待接 Modal。
- **工程化**：可保留 `js/*.js` 纯逻辑模块（已兼容 node），正式工程再包一层构建/框架。
