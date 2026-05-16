# Path: src/sutta_processor/ingestion/legacy_converter/writer.py
import json
from pathlib import Path
from typing import Dict, Any

class BilaraWriter:
    @staticmethod
    def save_json(data: Dict[str, str], filepath: Path) -> None:
        if not data:
            return
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def write_output(self, uid: str, parsed_data: Dict[str, Any], output_dir: Path, rel_path: str) -> None:
        # parsed_data contains 'root', 'html', 'reference'
        
        # Paths format: data/bilara_more/{type}/lzh/sutta/ma/{uid}_{type}.json
        # The rel_path is something like "sutta/ma"
        
        # 1. Root
        root_path = output_dir / "root" / "lzh" / rel_path / f"{uid}_root-lzh-legacy.json"
        self.save_json(parsed_data.get("root", {}), root_path)
        
        # 2. HTML
        html_path = output_dir / "html" / "lzh" / rel_path / f"{uid}_html.json"
        self.save_json(parsed_data.get("html", {}), html_path)
        
        # 3. Reference
        ref_path = output_dir / "reference" / "lzh" / rel_path / f"{uid}_reference.json"
        self.save_json(parsed_data.get("reference", {}), ref_path)
