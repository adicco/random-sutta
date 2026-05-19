# Path: src/epub_builder/cli.py
import argparse
from pathlib import Path
import sys

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate EPUB from Sutta SQLite databases.")
    parser.add_argument(
        "--db-dir",
        type=Path,
        default=Path("web/public/assets/db"),
        help="Directory containing the sqlite databases (sutta_core.db, etc.)"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("dist/epub/random_sutta.epub"),
        help="Output path for the generated EPUB file"
    )
    parser.add_argument(
        "--eng-only",
        action="store_true",
        help="Generate an English-only version of the EPUB (no Pali)"
    )
    parser.add_argument(
        "--random-only",
        action="store_true",
        help="Only include books that are part of the default random selection (DN, MN, SN, AN, and select KN books)"
    )
    return parser.parse_args()
