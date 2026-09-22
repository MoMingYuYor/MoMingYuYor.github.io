# -*- coding: utf-8 -*-
"""Noto Serif SC 按字重子集化脚本（S1-T4）。

职责：
  1. 读取 `scripts/collect-font-chars.ts` 生成的字重清单
     `.generated/font-chars-600.txt` / `.generated/font-chars-700.txt`；
  2. 对字体源做显式 cmap 缺字校验：清单里有、字体源里没有的码位一律报错退出
     （`--no-ignore-missing-unicodes` 同义，见 `build_options`），不静默忽略；
  3. 用 `fontTools.subset` 生成 woff2，先写 `.generated/fonts/` 暂存，校验许可元信息与
     cmap 覆盖率后再落到已入库路径 `src/assets/fonts/`——避免子集化中途失败时留下半成品；
  4. 打印输入/输出字节数与字符数，供后续阶段做体积对比基线。

运行方式（必须使用项目隔离环境，不全局安装）：
    cd tools/fonts && python -m venv .venv
    ./.venv/Scripts/python.exe -m pip install -r requirements.txt
    npm run fonts:subset                     # 经 scripts/run-fonts-subset.mjs 定位 venv
    tools/fonts/.venv/Scripts/python.exe scripts/prepare-fonts.py 600   # 单档

等价的命令行调用（示例，与脚本内 Options 对应）：
    python -m fontTools.subset assets/fonts-source/NotoSerifSC-600.otf \
        --text-file=<字符清单> --flavor=woff2 --no-ignore-missing-unicodes \
        --name-IDs=0,1,2,3,4,5,6,13,14 \
        --output-file=src/assets/fonts/noto-serif-sc-600.woff2
"""

import hashlib
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "fonts-source"
GENERATED_DIR = ROOT / ".generated"
STAGING_DIR = GENERATED_DIR / "fonts"
DEST_DIR = ROOT / "src" / "assets" / "fonts"

WEIGHTS = [
    # font-weight 与 src/styles/fonts.css 的 @font-face 声明一一对应；
    # 字符清单由 scripts/collect-font-chars.ts 按字重分别生成，两档不共用同一份清单
    {"weight": 600, "source": "NotoSerifSC-600.otf", "output": "noto-serif-sc-600.woff2"},
    {"weight": 700, "source": "NotoSerifSC-700.otf", "output": "noto-serif-sc-700.woff2"},
]


def fail(message: str) -> None:
    """可读的错误出口：打印一行说明并以非零码退出，不抛堆栈"""
    print(f"错误：{message}", file=sys.stderr)
    sys.exit(1)


def ensure_venv() -> None:
    """强制隔离环境：venv 内运行时 sys.prefix != sys.base_prefix"""
    if sys.prefix == getattr(sys, "base_prefix", sys.prefix):
        fail(
            "请在项目隔离 Python 环境中运行本脚本（字体子集链路只在本机维护时运行）：\n"
            "  npm run fonts:subset\n"
            "  或 tools/fonts/.venv/Scripts/python.exe scripts/prepare-fonts.py\n"
            "环境创建：cd tools/fonts && python -m venv .venv && "
            "./.venv/Scripts/python.exe -m pip install -r tools/fonts/requirements.txt"
        )


def char_list_path(weight: int) -> Path:
    return GENERATED_DIR / f"font-chars-{weight}.txt"


def load_char_payload(path: Path) -> str:
    """读取字符清单：跳过 "# " 注释行与空行，其余行拼接为字符负载。

    不对行做 strip()：本清单每行一个字符，strip 会把空白字符行误判为空行而静默丢字。
    """
    if not path.exists():
        fail(
            f"字符清单不存在：{path}\n"
            "先运行 npm run fonts:collect（需要先有 npm run build 的产物 dist/）。"
        )
    lines = [
        line
        for line in path.read_text(encoding="utf-8").splitlines()
        if line != "" and not line.startswith("# ")
    ]
    payload = "".join(lines)
    if not payload:
        fail(f"字符清单为空：{path}\n先运行 npm run fonts:collect 重新生成。")
    return payload


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def check_font_source(source: Path, chars: set) -> None:
    """字体源存在性与 cmap 缺字校验：缺字即报错退出，不允许悄悄从清单中删除正常字符"""
    if not source.exists():
        fail(
            f"字体源不存在：{source}\n"
            "字体源不进仓库（assets/fonts-source/ 被忽略）。重建方式见 "
            "assets/fonts-source/sources.md：从原目录 D:\\Chatgpt\\个人主页\\assets\\fonts-source\\ "
            "复制官方 OTF 静态实例（含 OFL 许可与 sources.md）后再运行。"
        )
    from fontTools.ttLib import TTFont

    font = TTFont(str(source), lazy=True)
    cmap = font.getBestCmap()
    missing = sorted(ch for ch in chars if ord(ch) not in cmap)
    font.close()
    if missing:
        detail = ", ".join(f"U+{ord(ch):04X}({ch})" for ch in missing)
        fail(
            f"{source.name} 缺少 {len(missing)} 个清单字符，拒绝静默忽略：{detail}\n"
            "处理方式：核对字符清单来源，或补齐字体源；不允许悄悄从清单中删除正常字符。"
        )


