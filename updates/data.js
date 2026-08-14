/* 儿童英语学园 · 更新历程数据
 * 维护约定：每次上线更新后，在最前（数组第 0 项）追加一条：
 *   { date:'YYYY-MM-DD', title:'本次更新主题', points:[ '改动1', '改动2', ... ] }
 * 数组按日期倒序（新在前）。纯静态，push 即生效。
 */
window.EW_UPDATES = [
  {
    date: '2026-08-14',
    title: '防沉迷上线 + 图片修复',
    points: [
      '新增【防沉迷】：单次 20 分钟，到时友好锁屏；家长用 PIN 解锁可 +20 分钟/次，最多 2 次，日上限 1 小时',
      '防沉迷用量服务端持久化（D1），清缓存也无法重置；家长解锁提示改为「直接按阿拉伯数字」',
      '修复 doctor / vet / scientist / baker 的白大褂、厨师服被误抠成镂空的问题',
      '新增 funny（滑稽）、bug（昆虫）两张单词配图'
    ]
  },
  {
    date: '2026-08-13',
    title: '音标补全 + 登录修复 + 图片重抠',
    points: [
      '补全 56 个新加单词的英音 / 美音音标（如 hamster、cashier、grasshopper 等）',
      '修复「登录后刷新页面就退出」的问题，已上线',
      '重抠 12 张白色主体被误删的图（ghost / panda / ocean / dentist / clownfish / cook / barber / zebra / soccer / sea-monster / tuesday / saturday）',
      '20 张新单词配图（批次 1+2）同步上线'
    ]
  },
  {
    date: '2026-08-09',
    title: '项目立项',
    points: [
      '儿童英语学习乐园立项：800+ 单词 / 23 类生活主题',
      '卡片跟读 + 闯关游戏 + 打卡看板三大模块框架完成'
    ]
  }
];
