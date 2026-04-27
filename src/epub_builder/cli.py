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
        default=Path("dist/random_sutta.epub"),
        help="Output path for the generated EPUB file"
    )
    return parser.parse_args()
