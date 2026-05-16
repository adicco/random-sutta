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
    def clean_destination(self, dest_root: Path) -> None:
        if dest_root.exists():
            logger.info(f"🧹 Cleaning old data at {dest_root}...")
            shutil.rmtree(dest_root)
        dest_root.mkdir(parents=True, exist_ok=True)

    def _copy_worker(self, task: Tuple[str, str], dest_root: Path) -> str:
        src_rel, dest_rel = task
        src_path = FetcherConfig.CACHE_DIR / src_rel
        dest_path = dest_root / dest_rel

        if not src_path.exists():
            return f"⚠️ Source not found (skipped): {src_rel}"

        ignore_list = []
        # Chỉ áp dụng IGNORE_PATTERNS cho Bilara (có thể mở rộng sau)
        if "bilara" in str(dest_root):
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

    def copy_data(self, fetch_mapping: Dict[str, str], dest_root: Path) -> None:
        logger.info(f"📂 Copying and filtering data to {dest_root} (Multi-threaded)...")
        workers = min(os.cpu_count() or 4, len(fetch_mapping))

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(self._copy_worker, item, dest_root): item 
                for item in fetch_mapping.items()
            }

            for future in as_completed(futures):
                try:
                    result = future.result()
                    logger.info(result)
                except Exception as e:
                    logger.error(f"❌ Error copying: {e}")

        logger.info(f"✅ Data copied to {dest_root}")