# -*- coding: utf-8 -*-
"""Noto Serif SC 子集化脚本（T7）。

职责：
  1. 读取 .generated/font-chars.txt 字符清单（"# " 开头为注释，其余行是字符负载）；
  2. 对每个字重的 OTF 源做显式 cmap 缺字校验（缺失即报错退出，不静默忽略）；
  3. 用 fontTools.subset 生成 woff2 子集到 .generated/fonts/，并复制到 src/assets/fonts/
     供 Vite 以源码树内资源方式引用（hash 与 base 由 Vite 处理）；
  4. 以「字符清单 + 字体源文件 + fontTools 版本」的 hash 作为缓存键，无变化时跳过子集化。

运行方式（必须使用项目隔离环境，不全局安装）：
    cd tools/fonts && python -m venv .venv
    ./.venv/Scripts/python.exe -m pip install -r requirements.txt
    ./.venv/Scripts/python.exe scripts/prepare-fonts.py

等价的命令行调用（示例，与脚本内 Options 对应）：
    python -m fontTools.subset assets/fonts-source/NotoSerifSC-600.otf \
        --text-file=<纯字符临时文件> --flavor=woff2 --no-ignore-missing-unicodes \
        --name-IDs=0,1,2,3,4,5,6,13,14 \
        --output-file=.generated/fonts/noto-serif-sc-600.woff2
"""

import hashlib
import json
import sys
from importlib import metadata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "fonts-source"
GEN_FONTS_DIR = ROOT / ".generated" / "fonts"
CHAR_LIST_PATH = ROOT / ".generated" / "font-chars.txt"
DEST_DIR = ROOT / "src" / "assets" / "fonts"
CACHE_KEY_PATH = GEN_FONTS_DIR / ".cache-key.json"

# 由系统字体/图标呈现的符号（见 collect-font-chars.ts 的 FALLBACK_SYMBOLS），禁止进入衬线子集
FALLBACK_SYMBOLS = "◐☀☾☰✕→"

WEIGHTS = [
    # font-weight 与 src/styles/fonts.css 中的 @font-face 声明一一对应
    {"weight": 600, "source": "NotoSerifSC-600.otf", "output": "noto-serif-sc-600.woff2"},
    {"weight": 700, "source": "NotoSerifSC-700.otf", "output": "noto-serif-sc-700.woff2"},
]


def ensure_venv() -> None:
    """强制隔离环境：venv 内运行时 sys.prefix != sys.base_prefix"""
    if sys.prefix == getattr(sys, "base_prefix", sys.prefix):
        sys.exit(
            "错误：请在项目隔离 Python 环境中运行本脚本，例如：\n"
            "  tools/fonts/.venv/Scripts/python.exe scripts/prepare-fonts.py\n"
            "环境创建：cd tools/fonts && python -m venv .venv && "
            "./.venv/Scripts/python.exe -m pip install -r requirements.txt"
        )


def load_char_payload(path: Path) -> str:
    """读取字符清单：跳过 "# " 注释行与空行，其余行拼接为字符负载。

    注意不能对行做 strip()：空格本身是清单中的一个字符（如"演示项目 · …"
    中 · 两侧的空格），strip 会把单空格行误判为空行而静默丢字。
    """
    if not path.exists():
        sys.exit(f"错误：字符清单不存在：{path}\n先运行 npx tsx scripts/collect-font-chars.ts")
    lines = [
        line
        for line in path.read_text(encoding="utf-8").splitlines()
        if line != "" and not line.startswith("# ")
    ]
    payload = "".join(lines)
    if not payload:
        sys.exit(f"错误：字符清单为空：{path}")
    return payload


def check_font_source(source: Path, chars: set) -> dict:
    """字体源存在性与 cmap 缺字校验；返回 {missing} 之外的文件信息供缓存键使用"""
    if not source.exists():
        sys.exit(
            f"错误：字体源不存在：{source}\n"
            "按 task-7 报告的来源下载官方 OTF 静态实例并归档到 assets/fonts-source/（连同 OFL 许可）"
        )
    from fontTools.ttLib import TTFont

    font = TTFont(str(source), lazy=True)
    cmap = font.getBestCmap()
    missing = sorted(ch for ch in chars if ord(ch) not in cmap)
    font.close()
    if missing:
        detail = ", ".join(f"U+{ord(ch):04X}({ch})" for ch in missing)
        sys.exit(
            f"错误：{source.name} 缺少 {len(missing)} 个清单字符，拒绝静默忽略：{detail}\n"
            "处理方式：核对字符清单来源，或补齐字体源；不允许悄悄从清单中删除正常字符"
        )
    return {"path": str(source), "sha256": sha256_file(source)}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_options():
    """构造 fontTools.subset.Options：全部影响产物的选项集中在此，供缓存键引用"""
    from fontTools import subset

    options = subset.Options()
    options.flavor = "woff2"
    # 缺字不静默：清单字符在源字体 cmap 中缺失时抛 MissingUnicodesSubsettingError
    options.ignore_missing_unicodes = False
    # 保留许可与版权元信息（0=版权声明、13=许可描述、14=许可链接）
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    options.name_languages = ["*"]
    # 保留横向排版必需的布局特性（kern 字距、liga 连字、ccmp 组合、mark/mkmk 变音定位）；
    # 不保留 '*' 全量特性——那会把 vert 垂直变体等大量本站不会渲染的字形拉进闭包
    options.layout_features = ["kern", "liga", "ccmp", "mark", "mkmk"]
    # 站点为横向排版，垂直度量表没有渲染用途，一并丢弃
    options.drop_tables = list(set(options.drop_tables + ["vhea", "vmtx", "VORG"]))
    # 反子例程化后 brotli 压缩更充分（实测再省约 12%，无视觉差异）
    options.desubroutinize = True
    return options


