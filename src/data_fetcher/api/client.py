# Path: src/data_fetcher/api/client.py
import json
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Tuple
import os

from src.logging_config import setup_logging
from ..fetcher_config import FetcherConfig, ApiConfig, BilaraConfig

logger = setup_logging("DataFetcher.API")

class MetadataClient:
    def __init__(self):
        self.priority_map = {item: i for i, item in enumerate(ApiConfig.PRIORITY_ORDER)}

    def discover_books(self) -> List[Tuple[str, str]]:
        """
        Quét thư mục structure/tree để tự động tìm các Book ID cần fetch metadata.
        """
        tree_root = FetcherConfig.STRUCTURE_TREE_DIR
        
        if not tree_root.exists():
            logger.error(f"❌ Structure tree data not found at {tree_root}.")
            logger.error("   👉 Please run 'python -m src.data_fetcher -s' first.")
            return []

        discovered: List[Tuple[str, str]] = []
        logger.info(f"   🔍 Scanning Book IDs in {tree_root}...")

        # 1. Directory-based Discovery
        # Quét các thư mục con: sutta, vinaya, abhidhamma
        for category in ["sutta", "vinaya", "abhidhamma"]:
            cat_path = tree_root / category
            if not cat_path.exists():
                continue

            count = 0
            for tree_file in cat_path.glob("*-tree.json"):
                # Extract ID from filename (e.g., an-tree.json -> an)
                book_id = tree_file.name.replace("-tree.json", "")
                
                if book_id in ApiConfig.SYSTEM_IGNORE:
                    continue
                
                discovered.append((book_id, category))
                count += 1
            
            logger.info(f"   -> Scanned {category}: found {count} items.")

        # 2. Add Super Targets
        for uid in ApiConfig.SUPER_TARGET_CATS:
            discovered.append((uid, "super"))

        # 3. Deduplicate & Sort
        seen = set()
        final_list = []
        
        priority_candidates = []
        normal_candidates = []

        for info in discovered:
            book_id, cat = info
            unique_key = (book_id, cat)
            
            if unique_key in seen:
                continue
            seen.add(unique_key)

            if info in self.priority_map:
                priority_candidates.append(info)
            else:
                normal_candidates.append(info)

        priority_candidates.sort(key=lambda x: self.priority_map[x])
        normal_candidates.sort(key=lambda x: x[0])

        final_list = priority_candidates + normal_candidates
        
        logger.info(f"   ✅ Discovered {len(final_list)} targets to fetch.")
        return final_list

    def fetch_book_json(self, book_info: Tuple[str, str]) -> str:
        book_id, category_path = book_info
        url = ApiConfig.API_TEMPLATE.format(book_id)
        
        category_dir = ApiConfig.DATA_JSON_DIR / category_path
        category_dir.mkdir(parents=True, exist_ok=True)
        dest_file = category_dir / f"{book_id}.json"
        
        try:
            timeout = ApiConfig.TIMEOUT_DEFAULT
            if category_path == "super": timeout = ApiConfig.TIMEOUT_SUPER
            elif book_id in ApiConfig.LARGE_BOOKS: timeout = ApiConfig.TIMEOUT_LARGE
            
            with urllib.request.urlopen(url, timeout=timeout) as response:
                if response.status != 200:
                    return f"❌ {book_id}: HTTP {response.status}"
                
                data = json.loads(response.read().decode('utf-8'))
                with open(dest_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                    
            return f"✅ {category_path}/{book_id}"
            
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return f"⚠️ {category_path}/{book_id}: Not found (404)"
            return f"❌ {category_path}/{book_id}: HTTP {e.code}"
        except Exception as e:
            return f"❌ {category_path}/{book_id}: Error {e}"

    def run(self) -> None:
        logger.info("🚀 Starting Metadata (API) Fetch...")
        
        target_books = self.discover_books()
        if not target_books:
            return

        if not ApiConfig.DATA_JSON_DIR.exists():
            ApiConfig.DATA_JSON_DIR.mkdir(parents=True)

        workers = ApiConfig.get_worker_count()
        logger.info(f"   Using {workers} threads...")

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(self.fetch_book_json, info): info[0] 
                for info in target_books
            }
            
            for future in as_completed(futures):
                logger.info(future.result())

        logger.info("✨ Metadata API Fetch completed.")

def run_api_fetch() -> None:
    client = MetadataClient()
    client.run()
