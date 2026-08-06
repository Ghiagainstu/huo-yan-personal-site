const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const { image } = require(require("path").resolve(process.cwd(), "scripts/pptxgenjs_helpers.js"));
const fa = require("react-icons/fa");
const path = require("path");

const WORKDIR = process.env.WORKDIR;
if (!WORKDIR) { console.error("WORKDIR not set"); process.exit(1); }

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "DuMate";
pres.title = "2026 Summer Phuket Family Travel Guide";

// Colors
const C_SKY = "4FC3F7";
const C_CREAM = "FFF8E1";
const C_CORAL = "FF8A65";
const C_WHITE = "FFFFFF";
const C_DARK = "37474F";
const C_TEXT = "455A64";
const C_LIGHT = "E3F2FD";
const C_LIGHTORANGE = "FFF3E0";

const F_TITLE = "Microsoft YaHei";
const F_BODY = "Microsoft YaHei";

// Icon renderer
function renderIconSvg(IconComp, color, size) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComp, { color, size: String(size) })
  );
}
async function iconToPng(IconComp, color, size = 256) {
  const svg = renderIconSvg(IconComp, color, size);
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

function imgPath(name) {
  return path.resolve(WORKDIR, "images", name);
}

// Helper to place icon image on slide
async function placeIcon(slide, iconData, x, y, w, h) {
  await image.add(slide, { data: iconData, width: 256, height: 256 }, { x, y, w, h }, { fit: "contain" });
}

async function main() {
  // Pre-render icons
  const icons = {
    plane: await iconToPng(fa.FaPlane, "#" + C_WHITE, 256),
    clock: await iconToPng(fa.FaClock, "#" + C_WHITE, 256),
    beach: await iconToPng(fa.FaUmbrellaBeach, "#" + C_WHITE, 256),
    calendar: await iconToPng(fa.FaCalendarAlt, "#" + C_WHITE, 256),
    hotel: await iconToPng(fa.FaHotel, "#" + C_WHITE, 256),
    coins: await iconToPng(fa.FaCoins, "#" + C_WHITE, 256),
    passport: await iconToPng(fa.FaPassport, "#" + C_WHITE, 256),
    sun: await iconToPng(fa.FaSun, "#" + C_WHITE, 256),
    bug: await iconToPng(fa.FaBug, "#" + C_WHITE, 256),
    pills: await iconToPng(fa.FaPills, "#" + C_WHITE, 256),
    tshirt: await iconToPng(fa.FaTshirt, "#" + C_WHITE, 256),
    simcard: await iconToPng(fa.FaSimCard, "#" + C_WHITE, 256),
    lifering: await iconToPng(fa.FaLifeRing, "#" + C_WHITE, 256),
    utensils: await iconToPng(fa.FaUtensils, "#" + C_WHITE, 256),
    car: await iconToPng(fa.FaCar, "#" + C_WHITE, 256),
    planedep: await iconToPng(fa.FaPlaneDeparture, "#" + C_CORAL, 256),
  };

  const makeShadow = () => ({ type: "outer", color: "000000", blur: 6, offset: 2, angle: 45, opacity: 0.1 });

  // ============= Slide 1: Cover =============
  let s1 = pres.addSlide();
  s1.background = { color: C_CREAM };
  await image.background(s1, imgPath("cover-phuket-beach-1080-1890.jpg"), { w: 13.333, h: 7.5 });
  s1.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: C_SKY, transparency: 35 } });
  s1.addText("2026 暑假普吉岛亲子游攻略", {
    x: 1, y: 1.8, w: 11.33, h: 1.2,
    fontSize: 44, bold: true, fontFace: F_TITLE, color: C_WHITE, align: "center"
  });
  s1.addText("Phuket Family Travel Guide", {
    x: 1, y: 3.0, w: 11.33, h: 0.6,
    fontSize: 22, fontFace: "Arial", color: C_WHITE, align: "center", charSpacing: 4
  });
  s1.addText([
    { text: "上海 -> 普吉岛  直飞约5小时", options: { breakLine: true, fontSize: 18 } },
    { text: "7天6晚  |  适合年龄: 6岁+  |  免签30天  |  时差仅1小时", options: { fontSize: 16 } }
  ], {
    x: 2, y: 4.2, w: 9.33, h: 1.2,
    fontFace: F_BODY, color: C_WHITE, align: "center", lineSpacingMultiple: 1.5
  });

  // ============= Slide 2: Contents =============
  let s2 = pres.addSlide();
  s2.background = { color: C_CREAM };
  s2.addText("CONTENTS", {
    x: 0.5, y: 2.2, w: 4.5, h: 1.5,
    fontSize: 48, bold: true, fontFace: "Arial", color: C_SKY, align: "center", charSpacing: 4, valign: "middle"
  });
  s2.addText("目 录", {
    x: 0.5, y: 3.5, w: 4.5, h: 0.8,
    fontSize: 28, fontFace: F_TITLE, color: C_TEXT, align: "center"
  });
  const contents = [
    { num: "01", title: "行前总览", desc: "普吉岛概况与行程亮点" },
    { num: "02", title: "景点推荐", desc: "8大亲子必玩景点" },
    { num: "03", title: "出行路线", desc: "7天6晚逐日安排" },
    { num: "04", title: "人均预算", desc: "六大费用明细" },
    { num: "05", title: "实用Tips", desc: "出行准备与注意事项" },
  ];
  let cy = 0.9;
  for (const c of contents) {
    s2.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 5.5, y: cy, w: 7.3, h: 1.0,
      fill: { color: C_WHITE }, rectRadius: 0.1, shadow: makeShadow()
    });
    s2.addText(c.num, {
      x: 5.7, y: cy + 0.1, w: 1.0, h: 0.8,
      fontSize: 32, bold: true, fontFace: "Arial", color: C_CORAL, align: "center", valign: "middle"
    });
    s2.addText(c.title, {
      x: 6.8, y: cy + 0.1, w: 3.5, h: 0.45,
      fontSize: 20, bold: true, fontFace: F_TITLE, color: C_DARK, valign: "middle"
    });
    s2.addText(c.desc, {
      x: 6.8, y: cy + 0.5, w: 5.5, h: 0.4,
      fontSize: 14, fontFace: F_BODY, color: C_TEXT, valign: "middle"
    });
    cy += 1.2;
  }

  // ============= Helper: Chapter page =============
  function chapterPage(num, title, subtitle) {
    let s = pres.addSlide();
    s.background = { color: C_SKY };
    s.addText(num, {
      x: 1, y: 1.8, w: 5, h: 3,
      fontSize: 140, bold: true, fontFace: "Arial", color: C_WHITE, align: "center", valign: "middle"
    });
    s.addShape(pres.shapes.LINE, { x: 6.2, y: 2.8, w: 0, h: 1.5, line: { color: C_WHITE, width: 2 } });
    s.addText("PART " + num, {
      x: 6.5, y: 2.5, w: 5, h: 0.6,
      fontSize: 18, fontFace: "Arial", color: C_WHITE, charSpacing: 6
    });
    s.addText(title, {
      x: 6.5, y: 3.1, w: 6, h: 1.0,
      fontSize: 36, bold: true, fontFace: F_TITLE, color: C_WHITE
    });
    s.addText(subtitle, {
      x: 6.5, y: 4.1, w: 5.5, h: 0.6,
      fontSize: 16, fontFace: F_BODY, color: C_WHITE, transparency: 20
    });
  }

  // ============= Slide 3: Chapter 01 =============
  chapterPage("01", "行前总览", "普吉岛概况与行程亮点");

  // ============= Slide 4: Overview =============
  let s4 = pres.addSlide();
  s4.background = { color: C_CREAM };
  s4.addText("普吉岛概况 -- 为什么选这里", {
    x: 0.5, y: 0.3, w: 12.33, h: 0.8,
    fontSize: 28, bold: true, fontFace: F_TITLE, color: C_DARK, align: "center"
  });
  const overview = [
    { icon: icons.plane, title: "免签30天", desc: "中国护照免签，一本护照说走就走，无需提前办签证" },
    { icon: icons.clock, title: "直飞5小时", desc: "上海浦东直飞普吉岛，春秋/东航/上航可选" },
    { icon: icons.beach, title: "时差仅1小时", desc: "落地即可游玩，6岁孩子基本不用倒时差" },
    { icon: icons.calendar, title: "暑期最佳季", desc: "7-8月雨水短暂，气温26-33度，海水温暖" },
    { icon: icons.hotel, title: "亲子配套成熟", desc: "2026年新开多家儿童俱乐部酒店，全面升级" },
    { icon: icons.coins, title: "性价比突出", desc: "相比三亚同档酒店更便宜，海水质量远超国内" },
  ];
  {
    const cw = 3.7, ch = 2.4, gx = 0.45, gy = 0.3;
    const ox = 0.7, oy = 1.3;
    for (let i = 0; i < overview.length; i++) {
      const item = overview[i];
      const col = i % 3, row = Math.floor(i / 3);
      const x = ox + col * (cw + gx);
      const y = oy + row * (ch + gy);
      s4.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, fill: { color: C_WHITE }, rectRadius: 0.12, shadow: makeShadow() });
      s4.addShape(pres.shapes.OVAL, { x: x + cw/2 - 0.4, y: y + 0.25, w: 0.8, h: 0.8, fill: { color: C_SKY } });
      await placeIcon(s4, item.icon, x + cw/2 - 0.25, y + 0.4, 0.5, 0.5);
      s4.addText(item.title, { x: x + 0.2, y: y + 1.15, w: cw - 0.4, h: 0.45, fontSize: 18, bold: true, fontFace: F_TITLE, color: C_DARK, align: "center" });
      s4.addText(item.desc, { x: x + 0.25, y: y + 1.6, w: cw - 0.5, h: 0.7, fontSize: 12, fontFace: F_BODY, color: C_TEXT, align: "center", lineSpacingMultiple: 1.3 });
    }
  }

  // ============= Slide 5: Highlights =============
  let s5 = pres.addSlide();
  s5.background = { color: C_CREAM };
  s5.addText("行程亮点速览", {
    x: 0.5, y: 0.3, w: 12.33, h: 0.8,
    fontSize: 28, bold: true, fontFace: F_TITLE, color: C_DARK, align: "center"
  });
  const highlights = [
    { num: "7", unit: "天6晚", title: "行程天数", desc: "节奏舒缓，每天1个核心活动，留足休息" },
    { num: "8", unit: "大", title: "精选景点", desc: "海滩+乐园+大象+跳岛+老镇，不重样" },
    { num: "6", unit: "岁+", title: "亲子适配", desc: "所有景点经安全评估，避免刺激项目" },
    { num: "8000", unit: "元", title: "人均预算", desc: "含机票住宿全包，2026暑期参考价" },
    { num: "2", unit: "次", title: "出海跳岛", desc: "蛋岛半日游+皇帝岛珊瑚岛一日游" },
    { num: "3", unit: "大", title: "主题乐园", desc: "安达曼水上乐园+嘉年华+探险乐园" },
  ];
  {
    const hw = 3.7, hh = 2.3, hgx = 0.45, hgy = 0.3;
    for (let i = 0; i < highlights.length; i++) {
      const item = highlights[i];
      const col = i % 3, row = Math.floor(i / 3);
      const x = 0.7 + col * (hw + hgx);
      const y = 1.3 + row * (hh + hgy);
      const bgColor = row === 0 ? C_SKY : C_CORAL;
      s5.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: hw, h: hh, fill: { color: bgColor }, rectRadius: 0.12, shadow: makeShadow() });
      s5.addText(item.num, { x: x + 0.3, y: y + 0.3, w: hw - 0.6, h: 0.9, fontSize: 48, bold: true, fontFace: "Arial", color: C_WHITE, align: "center", valign: "middle" });
      s5.addText(item.unit, { x: x + 0.3, y: y + 1.1, w: hw - 0.6, h: 0.35, fontSize: 14, fontFace: F_BODY, color: C_WHITE, align: "center" });
      s5.addText(item.title, { x: x + 0.3, y: y + 1.5, w: hw - 0.6, h: 0.35, fontSize: 16, bold: true, fontFace: F_TITLE, color: C_WHITE, align: "center" });
      s5.addText(item.desc, { x: x + 0.3, y: y + 1.85, w: hw - 0.6, h: 0.35, fontSize: 11, fontFace: F_BODY, color: C_WHITE, align: "center" });
    }
  }

  // ============= Slide 6: Chapter 02 =============
  chapterPage("02", "景点推荐", "8大亲子必玩景点");

  // ============= Slide 7: Beaches =============
  let s7 = pres.addSlide();
  s7.background = { color: C_CREAM };
  s7.addText("海滩推荐 -- 安全玩沙首选", {
    x: 0.5, y: 0.3, w: 12.33, h: 0.7,
    fontSize: 26, bold: true, fontFace: F_TITLE, color: C_DARK, align: "center"
  });
  // Left: Kata Beach
  s7.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 1.2, w: 6.0, h: 5.8, fill: { color: C_WHITE }, rectRadius: 0.12, shadow: makeShadow() });
  await image.add(s7, imgPath("kata-beach-1200-899.jpg"), { x: 0.7, y: 1.4, w: 5.6, h: 2.6 }, { fit: "cover" });
  s7.addText("卡塔海滩 Kata Beach", { x: 0.7, y: 4.1, w: 5.6, h: 0.5, fontSize: 20, bold: true, fontFace: F_TITLE, color: C_DARK });
  s7.addText("普吉岛亲子首选海滩，沙质细腻坡度缓，浅水区宽阔适合儿童戏水。周边餐厅便利店齐全，Club Med普吉岛坐落于此，2026年新推「亲子绿洲」区域。浪小流缓，适合初学游泳的孩子。", {
    x: 0.7, y: 4.65, w: 5.6, h: 2.0, fontSize: 14, fontFace: F_BODY, color: C_TEXT, lineSpacingMultiple: 1.5
  });
  // Right: Kamala Beach
  s7.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.83, y: 1.2, w: 6.0, h: 5.8, fill: { color: C_WHITE }, rectRadius: 0.12, shadow: makeShadow() });
  await image.add(s7, imgPath("kamala-beach-1080-1591.jpg"), { x: 7.03, y: 1.4, w: 5.6, h: 2.6 }, { fit: "cover" });
  s7.addText("卡马拉海滩 Kamala Beach", { x: 7.03, y: 4.1, w: 5.6, h: 0.5, fontSize: 20, bold: true, fontFace: F_TITLE, color: C_DARK });
  s7.addText("位于西海岸北段，比芭东安静许多，沙滩宽阔人流少。太阳之翼亲子度假村紧邻海滩，8个泳池+水滑梯+儿童俱乐部。距梦幻嘉年华仅10分钟车程，适合搭配游玩。", {
    x: 7.03, y: 4.65, w: 5.6, h: 2.0, fontSize: 14, fontFace: F_BODY, color: C_TEXT, lineSpacingMultiple: 1.5
  });

  // ============= Slide 8: Theme Parks =============
  let s8 = pres.addSlide();
  s8.background = { color: C_CREAM };
  s8.addText("乐园推荐 -- 孩子玩到不想走", {
    x: 0.5, y: 0.3, w: 12.33, h: 0.7,
    fontSize: 26, bold: true, fontFace: F_TITLE, color: C_DARK, align: "center"
  });
  const parks = [
    { img: "andamanda-waterpark-4608-3456.jpg", name: "安达曼大水上乐园", price: "约250元/人", desc: "普吉岛最大水上乐园，5大主题区域25条滑道，设儿童专用戏水区。开放10:00-18:00，建议安排半天至全天。" },
    { img: "carnival-magic-1080-1410.jpg", name: "梦幻嘉年华", price: "约400元/成人", desc: "2026暑假重头戏，耗资50亿泰铢。4000万盏LED灯+88辆花车游行，100cm以下免门票。周一/三/六 17:30-23:30。" },
    { img: "sugar-glider-800-1561.jpg", name: "Sugar Glider探险乐园", price: "约150元/人", desc: "2026最新亲子景点，位于Blue Tree内。高空安全穿越悬索桥、平衡木、室内滑索，全程绑带保护，全室内环境。" },
  ];
  {
    const pw = 3.9, pgap = 0.3;
    for (let i = 0; i < parks.length; i++) {
      const p = parks[i];
      const x = 0.7 + i * (pw + pgap);
      const y = 1.2;
      s8.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: pw, h: 5.8, fill: { color: C_WHITE }, rectRadius: 0.12, shadow: makeShadow() });
      await image.add(s8, imgPath(p.img), { x: x + 0.15, y: y + 0.2, w: pw - 0.3, h: 2.8 }, { fit: "cover" });
      s8.addText(p.name, { x: x + 0.2, y: y + 3.15, w: pw - 0.4, h: 0.5, fontSize: 17, bold: true, fontFace: F_TITLE, color: C_DARK });
      s8.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.2, y: y + 3.65, w: 1.8, h: 0.35, fill: { color: C_CORAL }, rectRadius: 0.05 });
      s8.addText(p.price, { x: x + 0.2, y: y + 3.65, w: 1.8, h: 0.35, fontSize: 12, bold: true, fontFace: F_BODY, color: C_WHITE, align: "center", valign: "middle" });
      s8.addText(p.desc, { x: x + 0.2, y: y + 4.15, w: pw - 0.4, h: 1.5, fontSize: 12, fontFace: F_BODY, color: C_TEXT, lineSpacingMultiple: 1.4 });
    }
  }

  // ============= Slide 9: Nature =============
  let s9 = pres.addSlide();
  s9.background = { color: C_CREAM };
  s9.addText("自然体验 -- 大象与海岛", {
    x: 0.5, y: 0.3, w: 12.33, h: 0.7,
    fontSize: 26, bold: true, fontFace: F_TITLE, color: C_DARK, align: "center"
  });
  s9.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 1.2, w: 6.0, h: 5.8, fill: { color: C_WHITE }, rectRadius: 0.12, shadow: makeShadow() });
  await image.add(s9, imgPath("elephant-sanctuary-1080-720.jpg"), { x: 0.7, y: 1.4, w: 5.6, h: 2.6 }, { fit: "cover" });
  s9.addText("奈迪大象保护营", { x: 0.7, y: 4.1, w: 5.6, h: 0.5, fontSize: 20, bold: true, fontFace: F_TITLE, color: C_DARK });
  s9.addText("2026全球100亲子景点，可近距离喂食、洗澡、互动大象。全程无骑乘，强调动物保护教育。半日游约350元/人含接送，适合6岁孩子，培养爱心与自然意识。", {
    x: 0.7, y: 4.65, w: 5.6, h: 2.0, fontSize: 14, fontFace: F_BODY, color: C_TEXT, lineSpacingMultiple: 1.5
  });
  s9.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.83, y: 1.2, w: 6.0, h: 5.8, fill: { color: C_WHITE }, rectRadius: 0.12, shadow: makeShadow() });
  await image.add(s9, imgPath("khai-island-1080-1204.jpg"), { x: 7.03, y: 1.4, w: 5.6, h: 2.6 }, { fit: "cover" });
  s9.addText("蛋岛半日游 Khai Island", { x: 7.03, y: 4.1, w: 5.6, h: 0.5, fontSize: 20, bold: true, fontFace: F_TITLE, color: C_DARK });
  s9.addText("距普吉本岛仅20分钟快艇，由3个蛋型小岛组成。水浅浪平鱼多，是普吉最适合亲子的跳岛首选。半日游约168元/人含浮潜装备+接送+水果饮料，上午或下午场可选。", {
    x: 7.03, y: 4.65, w: 5.6, h: 2.0, fontSize: 14, fontFace: F_BODY, color: C_TEXT, lineSpacingMultiple: 1.5
  });

  // ============= Slide 10: Culture =============
  let s10 = pres.addSlide();
  s10.background = { color: C_CREAM };
  s10.addText("文化体验 -- 普吉老镇", {
    x: 0.5, y: 0.3, w: 12.33, h: 0.7,
    fontSize: 26, bold: true, fontFace: F_TITLE, color: C_DARK, align: "center"
  });
  s10.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 1.2, w: 6.0, h: 5.8, fill: { color: C_WHITE }, rectRadius: 0.12, shadow: makeShadow() });
  await image.add(s10, imgPath("phuket-oldtown-1440-1890.jpg"), { x: 0.7, y: 1.4, w: 5.6, h: 2.6 }, { fit: "cover" });
  s10.addText("普吉老镇 Old Town", { x: 0.7, y: 4.1, w: 5.6, h: 0.5, fontSize: 20, bold: true, fontFace: F_TITLE, color: C_DARK });
  s10.addText("百年中葡式骑楼建筑群，彩色街道适合拍照漫步。周日夜市彩灯挂满骑楼。适合安排在行程中段作为「休息日」活动，逛吃结合。建议傍晚前往避开高温，2-3小时即可。", {
    x: 0.7, y: 4.65, w: 5.6, h: 2.0, fontSize: 14, fontFace: F_BODY, color: C_TEXT, lineSpacingMultiple: 1.5
  });
  s10.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.83, y: 1.2, w: 6.0, h: 5.8, fill: { color: C_WHITE }, rectRadius: 0.12, shadow: makeShadow() });
  await image.add(s10, imgPath("chillva-market-1080-1409.jpg"), { x: 7.03, y: 1.4, w: 5.6, h: 2.6 }, { fit: "cover" });
  s10.addText("青蛙夜市 Chillva Market", { x: 7.03, y: 4.1, w: 5.6, h: 0.5, fontSize: 20, bold: true, fontFace: F_TITLE, color: C_DARK });
  s10.addText("普吉最有氛围的夜市，灯串+现场乐队+火山排骨。适合带孩子体验当地烟火气，离芭东较近。建议晚饭时间前往，1-2小时逛吃即可。人均消费约50-80元。", {
    x: 7.03, y: 4.65, w: 5.6, h: 2.0, fontSize: 14, fontFace: F_BODY, color: C_TEXT, lineSpacingMultiple: 1.5
  });

  // ============= Slide 11: Chapter 03 =============
  chapterPage("03", "出行路线", "7天6晚逐日安排");

  // ============= Helper: Timeline slide =============
  function timelineSlide(title, days) {
    let s = pres.addSlide();
    s.background = { color: C_CREAM };
    s.addText(title, { x: 0.5, y: 0.3, w: 12.33, h: 0.7, fontSize: 26, bold: true, fontFace: F_TITLE, color: C_DARK, align: "center" });
    const lineX = 2.0;
    s.addShape(pres.shapes.LINE, { x: lineX, y: 1.3, w: 0, h: 5.5, line: { color: C_SKY, width: 3 } });
    let dy = 1.3;
    const cardH = 2.55;
    const gap = 0.3;
    for (const d of days) {
      s.addShape(pres.shapes.OVAL, { x: lineX - 0.15, y: dy + 0.1, w: 0.3, h: 0.3, fill: { color: C_CORAL } });
      s.addText(d.day, { x: 0.3, y: dy, w: 1.5, h: 0.5, fontSize: 18, bold: true, fontFace: F_TITLE, color: C_CORAL, align: "right", valign: "middle" });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 2.4, y: dy, w: 10.4, h: cardH, fill: { color: C_WHITE }, rectRadius: 0.1, shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 45, opacity: 0.08 } });
      s.addText(d.title, { x: 2.6, y: dy + 0.1, w: 10.0, h: 0.4, fontSize: 15, bold: true, fontFace: F_TITLE, color: C_DARK });
      s.addText(d.desc, { x: 2.6, y: dy + 0.5, w: 10.0, h: cardH - 0.6, fontSize: 12, fontFace: F_BODY, color: C_TEXT, lineSpacingMultiple: 1.4 });
      dy += cardH + gap;
    }
  }

  // ============= Slide 12: Day 1-2 =============
  timelineSlide("Day 1-2 抵达适应 + 海滩老镇", [
    { day: "Day 1", title: "上海 -> 普吉岛  抵达适应", desc: "上午浦东机场出发直飞约5小时，下午抵达普吉机场。Grab打车至酒店约180元（30-50分钟）。入住卡塔或卡马拉海滩酒店，傍晚酒店泳池放松，附近餐厅简单晚餐。行程轻松，让孩子适应热带气候。" },
    { day: "Day 2", title: "卡塔海滩 + 普吉老镇 + 青蛙夜市", desc: "上午卡塔海滩玩沙戏水（免费），租遮阳伞约50泰铢。中午回酒店午休避高温。下午4点出发普吉老镇漫步拍照（免费），逛彩色骑楼街道。傍晚青蛙夜市吃晚餐，体验当地烟火气。人均餐饮约80元/天。" },
  ]);

  // ============= Slide 13: Day 3-4 =============
  timelineSlide("Day 3-4 跳岛出海 + 大象乐园", [
    { day: "Day 3", title: "蛋岛半日游  亲子跳岛首选", desc: "上午参加蛋岛半日跳岛游（约168元/人含接送），快艇20分钟抵达。水浅鱼多适合6岁孩子浮潜初体验，岛上玩沙拍照。中午返回酒店休息，下午酒店泳池+自由活动。傍晚卡塔海滩看日落。" },
    { day: "Day 4", title: "大象保护营 + 安达曼水上乐园", desc: "上午奈迪大象保护营半日游（约350元/人），喂食洗澡互动大象。中午回酒店休息。下午安达曼大水上乐园（约250元/人），儿童戏水区+多条滑道，玩到闭园。这是行程中最丰富的一天。" },
  ]);

  // ============= Slide 14: Day 5-6 =============
  timelineSlide("Day 5-6 嘉年华 + 自由活动", [
    { day: "Day 5", title: "梦幻嘉年华  夜间LED灯海盛宴", desc: "白天酒店自由活动，上午海滩散步+酒店泳池。下午休息避暑。傍晚5:30出发梦幻嘉年华（门票约400元/成人，100cm以下免费），40英亩LED灯海+88辆花车游行+儿童魔术棒体验。自助晚餐含门票，夜间活动完美避暑。" },
    { day: "Day 6", title: "自由活动 + 购物 + 海鲜大餐", desc: "上午海滩最后玩水或酒店儿童俱乐部托管。中午退房寄存行李。下午江西冷购物中心或Central Festival买伴手礼。傍晚拉威海鲜市场自选海鲜代加工，人均约150元吃大餐。晚上回酒店整理行李。" },
  ]);

  // ============= Slide 15: Day 7 =============
  let s15 = pres.addSlide();
  s15.background = { color: C_CREAM };
  s15.addText("Day 7 返程", { x: 0.5, y: 0.3, w: 12.33, h: 0.7, fontSize: 26, bold: true, fontFace: F_TITLE, color: C_DARK, align: "center" });
  s15.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 2, y: 1.5, w: 9.33, h: 4.5, fill: { color: C_WHITE }, rectRadius: 0.15, shadow: { type: "outer", color: "000000", blur: 8, offset: 3, angle: 45, opacity: 0.12 } });
  await image.add(s15, { data: icons.planedep, width: 256, height: 256 }, { x: 6.17, y: 1.8, w: 1.0, h: 1.0 }, { fit: "contain" });
  s15.addText("普吉岛 -> 上海", { x: 2.5, y: 2.9, w: 8.33, h: 0.5, fontSize: 24, bold: true, fontFace: F_TITLE, color: C_DARK, align: "center" });
  s15.addText([
    { text: "上午酒店早餐+最后海滩散步", options: { breakLine: true } },
    { text: "中午退房，Grab打车至普吉机场（约180元）", options: { breakLine: true } },
    { text: "机场免税店购物，下午航班飞回上海（约5小时）", options: { breakLine: true } },
    { text: "晚上抵达上海，行程圆满结束", options: {} }
  ], { x: 3, y: 3.6, w: 7.33, h: 2.0, fontSize: 15, fontFace: F_BODY, color: C_TEXT, lineSpacingMultiple: 1.6, bullet: true });

  // ============= Slide 16: Chapter 04 =============
  chapterPage("04", "人均预算", "六大费用明细");

  // ============= Slide 17: Budget Table =============
  let s17 = pres.addSlide();
  s17.background = { color: C_CREAM };
  s17.addText("人均预算明细（一家三口）", { x: 0.5, y: 0.3, w: 12.33, h: 0.7, fontSize: 26, bold: true, fontFace: F_TITLE, color: C_DARK, align: "center" });
  const hdr = (txt) => ({ text: txt, options: { fill: { color: C_SKY }, color: C_WHITE, bold: true, fontSize: 14, fontFace: F_TITLE, align: "center", valign: "middle" } });
  const cell = (txt) => ({ text: txt, options: { fontSize: 13, fontFace: F_BODY, color: C_TEXT } });
  const cellC = (txt) => ({ text: txt, options: { fontSize: 13, fontFace: F_BODY, color: C_TEXT, align: "center" } });
  const cellL = (txt) => ({ text: txt, options: { fontSize: 13, fontFace: F_BODY, color: C_TEXT, fill: { color: C_LIGHT } } });
  const cellLC = (txt) => ({ text: txt, options: { fontSize: 13, fontFace: F_BODY, color: C_TEXT, align: "center", fill: { color: C_LIGHT } } });
  const cellS = (txt) => ({ text: txt, options: { fontSize: 12, fontFace: F_BODY, color: C_TEXT } });
  const cellSL = (txt) => ({ text: txt, options: { fontSize: 12, fontFace: F_BODY, color: C_TEXT, fill: { color: C_LIGHT } } });
  const totH = (txt) => ({ text: txt, options: { fontSize: 15, bold: true, fontFace: F_TITLE, color: C_WHITE, fill: { color: C_CORAL }, align: "center", valign: "middle" } });
  const totC = (txt) => ({ text: txt, options: { fontSize: 15, bold: true, fontFace: "Arial", color: C_WHITE, fill: { color: C_CORAL }, align: "center", valign: "middle" } });
  const totL = (txt) => ({ text: txt, options: { fontSize: 13, bold: true, fontFace: F_TITLE, color: C_WHITE, fill: { color: C_CORAL }, valign: "middle" } });
  const budgetRows = [
    [hdr("费用类别"), hdr("成人(元)"), hdr("儿童(元)"), hdr("备注")],
    [cell("机票(往返含税)"), cellC("3,500"), cellC("2,800"), cellS("春秋/上航暑期价,提前2个月订")],
    [cellL("住宿(6晚)"), cellLC("1,360"), cellLC("1,360"), cellSL("四星海滩酒店含早 680元/晚")],
    [cell("餐饮(7天)"), cellC("700"), cellC("500"), cellS("含一顿海鲜大餐150元")],
    [cellL("门票/活动"), cellLC("1,168"), cellLC("850"), cellSL("蛋岛+大象+水上乐园+嘉年华")],
    [cell("当地交通"), cellC("200"), cellC("200"), cellS("Grab打车+包车 600元/7天")],
    [cellL("其他"), cellLC("400"), cellLC("400"), cellSL("保险/购物/小费")],
    [totH("合计"), totC("8,328"), totC("6,310"), totL("一家三口总计约 22,966 元")],
  ];
  s17.addTable(budgetRows, {
    x: 0.7, y: 1.2, w: 11.93,
    colW: [3.2, 1.8, 1.8, 5.13],
    rowH: [0.55, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.6],
    border: { pt: 1, color: "CFD8DC" }
  });

  // ============= Slide 18: Budget Notes =============
  let s18 = pres.addSlide();
  s18.background = { color: C_CREAM };
  s18.addText("预算说明与省钱贴士", { x: 0.5, y: 0.3, w: 12.33, h: 0.7, fontSize: 26, bold: true, fontFace: F_TITLE, color: C_DARK, align: "center" });
  s18.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 1.2, w: 11.93, h: 1.0, fill: { color: C_LIGHTORANGE }, rectRadius: 0.1 });
  s18.addText("2026年价格说明：普吉岛旅游成本较2025年上涨约30-40%，出海一日游涨幅最大（皇帝岛珊瑚岛从315元涨至479元）。暑期为旺季，酒店和机票价格上浮20-30%。", {
    x: 0.9, y: 1.3, w: 11.53, h: 0.8, fontSize: 13, fontFace: F_BODY, color: C_DARK, valign: "middle", lineSpacingMultiple: 1.4
  });
  const tips = [
    { num: "1", title: "提前订机票", desc: "提前2个月锁定低价，关注东航8日/春秋9日/27日会员日抢特价票。7月5日后燃油费下调，往返可省150元/人。" },
    { num: "2", title: "选含早酒店", desc: "四星海滩酒店含早约680元/晚，早餐吃好省上午一顿。部分酒店儿童免费入住和早餐。" },
    { num: "3", title: "半日游替代全日", desc: "蛋岛半日游168元 vs 皇帝岛全日游479元，6岁孩子半日游体验已足够，省时省钱省体力。" },
    { num: "4", title: "夜市吃晚餐", desc: "青蛙夜市/拉威海鲜市场人均50-80元，比餐厅便宜一半且体验更好。" },
  ];
  {
    const tw = 5.8, th = 2.0, tgx = 0.5, tgy = 0.3;
    for (let i = 0; i < tips.length; i++) {
      const t = tips[i];
      const col = i % 2, row = Math.floor(i / 2);
      const x = 0.7 + col * (tw + tgx);
      const y = 2.5 + row * (th + tgy);
      s18.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: tw, h: th, fill: { color: C_WHITE }, rectRadius: 0.1, shadow: makeShadow() });
      s18.addShape(pres.shapes.OVAL, { x: x + 0.2, y: y + 0.25, w: 0.5, h: 0.5, fill: { color: C_CORAL } });
      s18.addText(t.num, { x: x + 0.2, y: y + 0.25, w: 0.5, h: 0.5, fontSize: 18, bold: true, fontFace: "Arial", color: C_WHITE, align: "center", valign: "middle" });
      s18.addText(t.title, { x: x + 0.85, y: y + 0.25, w: tw - 1.1, h: 0.5, fontSize: 17, bold: true, fontFace: F_TITLE, color: C_DARK, valign: "middle" });
      s18.addText(t.desc, { x: x + 0.25, y: y + 0.85, w: tw - 0.5, h: th - 1.0, fontSize: 13, fontFace: F_BODY, color: C_TEXT, lineSpacingMultiple: 1.4 });
    }
  }

  // ============= Slide 19: Chapter 05 =============
  chapterPage("05", "实用Tips", "出行准备与注意事项");

  // ============= Slide 20: Checklist =============
  let s20 = pres.addSlide();
  s20.background = { color: C_CREAM };
  s20.addText("出行准备清单", { x: 0.5, y: 0.3, w: 12.33, h: 0.7, fontSize: 26, bold: true, fontFace: F_TITLE, color: C_DARK, align: "center" });
  const checklist = [
    { icon: icons.passport, title: "证件类", items: "护照(有效期6个月以上)\n返程机票行程单\n酒店预订单\n儿童出生证明复印件" },
    { icon: icons.sun, title: "防晒类", items: "SPF50+儿童物理防晒霜\n宽檐防晒帽\nUV防护泳衣\n墨镜" },
    { icon: icons.bug, title: "防蚊类", items: "儿童驱蚊贴\n电蚊香液\n泰国蚊虫较多尤其傍晚" },
    { icon: icons.pills, title: "药品类", items: "儿童退烧药\n创可贴\n晕船药(出海必备)\n防腹泻药、电解质冲剂" },
    { icon: icons.tshirt, title: "亲子装备", items: "速干衣3-4套\n防滑溯溪鞋\n儿童浮潜面罩\n防水手机袋、便携小风扇" },
    { icon: icons.simcard, title: "其他", items: "泰国电话卡或国际漫游\n旅行保险(含医疗evacuation)" },
  ];
  {
    const clW = 3.7, clH = 2.7, clGx = 0.45, clGy = 0.3;
    for (let i = 0; i < checklist.length; i++) {
      const item = checklist[i];
      const col = i % 3, row = Math.floor(i / 3);
      const x = 0.7 + col * (clW + clGx);
      const y = 1.2 + row * (clH + clGy);
      s20.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: clW, h: clH, fill: { color: C_WHITE }, rectRadius: 0.12, shadow: makeShadow() });
      s20.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, fill: { color: C_SKY } });
      await placeIcon(s20, item.icon, x + 0.35, y + 0.35, 0.4, 0.4);
      s20.addText(item.title, { x: x + 1.0, y: y + 0.25, w: clW - 1.2, h: 0.6, fontSize: 17, bold: true, fontFace: F_TITLE, color: C_DARK, valign: "middle" });
      s20.addText(item.items, { x: x + 0.25, y: y + 1.0, w: clW - 0.5, h: clH - 1.2, fontSize: 12, fontFace: F_BODY, color: C_TEXT, lineSpacingMultiple: 1.4 });
    }
  }

  // ============= Slide 21: Safety =============
  let s21 = pres.addSlide();
  s21.background = { color: C_CREAM };
  s21.addText("安全与注意事项", { x: 0.5, y: 0.3, w: 12.33, h: 0.7, fontSize: 26, bold: true, fontFace: F_TITLE, color: C_DARK, align: "center" });
  const safety = [
    { icon: icons.lifering, title: "水上安全", desc: "6岁孩子出海必须穿儿童救生衣（船家一般提供但尺寸偏大，建议自备或确认）。浮潜时家长全程陪同，选择水浅浪平的蛋岛而非深水区。酒店泳池注意是否有救生员。" },
    { icon: icons.sun, title: "防晒防暑", desc: "暑假紫外线极强，上午10点至下午3点避免暴晒。每小时补涂防晒，大量饮水。孩子中暑症状：面色苍白、嗜睡、呕吐，立即阴凉处休息补充电解质。" },
    { icon: icons.utensils, title: "饮食安全", desc: "只喝瓶装水，避免生冷海鲜。路边摊选择人气高、翻台快的。儿童肠胃敏感，首两天以清淡为主。" },
    { icon: icons.car, title: "交通安全", desc: "普吉岛靠左行驶，过马路先看右。Grab打车比路边出租车便宜且安全。租摩托车不建议带儿童。" },
  ];
  {
    const sfW = 5.8, sfH = 2.7, sfGx = 0.5, sfGy = 0.3;
    for (let i = 0; i < safety.length; i++) {
      const item = safety[i];
      const col = i % 2, row = Math.floor(i / 2);
      const x = 0.7 + col * (sfW + sfGx);
      const y = 1.2 + row * (sfH + sfGy);
      s21.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: sfW, h: sfH, fill: { color: C_WHITE }, rectRadius: 0.12, shadow: makeShadow() });
      s21.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.6, h: 0.6, fill: { color: C_CORAL } });
      await placeIcon(s21, item.icon, x + 0.35, y + 0.35, 0.4, 0.4);
      s21.addText(item.title, { x: x + 1.0, y: y + 0.25, w: sfW - 1.2, h: 0.6, fontSize: 17, bold: true, fontFace: F_TITLE, color: C_DARK, valign: "middle" });
      s21.addText(item.desc, { x: x + 0.25, y: y + 1.0, w: sfW - 0.5, h: sfH - 1.2, fontSize: 13, fontFace: F_BODY, color: C_TEXT, lineSpacingMultiple: 1.5 });
    }
  }

  // ============= Slide 22: Thank You =============
  let s22 = pres.addSlide();
  s22.background = { color: C_SKY };
  s22.addText("THANK YOU", { x: 1, y: 2.0, w: 11.33, h: 1.5, fontSize: 60, bold: true, fontFace: "Arial", color: C_WHITE, align: "center", charSpacing: 8, valign: "middle" });
  s22.addText("祝火哥一家普吉岛之旅愉快！", { x: 1, y: 3.5, w: 11.33, h: 0.6, fontSize: 22, fontFace: F_TITLE, color: C_WHITE, align: "center" });
  s22.addText("本攻略基于2026年暑期最新信息整理，实际价格以出行时为准", { x: 1, y: 4.3, w: 11.33, h: 0.5, fontSize: 14, fontFace: F_BODY, color: C_WHITE, align: "center", transparency: 20 });
  s22.addText("行程可根据孩子状态灵活调整，核心原则：不赶路、不暴晒、留足休息", { x: 1, y: 4.8, w: 11.33, h: 0.5, fontSize: 14, fontFace: F_BODY, color: C_WHITE, align: "center", transparency: 20 });

  // Write
  const OUT = path.resolve(WORKDIR, "output.pptx");
  await pres.writeFile({ fileName: OUT });
  console.log("written:", OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
