"""Refresh the local channel and podcast discovery snapshots.

Install Pillow and lxml, then run: python scripts/build_subscription_catalog.py
Discovery screens read the generated JSON and WebP files without contacting third parties.
Channel images remain direct links; podcast cover art is saved locally.
"""

from __future__ import annotations

import concurrent.futures
import difflib
import html
import http.client
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

from PIL import Image, ImageFile, ImageOps
from lxml import etree as ET

ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "src" / "data"
IMAGE_DIR = ROOT / "public" / "subscription-catalog"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"

CHANNEL_SEEDS = {
    "英语学习": ["BBCLearningEnglish", "VOALearningEnglish", "EnglishwithLucy", "LearnEnglishWithTVSeries", "rachelsenglish", "OxfordOnlineEnglish"],
    "科技": ["mkbhd", "LinusTechTips", "TheVerge", "Fireship", "CNET", "UnboxTherapy"],
    "科学": ["hubermanlab", "Kurzgesagt", "veritasium", "Vsauce", "SciShow", "SmarterEveryDay"],
    "商业": ["YCombinator", "TheDiaryOfACEO", "CNBC", "BloombergTV", "a16z", "stanfordgsb"],
    "文化": ["TED", "vox", "theschooloflifetv", "CrashCourse", "DWDocumentary", "NatGeo"],
}

PODCAST_SEEDS = {
    "英语学习": ["6 Minute English", "All Ears English", "American English Podcast", "As It Is - VOA Learning English", "Coffee Break English", "EnglishClass101"],
    "商业": ["The Diary Of A CEO", "How I Built This", "Masters of Scale", "HBR IdeaCast", "Acquired", "Planet Money", "The Indicator from Planet Money"],
    "科技": ["Hard Fork", "Decoder with Nilay Patel", "The Vergecast", "This Week in Tech", "Tech Brew Ride Home", "Waveform: The MKBHD Podcast", "Darknet Diaries"],
    "科学": ["Science Vs", "Radiolab", "Star Talk Podcast", "Science Friday", "Short Wave", "Ologies", "The Quanta Podcast"],
    "心理": ["Hidden Brain", "The Psychology Podcast", "Speaking of Psychology", "Huberman Lab", "The Happiness Lab", "Where Should We Begin? with Esther Perel"],
    "新闻": ["The Daily", "Up First", "Today, Explained", "The Intelligence from The Economist", "Global News Podcast", "Reuters World News", "The Journal."],
    "文化": ["TED Talks Daily", "99% Invisible", "The Moth", "This American Life", "Freakonomics Radio", "The Ezra Klein Show"],
}


