# Path: src/data_fetcher/bilara/logic/content_manager.py
import logging
import shutil
import os
from pathlib import Path
from typing import Tuple, Dict, List
from concurrent.futures import ThreadPoolExecutor, as_completed

from ...fetcher_config import FetcherConfig, BilaraConfig

logger = logging.getLogger("DataFetcher.Bilara.Content")

class ContentManager:
    def clean_destination(self) -> None:
        if BilaraConfig.DATA_ROOT.exists():
            logger.info("🧹 Cleaning old data...")
            shutil.rmtree(BilaraConfig.DATA_ROOT)
        BilaraConfig.DATA_ROOT.mkdir(parents=True, exist_ok=True)

    def _get_book_structure_map(self) -> Dict[str, str]:
        root_src = FetcherConfig.CACHE_DIR / "sc_bilara_data/root/pli/ms"
        structure_map = {}
        
        if not root_src.exists():
            logger.warning(f"⚠️ Cannot find root text in cache at {root_src}")
            return structure_map

        def scan_dir(path: Path, relative_base: str):
            if not path.exists(): return
            for item in path.iterdir():
                if item.is_dir():
                     structure_map[item.name] = f"{relative_base}/{item.name}"

        sutta_dir = root_src / "sutta"
        if sutta_dir.exists():
            for item in sutta_dir.iterdir():
                if item.is_dir():
                    if item.name == "kn":
                        scan_dir(item, "sutta/kn")
                    else:
                        structure_map[item.name] = f"sutta/{item.name}"
        
        scan_dir(root_src / "vinaya", "vinaya")
        scan_dir(root_src / "abhidhamma", "abhidhamma")
        return structure_map

    def _smart_copy_tree(self, src_path: Path, dest_path: Path) -> str:
        structure_map = self._get_book_structure_map()
        logger.info(f"   ℹ️  Smart Tree Copy: Mapped {len(structure_map)} books structure.")

        copied_count = 0
        for root, _, files in os.walk(src_path):
            for file in files:
                if file == "super-tree.json":
                    shutil.copy2(Path(root) / file, dest_path / file)
                    copied_count += 1
                    continue
                
                if file.endswith("-tree.json"):
                    book_id = file.replace("-tree.json", "")
                    if book_id in structure_map:
                        target_subdir = structure_map[book_id]
                        final_dest_dir = dest_path / target_subdir
                        final_dest_dir.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(Path(root) / file, final_dest_dir / file)
                        copied_count += 1

        return f"   -> Copied: tree ({copied_count} files organized by structure)"

    def _copy_worker(self, task: Tuple[str, str]) -> str:
        src_rel, dest_rel = task
        src_path = FetcherConfig.CACHE_DIR / src_rel
        dest_path = BilaraConfig.DATA_ROOT / dest_rel
        
        if not src_path.exists():
            return f"⚠️ Source not found (skipped): {src_rel}"

        if dest_rel == "tree":
            if dest_path.exists():
                shutil.rmtree(dest_path)
            dest_path.mkdir(parents=True, exist_ok=True)
            return self._smart_copy_tree(src_path, dest_path)

        ignore_list = []
        for key, patterns in BilaraConfig.IGNORE_PATTERNS.items():
            if dest_rel.startswith(key):
                ignore_list.extend(patterns)
        
        ignore_func = shutil.ignore_patterns(*ignore_list) if ignore_list else None
        
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        if src_path.is_file():
            shutil.copy2(src_path, dest_path)
        else:
            shutil.copytree(src_path, dest_path, ignore=ignore_func, dirs_exist_ok=True)
        
        return f"   -> Copied: {dest_rel}"

    def copy_data(self) -> None:
        logger.info("📂 Copying and filtering data (Multi-threaded)...")
        workers = min(os.cpu_count() or 4, len(BilaraConfig.FETCH_MAPPING))
        
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(self._copy_worker, item): item 
                for item in BilaraConfig.FETCH_MAPPING.items()
            }
            
            for future in as_completed(futures):
                try:
                    result = future.result()
                    logger.info(result)
                except Exception as e:
                    logger.error(f"❌ Error copying: {e}")

        logger.info(f"✅ Data copied to {BilaraConfig.DATA_ROOT}")