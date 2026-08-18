import asyncio, edge_tts, json, os, sys
from collections import Counter

AUDIO_DIR = "poetry-garden/audio"
# 铁律：edge_tts 只发【纯文本】，绝不发 SSML。
# 若把 <speak version="1.0" ...> 当文本发给 edge_tts，它会把 "speak version 1.0 ..." 念出来。
# 意境朗读用合法 prosody（rate/pitch）调制，由 edge_tts.Communicate(rate=,pitch=) 原生生成，
# 不需要 monkeypatch，绝不会"读代码"。express-as 风格是 Azure 付费能力，免费 Edge 端点一律拒绝。
VOICE = os.environ.get("EDGE_VOICE", "zh-CN-XiaoxiaoNeural")

# 意境 -> prosody 配置（rate/pitch 均在免费端点合法范围；已实测 rate -15%..+6% / pitch -4Hz..+3Hz 可用）
MOOD_PROFILES = {
    "serene":     {"rate": "-6%",  "pitch": "-1Hz", "label": "宁静淡远"},
    "melancholy": {"rate": "-12%", "pitch": "-3Hz", "label": "思乡悲愁"},
    "heroic":     {"rate": "+3%",  "pitch": "+2Hz", "label": "豪放雄壮"},
    "cheerful":   {"rate": "+6%",  "pitch": "+3Hz", "label": "明快欢畅"},
    "lyrical":    {"rate": "-4%",  "pitch": "+1Hz", "label": "婉约柔情"},
    "solemn":     {"rate": "-8%",  "pitch": "-2Hz", "label": "沉郁庄重"},
}
# 优先级（并列分时优先取前者）；serene 为默认兜底
MOOD_PRIORITY = ["cheerful", "lyrical", "melancholy", "heroic", "solemn", "serene"]

# 各意境关键词权重：serene 的泛自然词（山/水/月/风/花/鸟…）在近体诗里几乎 ubiquitous，
# 若不降权会把情感信号稀释成一片"宁静"，故对其降权；其余情感词保持 1.0。
MOOD_WEIGHT = {"serene": 0.4}
# 关键词 -> 意境（扫描 标题×3 / 作者×1 / 朝代×1 / 注解×0.5 / 诗句×1 计分）
MOOD_KEYWORDS = {
    "cheerful":   ["鹅","童","儿","戏","乐","喜","笑","稚","元日","闹","欢","风筝","牧","骑","歌","舞","放","鞭","灯"],
    "lyrical":    ["相思","情","恋","江南","闺","怨","柳","燕","梦","忆","妆","红","柔","依依","绵绵"],
    "melancholy": ["思","乡","愁","悲","泪","孤","独","寒","雪","夜","凉","亡","恨","客","归","肠","寂","哀","伤","别","哭","冷","残","暮","秋"],
    "heroic":     ["塞","战","军","将","兵","剑","关","豪","壮","沙场","征","戍","志","雄","岳","峰","黄河","长江","大江","沧海","江海"],
    "solemn":     ["史","古","怀古","咏史","理","哲","叹","世","念","兴亡","苦","农","民","汗","时","忧","国"],
    "serene":     ["山","水","林","田","园","云","月","风","花","鸟","舟","渔","隐","静","幽","空","泉","画","松","竹","梅","菊","溪","石","烟","霞"],
}

def classify_mood(p):
    title = (p.get("title") or "")
    author = (p.get("author") or "")
    dynasty = (p.get("dynasty") or "")
    note = (p.get("note") or "")
    lines = "".join(p.get("lines", []))
    scores = {m: 0.0 for m in MOOD_PROFILES}
    for m, kws in MOOD_KEYWORDS.items():
        w = MOOD_WEIGHT.get(m, 1.0)
        for kw in kws:
            if kw in title: scores[m] += 3 * w
            if kw in author: scores[m] += 1 * w
            if kw in dynasty: scores[m] += 1 * w
            if kw in note: scores[m] += 0.5 * w
            if kw in lines: scores[m] += 1 * w
    best, best_score = "serene", -1
    for m in MOOD_PRIORITY:  # 按优先级遍历，并列取优先
        if scores[m] > best_score:
            best, best_score = m, scores[m]
    return best if best_score > 0 else "serene"

async def gen_text(text, out, rate="+0%", pitch="+0Hz"):
    c = edge_tts.Communicate(text, VOICE, rate=rate, pitch=pitch)
    await c.save(out)

def build_jobs(poems, mode):
    jobs = []  # (out_path, text, rate, pitch)
    for p in poems:
        slug = p.get("slug")
        if not slug:
            print('SKIP no-slug', p.get('title')); continue
        parts = [x for x in [p.get('title'), p.get('dynasty'), p.get('author')] if x]
        body = ''.join(p.get('lines', []))
        full_text = '。'.join(parts) + '。' + body
        if mode in ('full', 'both', 'all'):
            jobs.append((os.path.join(AUDIO_DIR, 'poem-%s.v5.mp3' % slug), full_text, "+0%", "+0Hz"))
        if mode in ('mood', 'all'):
            mood = classify_mood(p)
            prof = MOOD_PROFILES[mood]
            jobs.append((os.path.join(AUDIO_DIR, 'poem-%s.v6.mp3' % slug), full_text, prof['rate'], prof['pitch']))
        if mode in ('note', 'both', 'all'):
            note = (p.get('note') or '').strip()
            if note:
                jobs.append((os.path.join(AUDIO_DIR, 'poem-%s.note.mp3' % slug), note, "+0%", "+0Hz"))
        if mode in ('line', 'both', 'all'):
            for i, ln in enumerate(p.get('lines', [])):
                jobs.append((os.path.join(AUDIO_DIR, 'poem-%s-%d.mp3' % (slug, i)), ln, "+0%", "+0Hz"))
    return jobs

def write_moods(poems):
    out = {}
    for p in poems:
        slug = p.get('slug')
        if not slug: continue
        m = classify_mood(p)
        out[slug] = {"mood": m, "label": MOOD_PROFILES[m]['label']}
    with open(os.path.join(AUDIO_DIR, 'moods.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=0)
    print('MOODS written:', dict(Counter(v['mood'] for v in out.values())))

async def main():
    poems = json.load(open('_poems.json', encoding='utf-8'))
    mode = sys.argv[1] if len(sys.argv) > 1 else 'both'
    jobs = build_jobs(poems, mode)
    sem = asyncio.Semaphore(8)
    async def work(out, text, rate, pitch):
        async with sem:
            try:
                await gen_text(text, out, rate, pitch)
            except Exception as e:
                print('ERR', os.path.basename(out), repr(e))
    print('GENERATING', len(jobs), 'files (mode=%s, voice=%s)' % (mode, VOICE))
    await asyncio.gather(*[work(o, t, r, pi) for o, t, r, pi in jobs])
    if mode in ('mood', 'all'):
        write_moods(poems)
    print('ALL DONE')

asyncio.run(main())