def fetch(url: str, *, limit: int = 3_000_000, allow_partial: bool = False) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/html, */*",
        },
    )
    for attempt in range(2):
        try:
            with urllib.request.urlopen(request, timeout=12) as response:
                return response.read(limit + 1)[:limit]
        except http.client.IncompleteRead as error:
            if allow_partial and error.partial:
                return error.partial
            if attempt:
                raise
            time.sleep(0.5)
        except Exception:
            if attempt:
                raise
            time.sleep(0.5)
    raise RuntimeError("unreachable")


class PageMetadata(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.meta: dict[str, str] = {}
        self.canonical = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "meta":
            key = values.get("property") or values.get("name")
            if key and values.get("content"):
                self.meta[key] = html.unescape(values["content"] or "")
        elif tag == "link" and values.get("rel") == "canonical":
            self.canonical = values.get("href") or ""


def text_of(node: ET.Element | None, path: str) -> str:
    if node is None:
        return ""
    child = node.find(path)
    return "".join(child.itertext()).strip() if child is not None else ""


def local_image(url: str, folder: str, slug: str) -> str:
    if not url or not url.startswith(("https://", "http://")):
        return ""
    try:
        data = fetch(url, limit=2_000_000)
        image = Image.open(io.BytesIO(data)).convert("RGB")
        image = ImageOps.fit(image, (144, 144), method=Image.Resampling.LANCZOS)
        target_dir = IMAGE_DIR / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / f"{slug}.webp"
        image.save(target, format="WEBP", quality=82, method=6)
        return f"/subscription-catalog/{folder}/{slug}.webp"
    except Exception as error:
        print(f"  image failed {slug}: {error}")
        return ""


def channel_entry(category: str, handle: str) -> dict[str, object] | None:
    try:
        page = PageMetadata()
        page.feed(fetch(f"https://www.youtube.com/@{handle}", allow_partial=True).decode("utf-8", "ignore"))
        match = re.search(r"UC[a-zA-Z0-9_-]{22}", page.canonical or page.meta.get("og:url", ""))
        if not match:
            print(f"  channel ID missing @{handle}")
            return None
        channel_id = match.group()
        feed_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
        atom = "{http://www.w3.org/2005/Atom}"
        title = page.meta.get("og:title", "").removesuffix(" - YouTube") or handle
        latest_title = ""
        latest_published = ""
        try:
            feed = ET.fromstring(fetch(feed_url), parser=ET.XMLParser(recover=True))
            title = text_of(feed, f"{atom}title") or title
            latest = feed.find(f"{atom}entry")
            latest_title = text_of(latest, f"{atom}title")
            latest_published = text_of(latest, f"{atom}published")
        except Exception as error:
            print(f"  feed unavailable @{handle}: {error}")
        image_url = page.meta.get("og:image", "")
        image_url = image_url.replace("\\u0026", "&")
        if not image_url.startswith(("https://", "http://")):
            print(f"  channel image missing @{handle}")
            return None
        return {
            "id": channel_id,
            "handle": f"@{handle}",
            "name": title,
            "category": category,
            "description": page.meta.get("og:description", "").strip()[:240],
            "image": image_url,
            "latestTitle": latest_title,
            "latestPublished": latest_published,
            "feedUrl": feed_url,
        }
    except Exception as error:
        print(f"  channel failed @{handle}: {error}")
        return None


def apple_results(term: str) -> list[dict[str, object]]:
    query = urllib.parse.urlencode({
        "term": term,
        "media": "podcast",
        "entity": "podcast",
        "country": "us",
        "limit": "8",
    })
    payload = json.loads(fetch(f"https://itunes.apple.com/search?{query}"))
    return [item for item in payload.get("results", []) if isinstance(item, dict) and item.get("feedUrl")]


def select_podcast(term: str) -> dict[str, object] | None:
    results = apple_results(term)
    if not results:
        return None
    def normalize(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", "", value.lower())
    target = normalize(term)
    matching = [
        item for item in results
        if target in normalize(str(item.get("collectionName") or ""))
    ]
    if not matching:
        return None
    return max(
        matching,
        key=lambda item: difflib.SequenceMatcher(
            None, target, normalize(str(item.get("collectionName") or ""))
        ).ratio(),
    )


def safe_select_podcast(job: tuple[str, str]) -> dict[str, object] | None:
    try:
        return select_podcast(job[1])
    except Exception as error:
        print(f"  directory failed {job[1]}: {error}", flush=True)
        return None


def podcast_entry(category: str, candidate: dict[str, object]) -> dict[str, object] | None:
    feed_url = str(candidate["feedUrl"])
    try:
        feed = ET.fromstring(fetch(feed_url), parser=ET.XMLParser(recover=True))
        channel = feed.find("channel")
        if channel is None:
            return None
        itunes = "{http://www.itunes.com/dtds/podcast-1.0.dtd}"
        name = text_of(channel, "title") or str(candidate.get("collectionName") or "")
        description = text_of(channel, f"{itunes}summary") or text_of(channel, "description")
        description = re.sub(r"<[^>]+>", " ", html.unescape(description))
        description = " ".join(description.split())[:260]
        image_node = channel.find(f"{itunes}image")
        image_url = image_node.get("href", "") if image_node is not None else ""
        if not image_url:
            image_url = str(candidate.get("artworkUrl600") or candidate.get("artworkUrl100") or "")
        identifier = str(candidate.get("collectionId") or abs(hash(feed_url)))
        image = local_image(image_url, "podcasts", identifier)
        if not image:
            fallback_artwork = str(candidate.get("artworkUrl600") or candidate.get("artworkUrl100") or "")
            if fallback_artwork and fallback_artwork != image_url:
                image = local_image(fallback_artwork, "podcasts", identifier)
        if not image:
            print(f"  podcast image missing {name}")
            return None
        latest = channel.find("item")
        return {
            "id": identifier,
            "title": name[:140],
            "author": text_of(channel, f"{itunes}author") or str(candidate.get("artistName") or ""),
            "category": category,
            "description": description,
            "feedUrl": feed_url,
            "image": image,
            "latestTitle": text_of(latest, "title")[:180],
            "latestPublished": text_of(latest, "pubDate"),
            "episodeCount": int(candidate.get("trackCount") or 0),
        }
    except Exception as error:
        print(f"  podcast failed {candidate.get('collectionName')}: {error}")
        return None


def save(name: str, items: list[dict[str, object]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "items": items,
    }
    (DATA_DIR / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if name == "podcast-discovery.json":
        cover_dir = IMAGE_DIR / "podcasts"
        expected = {Path(str(item["image"])).name for item in items}
        for cover in cover_dir.glob("*.webp"):
            if cover.name not in expected:
                cover.unlink()
    print(f"saved {name}: {len(items)} entries")


def main() -> None:
    if "--podcasts-only" not in sys.argv:
        channel_jobs = [(category, handle) for category, handles in CHANNEL_SEEDS.items() for handle in handles]
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            channels = list(pool.map(lambda job: channel_entry(*job), channel_jobs))
        valid_channels = [item for item in channels if item]
        save("channel-discovery.json", valid_channels)

    if "--channels-only" in sys.argv:
        return

    podcast_jobs: list[tuple[str, dict[str, object]]] = []
    seen_feeds: set[str] = set()
    seed_jobs = [(category, name) for category, names in PODCAST_SEEDS.items() for name in names]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        directory_results = list(pool.map(safe_select_podcast, seed_jobs))
    for (category, name), candidate in zip(seed_jobs, directory_results):
        if candidate is None:
            print(f"  directory match missing {name}")
            continue
        feed_url = str(candidate["feedUrl"])
        if feed_url in seen_feeds:
            continue
        seen_feeds.add(feed_url)
        podcast_jobs.append((category, candidate))
    print(f"directory matched {len(podcast_jobs)} podcasts", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        podcasts = list(pool.map(lambda job: podcast_entry(*job), podcast_jobs))
    valid_podcasts = [item for item in podcasts if item]
    save("podcast-discovery.json", valid_podcasts)


if __name__ == "__main__":
    main()