def build_subset(source: Path, payload: str, output: Path, options) -> None:
    """用 fontTools.subset 生成 woff2 子集（等价于 brief 中的命令行示例）"""
    from fontTools import subset

    font = subset.load_font(str(source), options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=payload)
    subsetter.subset(font)
    output.parent.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(output), options)
    font.close()


def subset_options_tag(options) -> str:
    """把影响产物的子集化选项序列化进缓存键（T7 评审遗留：改选项曾须手删缓存才重建）。

    只纳入会改变输出字节的关键选项；调整选项后此串变化，缓存自动失效。
    """
    return json.dumps(
        {
            "flavor": options.flavor,
            "ignore_missing_unicodes": options.ignore_missing_unicodes,
            "name_IDs": options.name_IDs,
            "layout_features": options.layout_features,
            "desubroutinize": options.desubroutinize,
            "extra_dropped_tables": sorted(set(options.drop_tables) & {"vhea", "vmtx", "VORG"}),
        },
        sort_keys=True,
    )


def verify_license_metadata(path: Path) -> None:
    """输出文件须保留许可元信息（name ID 13/14 任一存在即可）"""
    from fontTools.ttLib import TTFont

    font = TTFont(str(path), lazy=True)
    names = getattr(font.get("name"), "names", [])
    ids = {record.nameID for record in names}
    font.close()
    if not ({13, 14} & ids):
        sys.exit(f"错误：{path.name} 未保留许可元信息（name ID 13/14 缺失）")


def main() -> None:
    ensure_venv()
    from fontTools.ttLib import TTFont  # noqa: F401  提前暴露依赖缺失

    payload = load_char_payload(CHAR_LIST_PATH)
    chars = set(payload)

    # 回退符号不得进入衬线子集
    leaked = sorted(ch for ch in chars if ch in FALLBACK_SYMBOLS)
    if leaked:
        detail = ", ".join(f"U+{ord(ch):04X}({ch})" for ch in leaked)
        sys.exit(f"错误：字符清单混入了回退符号（应由系统字体呈现）：{detail}")

    fonttools_version = metadata.version("fonttools")
    brotli_version = metadata.version("brotli")

    sources = [check_font_source(SOURCE_DIR / item["source"], chars) for item in WEIGHTS]

    options = build_options()

    # 缓存键：字符负载 + 各字体源内容 + 工具版本 + 子集化选项（改选项即自动重建）
    cache_key = hashlib.sha256(
        json.dumps(
            {
                "payload_sha256": hashlib.sha256(payload.encode("utf-8")).hexdigest(),
                "sources": sources,
                "fonttools": fonttools_version,
                "brotli": brotli_version,
                "options": subset_options_tag(options),
            },
            ensure_ascii=False,
            sort_keys=True,
        ).encode("utf-8")
    ).hexdigest()

    outputs = [GEN_FONTS_DIR / item["output"] for item in WEIGHTS]
    copies = [DEST_DIR / item["output"] for item in WEIGHTS]
    if (
        CACHE_KEY_PATH.exists()
        and CACHE_KEY_PATH.read_text(encoding="utf-8").strip() == cache_key
        and all(p.exists() and p.stat().st_size > 0 for p in outputs + copies)
    ):
        sizes = ", ".join(f"{p.name} {p.stat().st_size}B" for p in outputs)
        print(f"字符清单与字体源无变化，跳过子集化（缓存键 {cache_key[:12]}…）：{sizes}")
        return

    print(f"fonttools {fonttools_version} / brotli {brotli_version}，清单字符 {len(chars)} 个，开始子集化")
    for item, source in zip(WEIGHTS, sources):
        output = GEN_FONTS_DIR / item["output"]
        build_subset(Path(source["path"]), payload, output, options)
        verify_license_metadata(output)
        DEST_DIR.mkdir(parents=True, exist_ok=True)
        target = DEST_DIR / item["output"]
        target.write_bytes(output.read_bytes())
        print(
            f"  {item['source']} -> {output}（{output.stat().st_size}B）"
            f" -> {target}"
        )

    CACHE_KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_KEY_PATH.write_text(cache_key, encoding="utf-8")
    print(f"缓存键已更新：{CACHE_KEY_PATH}")


if __name__ == "__main__":
    main()
