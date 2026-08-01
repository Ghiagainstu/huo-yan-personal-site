#!/usr/bin/env node
/*
 * gen-icons.js — 生成 PWA 占位图标（纯几何，无 canvas 依赖）。
 *   用 Node 内置 zlib 手搓合法 PNG：天空蓝(#6FC3E4) 圆角方块底 + 阳光黄(#FFC93C) 圆形"团子"。
 *   这是程序生成的几何占位图标，Sprint 02 换正式美术 PNG。
 *   运行：node tools/gen-icons.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

// CRC32（PNG chunk 校验用）
function crc32(buf) {
  var c, table = crc32._t;
  if (!table) {
    table = crc32._t = [];
    for (var n = 0; n < 256; n++) {
      c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
  }
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  var len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  var typeBuf = Buffer.from(type, 'latin1');
  var crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size) {
  var sky = [0x6F, 0xC3, 0xE4];      // #6FC3E4 天空蓝（底）
  var sun = [0xFF, 0xC9, 0x3C];      // #FFC93C 阳光黄（团子）
  var sunEdge = [0xE8, 0xA9, 0x2A];  // 更深的黄（团子描边，增强小尺寸辨识度）
  var radius = size * 0.18;          // 圆角半径
  var cx = size / 2, cy = size / 2;
  var circleR = size * 0.30;         // 团子半径
  var ringW = Math.max(2, size * 0.03);

  var raw = Buffer.alloc(size * (size * 4 + 1));
  var pos = 0;
  for (var y = 0; y < size; y++) {
    raw[pos++] = 0; // 每行过滤器：none
    for (var x = 0; x < size; x++) {
      var r = sky[0], g = sky[1], b = sky[2], a = 255;
      // 圆角：四角超出圆角半径的像素透明
      var dx = 0, dy = 0;
      if (x < radius && y < radius) { dx = radius - x; dy = radius - y; }
      else if (x > size - radius && y < radius) { dx = x - (size - radius); dy = radius - y; }
      else if (x < radius && y > size - radius) { dx = radius - x; dy = y - (size - radius); }
      else if (x > size - radius && y > size - radius) { dx = x - (size - radius); dy = y - (size - radius); }
      if (dx * dx + dy * dy > radius * radius) {
        a = 0;
      } else {
        // 团子（圆形）
        var ddx = x - cx, ddy = y - cy;
        var dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist <= circleR) {
          if (dist > circleR - ringW) { r = sunEdge[0]; g = sunEdge[1]; b = sunEdge[2]; }
          else { r = sun[0]; g = sun[1]; b = sun[2]; }
        }
      }
      raw[pos++] = r; raw[pos++] = g; raw[pos++] = b; raw[pos++] = a;
    }
  }

  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  var idat = zlib.deflateSync(raw, { level: 9 });
  var sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

var outDir = path.join(__dirname, '..');
[192, 512].forEach(function (s) {
  var png = makePng(s);
  var file = path.join(outDir, 'icon-' + s + '.png');
  fs.writeFileSync(file, png);
  console.log('wrote ' + file + '  (' + png.length + ' bytes)');
});
