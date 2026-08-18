import asyncio, edge_tts, json, os, sys

AUDIO_DIR = "poetry-garden/audio"
# 铁律：edge_tts 只发【纯文本】，绝不发 SSML。
# 若把 <speak version="1.0" ...> 当文本发给 edge_tts，它会把 "speak version 1.0 ..." 念出来，
# 用户听到的 "speak version 开头" 正是这个坑。停顿交给中文标点（。，）自然处理。
VOICE = os.environ.get("EDGE_VOICE", "zh-CN-XiaoxiaoNeural")

async def gen_text(text, out):
    c = edge_tts.Communicate(text, VOICE)
    await c.save(out)

def build_jobs(poems, mode):
    jobs = []  # (out_path, text)
    for p in poems:
        slug = p.get('slug')
        if not slug:
            print('SKIP no-slug', p.get('title')); continue
        if mode in ('full', 'both'):
            # 朗读顺序：标题。朝代。作者。诗句（朝代在作者前）
            parts = [x for x in [p.get('title'), p.get('dynasty'), p.get('author')] if x]
            body = ''.join(p.get('lines', []))
            full_text = '。'.join(parts) + '。' + body
            jobs.append((os.path.join(AUDIO_DIR, 'poem-%s.v5.mp3' % slug), full_text))
        if mode in ('line', 'both'):
            for i, ln in enumerate(p.get('lines', [])):
                jobs.append((os.path.join(AUDIO_DIR, 'poem-%s-%d.mp3' % (slug, i)), ln))
    return jobs

async def main():
    poems = json.load(open('_poems.json', encoding='utf-8'))
    mode = sys.argv[1] if len(sys.argv) > 1 else 'both'
    jobs = build_jobs(poems, mode)
    sem = asyncio.Semaphore(8)
    async def work(out, text):
        async with sem:
            try:
                await gen_text(text, out)
            except Exception as e:
                print('ERR', os.path.basename(out), repr(e))
    print('GENERATING', len(jobs), 'files (mode=%s, voice=%s)' % (mode, VOICE))
    await asyncio.gather(*[work(o, t) for o, t in jobs])
    print('ALL DONE')

asyncio.run(main())