def build_options():
    """构造 fontTools.subset.Options：影响产物的选项集中在此"""
    from fontTools import subset

    options = subset.Options()
    options.flavor = "woff2"
    # 缺字不静默：清单字符在源字体 cmap 中缺失时抛 MissingUnicodesSubsettingError
    options.ignore_missing_unicodes = False
    # 保留许可与版权元信息（0=版权声明、13=许可描述、14=许可链接）
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    options.name_languages = ["*"]
    # 保留横向排版必需的布局特性（kern 字距、liga 连字、ccmp 组合、mark/mkmk 变音定位）；
    # 不保留 '*' 全量特性——那会把 vert 垂直变体等本站不会渲染的字形拉进闭包
    options.layout_features = ["kern", "liga", "ccmp", "mark", "mkmk"]
    # 站点为横向排版，垂直度量表没有渲染用途，一并丢弃
    options.drop_tables = list(set(options.drop_tables + ["vhea", "vmtx", "VORG"]))
    # 反子例程化后 brotli 压缩更充分（旧链路实测再省约 12%，无视觉差异）
    options.desubroutinize = True
    return options


def build_subset(source: Path, payload: str, output: Path, options) -> None:
    """用 fontTools.subset 生成 woff2 子集"""
    from fontTools import subset

    font = subset.load_font(str(source), options)
    try:
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(text=payload)
        subsetter.subset(font)
        output.parent.mkdir(parents=True, exist_ok=True)
        subset.save_font(font, str(output), options)
    finally:
        font.close()


def verify_license_metadata(path: Path) -> None:
    """输出文件须保留许可元信息（name ID 13/14 任一存在即可）"""
    from fontTools.ttLib import TTFont

    font = TTFont(str(path), lazy=True)
    try:
        names = getattr(font.get("name"), "names", [])
        ids = {record.nameID for record in names}
    finally:
        font.close()
    if not ({13, 14} & ids):
        fail(f"{path.name} 未保留许可元信息（name ID 13/14 缺失）")


def verify_coverage(path: Path, chars: set) -> int:
    """打开产出文件，逐个校验清单码位都在子集 cmap 中；返回校验的码位数"""
    from fontTools.ttLib import TTFont

    font = TTFont(str(path), lazy=True)
    try:
        cmap = font.getBestCmap()
    finally:
        font.close()
    missing = sorted(ch for ch in chars if ord(ch) not in cmap)
    if missing:
        detail = ", ".join(f"U+{ord(ch):04X}({ch})" for ch in missing)
        fail(f"{path.name} 的 cmap 缺少 {len(missing)} 个清单码位：{detail}")
    return len(chars)


def subset_weight(item: dict, options) -> None:
    """单档流程：清单 → 缺字校验 → 子集化 → 许可与覆盖率校验 → 落到入库路径"""
    weight = item["weight"]
    source = SOURCE_DIR / item["source"]
    list_path = char_list_path(weight)
    payload = load_char_payload(list_path)
    chars = set(payload)

    check_font_source(source, chars)
    print(
        f"[{weight}] 字体源 {item['source']}（{source.stat().st_size:,}B，sha256 {sha256_file(source)[:12]}…）"
        f" + 清单 {list_path.name}（{len(chars)} 个字符）"
    )

    staged = STAGING_DIR / item["output"]
    build_subset(source, payload, staged, options)
    verify_license_metadata(staged)
    checked = verify_coverage(staged, chars)

    DEST_DIR.mkdir(parents=True, exist_ok=True)
    target = DEST_DIR / item["output"]
    previous = target.stat().st_size if target.exists() else None
    shutil.copyfile(staged, target)

    delta = "" if previous is None else f"，原产物 {previous:,}B（{target.stat().st_size - previous:+,}B）"
    print(
        f"[{weight}] 输出 {target.relative_to(ROOT).as_posix()}：{target.stat().st_size:,}B"
        f"{delta}；cmap 覆盖率校验 {checked}/{len(chars)} 码位通过；许可元信息已保留"
    )


def main() -> None:
    ensure_venv()
    try:
        import fontTools.ttLib  # noqa: F401  提前暴露依赖缺失
    except ImportError:
        fail(
            "隔离环境缺少 fonttools。请安装冻结版本依赖：\n"
            "  tools/fonts/.venv/Scripts/python.exe -m pip install -r tools/fonts/requirements.txt"
        )

    from fontTools import subset

    requested = sys.argv[1:]
    if requested:
        wanted = set()
        for raw in requested:
            if raw not in {"600", "700"}:
                fail(f"未知的字重参数：{raw}（只接受 600 或 700，或省略参数处理全部字重）")
            wanted.add(int(raw))
        items = [item for item in WEIGHTS if item["weight"] in wanted]
    else:
        items = list(WEIGHTS)

    options = build_options()
    try:
        for item in items:
            subset_weight(item, options)
    except subset.Subsetter.MissingUnicodesSubsettingError as error:
        # 上面的显式 cmap 校验已覆盖此情形；此处兜底，保证不以堆栈收场
        fail(f"字体源缺少清单中的码位，拒绝静默忽略：{error}")


if __name__ == "__main__":
    main()
