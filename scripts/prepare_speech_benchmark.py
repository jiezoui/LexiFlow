"""Download a pinned, speaker-disjoint SpeechOcean762 subset; no private data uploaded."""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import random
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.deploy-cache' / 'benchmarks' / 'speechocean762'
REVISION = '613968e3b0b789fc33936fb5eba1973176ba7d11'
BASE = f'https://raw.githubusercontent.com/jimbozhang/speechocean762/{REVISION}/'


def fetch(relative: str) -> Path:
    target = CACHE / relative
    if target.exists() and target.stat().st_size > 0:
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        try:
            response = requests.get(BASE + relative, timeout=(15, 90))
            response.raise_for_status()
            data = response.content
            if relative.endswith('.WAV') and not data.startswith(b'RIFF'):
                raise ValueError(f'Not WAV: {relative}')
            temporary = target.with_suffix(target.suffix + '.partial')
            temporary.write_bytes(data)
            temporary.replace(target)
            return target
        except (requests.RequestException, ValueError):
            if attempt == 2:
                raise
            time.sleep(1 + attempt)
    raise RuntimeError(relative)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--test-per-speaker', type=int, default=4)
    parser.add_argument('--dev-count', type=int, default=100)
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    metadata = ['resource/scores.json', 'train/wav.scp', 'test/wav.scp',
                'train/utt2spk', 'test/utt2spk', 'README.md']
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(fetch, metadata))
    labels = json.loads((CACHE / 'resource/scores.json').read_text(encoding='utf-8'))
    rng = random.Random(20261005)
    items = []
    split_speakers = {}
    for split in ('train', 'test'):
        speakers = dict(line.split() for line in (CACHE / split / 'utt2spk').read_text().splitlines())
        waves = dict(line.split(maxsplit=1) for line in (CACHE / split / 'wav.scp').read_text().splitlines())
        split_speakers[split] = set(speakers.values())
        if split == 'train':
            selected = sorted(rng.sample(sorted(waves), args.dev_count))
        else:
            selected = []
            for speaker in sorted(set(speakers.values())):
                candidates = sorted(uid for uid in waves if speakers[uid] == speaker)
                selected.extend(rng.sample(candidates, min(args.test_per_speaker, len(candidates))))
            selected.sort()
        for uid in selected:
            relative = waves[uid].replace('\\', '/')
            relative = 'WAVE/' + relative.split('WAVE/', 1)[1]
            items.append({'id': uid, 'split': 'dev' if split == 'train' else 'test',
                          'speaker': speakers[uid], 'audio': relative, 'annotation': labels[uid]})
    assert not (split_speakers['train'] & split_speakers['test'])
    print(f'Downloading {len(items)} recordings from pinned public corpus', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(fetch, item['audio']): item for item in items}
        for count, future in enumerate(concurrent.futures.as_completed(futures), 1):
            file = future.result()
            futures[future]['sha256'] = hashlib.sha256(file.read_bytes()).hexdigest()
            if count % 25 == 0 or count == len(items):
                print(f'downloaded {count}/{len(items)}', flush=True)
    manifest = {'dataset': 'SpeechOcean762', 'revision': REVISION, 'seed': 20261005,
                'source': 'https://github.com/jimbozhang/speechocean762',
                'license_source': 'https://openslr.org/101/', 'license': 'CC BY 4.0 (OpenSLR record)',
                'expert_label_source': 'resource/scores.json; corpus-provided aggregation of five raters',
                'sampling': 'test: four seeded random utterances per official test speaker; dev: train split random subset',
                'items': items}
    (CACHE / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'dev': sum(x['split']=='dev' for x in items),
                      'test': sum(x['split']=='test' for x in items),
                      'speaker_overlap': 0, 'manifest': str(CACHE / 'manifest.json')}), flush=True)


if __name__ == '__main__':
    main()
