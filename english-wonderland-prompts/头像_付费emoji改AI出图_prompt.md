# 付费 emoji 头像改 AI 出图 Prompt（2026-08-19）

> 目的：把 LOCKED_AVATARS 中 8 个付费 emoji 头像（30 积分档）改成 AI 生成的 512×512 透明 webp，风格与现有 6 个头像图（capybara/dino/duck/pixel-dragon/unicorn/witch）一致。
> 输出路径：`english-wonderland/images/avatars/<slug>.webp`（512×512 RGBA，scipy 抠图后）。前端无需改动：`LOCKED_AVATARS` 把对应项的 `emoji` 换成 `img:'images/avatars/<slug>.webp'` 即可。

## 统一规范
- **风格**：3D 写实可爱风（CGI / Pixar 风），毛绒/光滑质感、圆润立体、大圆眼带高光、表情微笑呆萌；纯白实色背景便于后期抠图。
- **构图**：主体居中、占画面约 75-85%、正面或微侧 3/4 视角、完整不裁切。
- **输出**：1:1、1K（1024×1024）、PNG 纯白底（#FFFFFF 均匀实色、无渐变/阴影/投影），便于 scipy 白底边界传播抠图。
- **负向**：写实照片, 2D扁平, 低幼简笔画, 暗黑, 文字, 水印, logo, 畸形, 多主体, 模糊, 阴影, 地面投影, 多色背景, busy background, gradient。

## 8 条 Prompt（slug 与 LOCKED_AVATARS 对齐）

### 1. avatar-koala 考拉（30 积分）
`A cute 3D-rendered baby koala, soft fluffy gray fur with a lighter cream belly and chest, large round shiny black-brown eyes, fluffy white ear tufts, a big round black nose, sitting upright hugging a small green eucalyptus leaf, gentle sweet smile, pure white background, no shadow, centered, 1:1, 4k. Negative: 2D flat, simple sketch, dark, text, watermark, logo, deformed, multiple subjects, blurry, shadow, ground reflection, gradient background.`

### 2. avatar-octopus 章鱼（30 积分）
`A cute 3D-rendered baby octopus, plump round purple-pink body with subtle suction cups on eight curly tentacles wrapped around a small treasure chest, large round glossy eyes with star-shaped highlights, smiling mouth, a tiny orange bow tie on head, pure white background, no shadow, centered, 1:1, 4k. Negative: 2D flat, simple sketch, dark, text, watermark, logo, deformed, multiple subjects, blurry, shadow, ground reflection, gradient background.`

### 3. avatar-whale 鲸鱼（30 积分）
`A cute 3D-rendered baby blue whale, smooth rounded sky-blue body with a cream-white belly, tiny round eyes with white sparkle, gentle smile, small water spout from blowhole forming a tiny heart-shaped puff, tail flukes up, floating upright, pure white background, no shadow, centered, 1:1, 4k. Negative: 2D flat, simple sketch, dark, text, watermark, logo, deformed, multiple subjects, blurry, shadow, ground reflection, gradient background.`

### 4. avatar-owl 猫头鹰（30 积分）
`A cute 3D-rendered baby owl, soft fluffy taupe-brown plumage with cream chest speckles, very large round amber eyes with star highlights, small tufted ear feathers, a tiny worn leather graduation cap with tassel, sitting on a small wooden branch, curious look, pure white background, no shadow, centered, 1:1, 4k. Negative: 2D flat, simple sketch, dark, text, watermark, logo, deformed, multiple subjects, blurry, shadow, ground reflection, gradient background.`

### 5. avatar-butterfly 蝴蝶（30 积分）
`A cute 3D-rendered baby butterfly with four large rounded wings in pastel gradient (soft pink → lavender → sky blue → mint), tiny round black eyes, two small curved antennae with little white balls, plump fluffy body, hovering mid-air with a subtle smiling face, a few tiny stars around it, pure white background, no shadow, centered, 1:1, 4k. Negative: 2D flat, simple sketch, dark, text, watermark, logo, deformed, multiple subjects, blurry, shadow, ground reflection, gradient background.`

### 6. avatar-bee 蜜蜂（30 积分）
`A cute 3D-rendered baby bee, plump round fuzzy yellow body with black stripes, two translucent gossamer wings, big round glossy black eyes, tiny black antennae, holding a small honey drop, hovering mid-air with a cheerful smile, pure white background, no shadow, centered, 1:1, 4k. Negative: 2D flat, simple sketch, dark, text, watermark, logo, deformed, multiple subjects, blurry, shadow, ground reflection, gradient background.`

### 7. avatar-bear 小熊（30 积分）
`A cute 3D-rendered baby bear, fluffy warm caramel-brown fur with a lighter cream belly patch, small rounded ears, big round glossy dark-brown eyes, a small pink bow tie, sitting upright holding a tiny honey jar, gentle smile, pure white background, no shadow, centered, 1:1, 4k. Negative: 2D flat, simple sketch, dark, text, watermark, logo, deformed, multiple subjects, blurry, shadow, ground reflection, gradient background.`

### 8. avatar-panda 熊猫（30 积分）
`A cute 3D-rendered baby panda, soft fluffy white fur with classic black ears, black eye patches, black arms and legs, big round shiny black eyes, a tiny green bamboo shoot in one hand, sitting upright, cheerful smile, pure white background, no shadow, centered, 1:1, 4k. Negative: 2D flat, simple sketch, dark, text, watermark, logo, deformed, multiple subjects, blurry, shadow, ground reflection, gradient background.`

## 落盘后端修改
将 `LOCKED_AVATARS` 中对应 8 项的 `emoji:'🐨'...` 改成 `img:'images/avatars/koala.webp'`（同名字段替换），并删除 `emoji` 字段。前端 `renderAvatarPresets` / `avatarHTML` / `bigPreview` 都已经同时支持 `img` 与 `emoji`（`if(a.img) ... else ... emoji`），无需额外改动。
