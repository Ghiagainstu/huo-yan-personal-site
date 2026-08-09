import os, subprocess, shutil

PNGQ = r"C:/Users/fireh/.workbuddy/binaries/pngquant/pngquant/pngquant.exe"
SRC = r"U:/儿童英语学习乐园/images/"
DST = r"D:/Fire/火哥的个人站/儿童英语学园/images/压缩后的image/"

os.makedirs(DST, exist_ok=True)

src_files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".png"))
print(f"源图数量: {len(src_files)}")

ok = skip = fail = 0
saved_total = 0
src_total = 0
for f in src_files:
    s = os.path.join(SRC, f)
    o = os.path.join(DST, f)
    try:
        sz_src = os.path.getsize(s)
        src_total += sz_src
        r = subprocess.run([PNGQ, "--force", "--skip-if-larger", "--strip",
                            "--quality", "40-100", "--output", o, s],
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if os.path.exists(o) and os.path.getsize(o) > 0:
            sz_out = os.path.getsize(o)
            saved_total += (sz_src - sz_out)
            ok += 1
        else:
            # skip-if-larger 触发：拷贝原图兜底，保证 422 张齐全
            shutil.copy2(s, o)
            skip += 1
    except Exception as e:
        fail += 1
        print("FAIL", f, e)

print(f"压缩写出: {ok} | skip-if-larger 兜底: {skip} | 失败: {fail}")
print(f"源总体积: {src_total/1024/1024:.1f} MB")
print(f"压缩后总体积: {(src_total-saved_total)/1024/1024:.1f} MB")
print(f"节省: {saved_total/1024/1024:.1f} MB  (-{saved_total/src_total*100:.1f}%)")
print("DONE")
