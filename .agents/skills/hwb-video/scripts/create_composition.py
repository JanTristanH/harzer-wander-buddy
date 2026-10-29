#!/usr/bin/env python3
"""Create the approved HWB portrait composition from explicitly supplied media."""
import argparse
import json
from pathlib import Path
import shutil
import uuid

REQUIRED_ASSETS = (
    'list.png', 'search.png', 'before-stamp.png', 'stamp-animation.png',
    'stamp-success.png', 'map-focused.png', 'map.png', 'buddy.png',
    'music.mp3', 'click.ogg', 'gsap.min.js',
)


GROUP_ASSETS = (
    'group-choose.png', 'group-chosen.png', 'chosen-goal-map.png',
    'stamp-moment.png', 'group-confirm.png', 'together-saved.png',
    'buddy.png', 'music.mp3', 'click.ogg', 'gsap.min.js',
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--variant', choices=('classic', 'groups'), default='classic',
                        help='Approved classic reel or 20-second character/group story')
    parser.add_argument('--assets-dir', type=Path, required=True,
                        help='Fresh approved screenshots and local media; never a browser profile')
    parser.add_argument('--output', type=Path, required=True,
                        help='New composition directory; existing output is never overwritten')
    args = parser.parse_args()
    assets = args.assets_dir.resolve()
    output = args.output.resolve()
    required_assets = GROUP_ASSETS if args.variant == 'groups' else REQUIRED_ASSETS
    missing = [name for name in required_assets if not (assets / name).is_file()]
    if missing:
        parser.error('Missing required media: ' + ', '.join(missing))
    if output.exists():
        parser.error(f'Output already exists: {output}. Choose a new run directory.')
    templates = Path(__file__).resolve().parent.parent / ('templates-groups' if args.variant == 'groups' else 'templates')
    shutil.copytree(templates, output)
    (output / 'assets').mkdir(exist_ok=True)
    # Copy only this explicit allowlist, never a runtime/session directory tree.
    for name in required_assets:
        shutil.copyfile(assets / name, output / 'assets' / name)
    (output / 'meta.json').write_text(json.dumps({
        'id': str(uuid.uuid4()), 'name': 'Harzer Wander Buddy · ' + ('Du, Lena und Tom' if args.variant == 'groups' else 'Hochkant'),
    }, indent=2) + '\n', encoding='utf-8')
    print(output)


if __name__ == '__main__':
    main()
