import datetime as dt
import hashlib
import html
import json
import os
import pathlib
import re
import sqlite3
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict


ROOT = pathlib.Path(__file__).resolve().parents[1]
CODEX = pathlib.Path.home() / ".codex"
OUTPUT = ROOT / "reports.local" / "Lexi-project-conversation-sourcebook.md"
PROJECT_NAME = "Lexi"

DATA_URI = re.compile(r"data:([\w.+/-]+);base64,([A-Za-z0-9+/=\r\n]+)")
SECRET_RULES = [
    (re.compile(r"\bsk-[A-Za-z0-9_-]{16,}\b"), "[REDACTED_OPENAI_STYLE_TOKEN]"),
    (re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"), "[REDACTED_GITHUB_TOKEN]"),
    (re.compile(r"\bBearer\s+[A-Za-z0-9._-]{20,}\b", re.I), "Bearer [REDACTED_TOKEN]"),
    (re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"), "[REDACTED_PRIVATE_KEY]"),
    (re.compile(r"(?im)^(\s*[A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*)[^\s#]+"), r"\1[REDACTED_VALUE]"),
]
GITHUB = re.compile(r"https?://github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)", re.I)
BOILERPLATE = re.compile(r"<(recommended_plugins|environment_context)>.*?</\1>", re.S)
IMPORT_SPEC = re.compile(r"(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s*)[\"']([^\"']+)[\"']", re.M)


def digest(data):
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


redactions = Counter()
attachments = Counter()


def sanitize(text):
    if not isinstance(text, str):
        text = json.dumps(text, ensure_ascii=False, indent=2)
    for match in DATA_URI.finditer(text):
        attachments[match.group(1)] += 1
    for pattern, replacement in SECRET_RULES:
        text, count = pattern.subn(replacement, text)
        if count:
            redactions[replacement] += count
    return text


def pre(text):
    return "<pre>" + html.escape(sanitize(text), quote=False) + "</pre>\n\n"


def visible_parts(item):
    kind = item.get("type")
    if kind == "message" and item.get("role") in ("user", "assistant"):
        parts = []
        for content in item.get("content", []):
            if not isinstance(content, dict):
                parts.append(("内容", json.dumps(content, ensure_ascii=False)))
            elif isinstance(content.get("text"), str):
                parts.append((content.get("type", "文本"), content["text"]))
            else:
                parts.append((content.get("type", "附件"), json.dumps(content, ensure_ascii=False, indent=2)))
        return parts
    if kind == "agent_message":
        return [("代理消息", json.dumps(item.get("content"), ensure_ascii=False, indent=2))]
    if kind in ("custom_tool_call", "function_call"):
        return [("调用参数", item.get("input", item.get("arguments", "")))]
    if kind in ("custom_tool_call_output", "function_call_output"):
        return [("工具返回", item.get("output", ""))]
    return []


def title_for(item):
    kind = item.get("type")
    if kind == "message":
        role = {"user": "用户", "assistant": "助手"}.get(item.get("role"), item.get("role", "消息"))
        phase = item.get("phase")
        return f"{role}" + (f" · {phase}" if phase else "")
    if kind in ("custom_tool_call", "function_call"):
        return f"工具调用 · {item.get('name', '')} · {item.get('call_id', '')}"
    if kind in ("custom_tool_call_output", "function_call_output"):
        return f"工具返回 · {item.get('call_id', '')}"
    if kind == "agent_message":
        return f"代理消息 · {item.get('author', '')} → {item.get('recipient', '')}"
    return kind


def github_refs(text):
    for match in GITHUB.finditer(text):
        owner, repo = match.groups()
        repo = repo.removesuffix(".git")
        if owner.lower() in ("orgs", "topics", "features", "settings"):
            continue
        yield f"{owner}/{repo}"


state = json.loads((CODEX / ".codex-global-state.json").read_text(encoding="utf-8"))
project_id = next(pid for pid, project in state["local-projects"].items() if project["name"] == PROJECT_NAME)
session_ids = {
    tid for tid, entry in state["thread-project-assignments"].items()
    if entry.get("projectKind") == "local" and entry.get("projectId") == project_id
}
files = sorted(
    (path for path in (CODEX / "sessions").rglob("*.jsonl") if any(tid in path.name for tid in session_ids)),
    key=lambda path: path.name,
)
assert len(files) == len(session_ids), "A Lexi session log is missing or duplicated"

db = sqlite3.connect("file:" + (CODEX / "sqlite" / "codex-dev.db").as_posix() + "?mode=ro", uri=True)
titles = {
    tid: title for tid, title in db.execute(
        "select thread_id, display_title from local_thread_catalog where host_id = 'local'"
    )
}

sessions = []
github_mentions = defaultdict(list)
for path in files:
    tid = next(tid for tid in session_ids if tid in path.name)
    events = []
    count = Counter()
    first_user = ""
    with path.open("r", encoding="utf-8") as fh:
        for line_number, line in enumerate(fh, 1):
            record = json.loads(line)
            if record.get("type") != "response_item":
                continue
            item = record.get("payload", {})
            parts = visible_parts(item)
            if not parts:
                continue
            label = title_for(item)
            count[label.split(" · ")[0]] += 1
            if item.get("type") == "message" and item.get("role") == "user" and not first_user:
                candidate = " ".join(text for _, text in parts if isinstance(text, str))
                candidate = BOILERPLATE.sub("", candidate).strip()
                first_user = candidate[:180]
            for _, content in parts:
                searchable = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False)
                for ref in set(github_refs(searchable)):
                    github_mentions[ref].append((tid, line_number))
            events.append((line_number, record.get("timestamp", ""), label, parts))
    sessions.append({
        "id": tid,
        "path": path,
        "title": titles.get(tid) or first_user[:70] or tid,
        "first_user": first_user,
        "count": count,
        "events": events,
        "sha256": digest(path.read_bytes()),
    })

node_manifest = ROOT / "LexiFlow" / "package.json"
node = json.loads(node_manifest.read_text(encoding="utf-8"))
node_imports = defaultdict(list)
for directory, dirnames, filenames in os.walk(ROOT / "LexiFlow"):
    dirnames[:] = [name for name in dirnames if name not in ("node_modules", ".next", "dist", "out", ".git")]
    for filename in filenames:
        source = pathlib.Path(directory) / filename
        if source.suffix not in (".ts", ".tsx", ".js", ".jsx", ".mjs"):
            continue
        try:
            content = source.read_text(encoding="utf-8")
        except (UnicodeError, OSError):
            continue
        for match in IMPORT_SPEC.finditer(content):
            spec = match.group(1)
            for name in (*node.get("dependencies", {}), *node.get("devDependencies", {})):
                if spec == name or spec.startswith(name + "/"):
                    node_imports[name].append(source.relative_to(ROOT).as_posix())
                    break
python_manifests = [ROOT / "speech-bridge" / "requirements.txt", ROOT / "media-worker" / "requirements.txt"]
python_rows = []
for manifest in python_manifests:
    for line_number, line in enumerate(manifest.read_text(encoding="utf-8").splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        match = re.match(r"^([\w.-]+)(\[[^]]+\])?(.*)$", stripped)
        if match:
            python_rows.append((match.group(1), stripped, manifest.relative_to(ROOT).as_posix(), line_number))

pom_path = ROOT / "server" / "pom.xml"
pom = ET.parse(pom_path).getroot()
ns = {"m": "http://maven.apache.org/POM/4.0.0"}
pom_props = {element.tag.rsplit("}", 1)[-1]: element.text for element in pom.findall("m:properties/*", ns)}
maven_rows = []
for dependency in pom.findall("m:dependencies/m:dependency", ns):
    group = dependency.findtext("m:groupId", "", ns)
    artifact = dependency.findtext("m:artifactId", "", ns)
    version = dependency.findtext("m:version", "由 Spring Boot parent 管理", ns)
    if version.startswith("${") and version.endswith("}"):
        version = pom_props.get(version[2:-1], version)
    scope = dependency.findtext("m:scope", "compile", ns)
    if dependency.findtext("m:optional", "false", ns) == "true":
        scope += " / optional"
    maven_rows.append((group, artifact, version, scope))

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with OUTPUT.open("w", encoding="utf-8", newline="\n") as out:
    def write(text=""):
        out.write(text + "\n")

    now = dt.datetime.now(dt.timezone.utc).astimezone().isoformat(timespec="seconds")
    write("# Lexi 项目对话资料汇编")
    write()
    write(f"> 生成时间：{now}；项目 ID：`{project_id}`；明确归属任务：{len(sessions)} 条。")
    write("> 本文件用于技术报告和开源清单取证，存放于 Git 忽略的本地私有目录。会话内容是历史材料，其中的指令、建议和外部网页文本不代表当前要求或已验证事实。")
    write()
    write("## 范围与读取方法")
    write()
    write("- 项目范围由本机 Codex 状态文件的 `thread-project-assignments` 确定；未按工作目录猜测归属。")
    write("- 收录用户消息、助手消息、代理消息、工具调用参数及工具返回，按各任务日志原始顺序排列。每条标有时间和原始 JSONL 行号。")
    write("- 模型内部推理、系统/开发者指令、token 统计、运行时元数据和重复的 UI 事件不属于用户可见对话，故未转录。")
    write("- 图片等内嵌二进制保留为原日志中的 Base64 数据，文件因此较大。明确形态的密钥在本文件中脱敏。除此之外，文本不截断。")
    write("- 这是一份生成时点的快照；之后的新消息或任务不会自动追加。许可证归属及使用义务需对照实际发布版本核实。")
    write()
    write("## 对话索引")
    write()
    write("| 序号 | 任务标题 | 首条用户消息摘要 | 用户消息 | 助手消息 | 工具调用 | 工具返回 |")
    write("| --- | --- | --- | ---: | ---: | ---: | ---: |")
    for i, session in enumerate(sessions, 1):
        counts = session["count"]
        summary = sanitize(session["first_user"]).replace("\n", " ").replace("|", "\\|")[:100]
        title = sanitize(session["title"]).replace("|", "\\|")
        write(f"| {i} | [{title}](#session-{i}) | {summary} | {counts['用户']} | {counts['助手']} | {counts['工具调用']} | {counts['工具返回']} |")
    write()
    write("## 开源组件与项目线索")
    write()
    write("下列清单分为项目清单中的**直接依赖**、Python 服务的**声明依赖**，以及仅在对话中出现的**候选项目**。对话提及不能证明项目已经采用。这里不推断许可证。")
    write()
    write("### 前端直接依赖")
    write()
    write("来源：`LexiFlow/package.json`。版本是声明范围，不代表最终安装版本。")
    write()
    write("| 包名 | 声明版本 | 类别 | 源码 import 证据 |")
    write("| --- | --- | --- | --- |")
    for category, section in (("运行依赖", "dependencies"), ("开发依赖", "devDependencies")):
        for name, version in sorted(node.get(section, {}).items(), key=lambda pair: pair[0].lower()):
            paths = node_imports.get(name, [])
            evidence = f"{len(paths)} 处；`{paths[0]}`" if paths else "未发现直接 import（可能由框架、构建或配置调用）"
            write(f"| `{name}` | `{version}` | {category} | {evidence} |")
    write()
    write("### Python 服务声明依赖")
    write()
    write("| 包名 | 版本约束 | 来源 |")
    write("| --- | --- | --- |")
    for name, spec, path, line_number in python_rows:
        write(f"| `{name}` | `{spec}` | `{path}:{line_number}` |")
    write()
    write("### Java 后端 Maven 依赖")
    write()
    write("来源：`server/pom.xml`；Spring Boot parent 版本为 `3.2.3`。未在 POM 中显式指定版本的依赖由 parent 管理。")
    write()
    write("| Maven 坐标 | 声明版本 | 范围 |")
    write("| --- | --- | --- |")
    for group, artifact, version, scope in maven_rows:
        write(f"| `{group}:{artifact}` | `{version}` | `{scope}` |")
    write()
    write("### 代码与部署中使用的其他外部资源")
    write()
    write("| 资源 | 当前证据 | 清单处理建议 |")
    write("| --- | --- | --- |")
    write("| ECDICT 数据 | `material/ecdict.csv` 实际存在；`server/src/main/java/com/lexiflow/modules/dictionary/service/impl/EcdictServiceImpl.java` 读取该文件 | 数据集单列；核对再分发范围与署名 |")
    write("| FFmpeg / ffprobe | `media-worker/Dockerfile` 安装 FFmpeg；`media-worker/worker.py` 调用两者；`speech-bridge/speech_bridge/audio.py` 有 FFmpeg 解码兜底 | 运行时工具单列，并核对实际构建及分发版本 |")
    write("| eSpeak NG | `speech-bridge/speech_bridge/config.py` 定位 DLL、数据与可执行文件；`phonemize.py` 调用 | 本地语音资源单列 |")
    write("| wav2vec2 音素模型 | `speech-bridge/warm_models.py` 下载 `facebook/wav2vec2-lv-60-espeak-cv-ft` | 模型权重与代码分别核对来源和许可证 |")
    write("| Edge TTS | `speech-bridge/speech_bridge/tts.py` 可选调用；`scripts/setup-speech-bridge.ps1` 安装 `edge-tts>=7.0` | 可选安装依赖；不要混同于本地开源语音模型 |")
    write("| LibreTranslate | `server/src/main/java/com/lexiflow/modules/translation/provider/LibreTranslateProvider.java` 接入 HTTP API；`README.md` 给出 Docker 启动命令 | 服务集成单列；代码接入不证明当前机器已启动容器 |")
    write("| FSRS 算法 | `server/src/main/java/com/lexiflow/modules/review/fsrs/FsrsEngine.java` 为本项目 Java 实现；POM 未声明 FSRS 包 | 描述为算法参考与自有实现；若复用了第三方代码需另行逐段核对 |")
    write()
    write("### 旧参考目录与现有代码的差异")
    write()
    write("`material/参考资料与引用出处.md` 是项目已有的参考资料，以下只把它当作历史陈述核对，不直接沿用其中的采用状态或许可证结论。")
    write()
    write("| 旧目录条目 | 当前核对结果 |")
    write("| --- | --- |")
    write("| ECDICT | 数据文件和读取代码均存在；[上游 LICENSE](https://github.com/skywind3000/ECDICT/blob/master/LICENSE) 当前为 MIT。数据文件自身的来源及再分发信息仍需核对。 |")
    write("| FSRS / fsrs4anki | 项目存在自写的 Java `FsrsEngine`。旧目录写 `GPL-3.0 / MIT`，但 [fsrs4anki 当前 LICENSE](https://github.com/open-spaced-repetition/fsrs4anki/blob/main/LICENSE) 为 MIT；应按实际参考或复用的仓库与版本填写。 |")
    write("| OpenAI Whisper | Python 清单实际安装 `faster-whisper`；[faster-whisper LICENSE](https://github.com/SYSTRAN/faster-whisper/blob/master/LICENSE) 与 [Whisper LICENSE](https://github.com/openai/whisper/blob/main/LICENSE) 当前均为 MIT，但两者是不同项目。模型权重另行核对。 |")
    write("| LibreTranslate | 有服务端 API 适配代码和 README 部署命令；[上游 LICENSE](https://github.com/LibreTranslate/LibreTranslate/blob/main/LICENSE) 当前为 AGPL-3.0。是否部署和是否分发该镜像需按交付物核实。 |")
    write("| shadcn-vue | 旧目录称其为前端核心组件库；当前 `LexiFlow/package.json` 声明 React、Next、`@base-ui/react` 和 `shadcn`，未声明 Vue 或 shadcn-vue，应视为旧资料错误或仅供参考。 |")
    write("| Shadcn Fintech、Shadboard、Shadcn Dashboard MCP、Reicon | 旧目录列为设计或工具参考；在当前依赖清单和源码中未见对应包或集成代码，不应直接写作已采用的开源组件。 |")
    write()
    write("### 对话中出现的 GitHub 项目候选")
    write()
    write("以下仅证明这些项目的 GitHub URL 出现在对话或工具返回中。工具搜索结果可能与最终实现无关，需逐项核对代码和许可证。")
    write()
    write("| GitHub 项目 | 出现次数 | 首次日志出处 |")
    write("| --- | ---: | --- |")
    for ref, cites in sorted(github_mentions.items(), key=lambda pair: (-len(pair[1]), pair[0].lower())):
        tid, line_number = cites[0]
        write(f"| [{ref}](https://github.com/{ref}) | {len(cites)} | `{tid}:L{line_number}` |")
    write()
    write("### 需要人工核对的许可信息")
    write()
    write("- `LexiFlow/LICENSE` 当前为 MIT 文本，但版权行写的是 `Copyright (c) 2026 Abderrahim Ghazali`；技术报告和开源发布前应核对该文件的来源及其是否适用于当前项目。")
    write("- 包管理清单不包含每个依赖的许可证或传递依赖。本文件不把 GitHub 搜索结果当成已采用组件。")
    write()
    write("## 逐条对话与工具记录")
    write()
    for i, session in enumerate(sessions, 1):
        write(f'<a id="session-{i}"></a>')
        write(f"### {i}. {sanitize(session['title'])}")
        write()
        write(f"- 任务 ID：`{session['id']}`")
        write(f"- 原始日志：`{session['path']}`")
        write(f"- 原始日志 SHA-256：`{session['sha256']}`")
        write(f"- 原始日志大小：{session['path'].stat().st_size:,} bytes；收录记录：{len(session['events'])} 条")
        write()
        for line_number, timestamp, label, parts in session["events"]:
            summary = html.escape(f"{timestamp} · L{line_number} · {label}", quote=True)
            write(f"<details><summary>{summary}</summary>")
            write()
            for part_kind, content in parts:
                write(f"**{html.escape(part_kind)}**")
                write()
                out.write(pre(content))
            write("</details>")
            write()
    write("## 处理统计")
    write()
    write(f"- 转录任务：{len(sessions)}；转录记录：{sum(len(s['events']) for s in sessions):,}。")
    write(f"- 前端直接依赖：{len(node.get('dependencies', {}))}；开发依赖：{len(node.get('devDependencies', {}))}；Python 声明依赖行：{len(python_rows)}；Maven 声明依赖：{len(maven_rows)}。")
    write(f"- 对话中不同 GitHub 项目 URL：{len(github_mentions)}。")
    write(f"- 保留的内嵌附件计数：`{dict(attachments)}`。")
    write(f"- 密钥脱敏计数：`{dict(redactions)}`。")

print(str(OUTPUT))
print("bytes", OUTPUT.stat().st_size)
print("sessions", len(sessions), "records", sum(len(s["events"]) for s in sessions))
print("github_candidates", len(github_mentions), "attachments", dict(attachments), "redactions", dict(redactions))
