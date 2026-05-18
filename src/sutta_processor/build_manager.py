# Path: src/sutta_processor/build_manager.py
import logging
import os
import shutil
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Dict, List, Any, Tuple, Optional

from .shared.app_config import (
    STAGE_PROCESSED_DIR, 
    LEGACY_DIST_BOOKS_DIR, 
    PROJECT_ROOT,
    DIST_DB_DIR,
    RAW_PARALLELS_FILE
)
from .ingestion.metadata_parser import load_names_map
from .ingestion.file_crawler import generate_book_tasks
from .ingestion.fix_loader import load_fix_map
from .ingestion.parallels_parser import parse_parallels

# Logic Imports
from .logic.content_merger import process_worker, init_worker
from .logic.structure import build_book_data
# [UPDATED] Import precalculate_super_navigation
from .logic.super_generator import generate_super_book_data, precalculate_super_navigation
from .logic.universe_builder import UniverseBuilder

# Output Imports
from .output.asset_generator import write_book_file
from .output.db_finalizer import generate_db_manifest
from .output.report_writer import ReportWriter
from .output.sqlite_generator import SqliteGenerator
from .optimizer import run_optimizer

logger = logging.getLogger("SuttaProcessor.BuildManager")

class BuildManager:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.names_map = load_names_map()
        self.fix_map = load_fix_map()
        self.reporter = ReportWriter(PROJECT_ROOT / "tmp")
        self.sqlite_gen = None
        
        self.buffers: Dict[str, Dict[str, Any]] = {}
        self.book_totals: Dict[str, int] = {}
        self.book_progress: Dict[str, int] = {}
        self.processed_book_ids: List[str] = [] 
        self.sutta_group_map: Dict[str, str] = {}
        
        # [NEW] Group structure accumulator for constants.js
        self.group_structure: Dict[str, List[str]] = {}
        
        # Accumulators
        self.all_generated_items: List[Tuple[str, str, str, str]] = []
        
        # [NEW] Super Navigation Map
        self.super_nav_map: Dict[str, Dict[str, str]] = {}

    def _prepare_environment(self) -> None:
        if STAGE_PROCESSED_DIR.exists():
            shutil.rmtree(STAGE_PROCESSED_DIR)
        STAGE_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        
        # [UPDATED] Pass directory instead of single file path
        self.sqlite_gen = SqliteGenerator(STAGE_PROCESSED_DIR)
        
        # [NEW] Insert configs into core_db
        from .shared.app_config import CONFIG_AUTHOR_PRIORITY
        self.sqlite_gen.insert_config("author_priority", CONFIG_AUTHOR_PRIORITY)
        
        if not self.dry_run and LEGACY_DIST_BOOKS_DIR.exists():
             shutil.rmtree(LEGACY_DIST_BOOKS_DIR)
             
        mode = "🧪 DRY-RUN" if self.dry_run else "🚀 PRODUCTION"
        logger.info(f"{mode} MODE INITIALIZED")

    def _handle_task_completion(self, group: str, sutta_id: str, content: Any) -> None:
        if content:
            self.buffers[group][sutta_id] = content
        
        self.book_progress[group] += 1
        
        if self.book_progress[group] >= self.book_totals[group]:
            self._finalize_book(group)
            if group in self.buffers:
                del self.buffers[group]

    def _finalize_book(self, group: str) -> None:
        raw_data = self.buffers.get(group, {})
        
        # [UPDATED] Truyền super_nav_map vào builder
        book_obj = build_book_data(
            group, 
            raw_data, 
            self.names_map, 
            self.all_generated_items,
            external_root_nav=self.super_nav_map # Pass map
        )
        
        if book_obj and "id" in book_obj:
            bid = book_obj["id"]
            self.processed_book_ids.append(bid)
            # Register structure: "an" -> ["an1", "an2"...]
            root_id = group.split("/")[-1]
            if bid != root_id:
                if root_id not in self.group_structure: self.group_structure[root_id] = []
                self.group_structure[root_id].append(bid)

        # [REMOVED] write_book_file (Legacy JSON)
        # write_book_file(group, book_obj, dry_run=True) 
        if self.sqlite_gen:
            self.sqlite_gen.insert_book(book_obj)

    def run(self) -> None:
        self._prepare_environment()
        
        # 1. Generate Tasks
        book_tasks = generate_book_tasks(self.names_map)
        all_tasks = []
        
        # Identify Active Books for Pre-calculation
        active_book_ids = []

        for group, tasks in book_tasks.items():
            self.book_totals[group] = len(tasks)
            self.book_progress[group] = 0
            self.buffers[group] = {}
            
            # Extract ID: "sutta/dn" -> "dn"
            book_id = group.split("/")[-1]
            active_book_ids.append(book_id)

            for task in tasks:
                all_tasks.append(task)
                self.sutta_group_map[task[0]] = group

        # [NEW] 1.5 Pre-calculate Super Navigation
        # Bước này mô phỏng Super Book Structure để lấy Nav Map cho các root book
        self.super_nav_map = precalculate_super_navigation(active_book_ids)

        # 2. Build Validation Universe
        valid_uids_universe = UniverseBuilder.build(self.names_map, book_tasks)

        # 3. Execute Workers
        workers = os.cpu_count() or 4
        logger.info(f"🚀 Processing {len(all_tasks)} items with {workers} workers...")
        
        all_missing_links = []

        with ProcessPoolExecutor(
            max_workers=workers, 
            initializer=init_worker, 
            initargs=(valid_uids_universe, self.fix_map)
        ) as executor:
            futures = [executor.submit(process_worker, task) for task in all_tasks]
            
            for i, future in enumerate(as_completed(futures)):
                try:
                    res_status, res_sid, content, missing_refs = future.result()
                    
                    if missing_refs:
                        all_missing_links.extend(missing_refs)

                    target_group = self.sutta_group_map.get(res_sid)
                    
                    if target_group:
                        success_content = content if res_status == "success" else None
                    
                    self._handle_task_completion(target_group, res_sid, success_content)
                except Exception as e:
                    logger.error(f"❌ Worker exception: {e}")

                if (i + 1) % 1000 == 0:
                    logger.info(f"   Processed {i + 1}/{len(all_tasks)} items...")

        # 4. Generate Reports
        missing_msg = self.reporter.write_missing_report(all_missing_links)
        generated_msg = self.reporter.write_generated_report(self.all_generated_items)
        # 5. Post-Processing
        if self.processed_book_ids:
            super_book_data = generate_super_book_data(self.processed_book_ids)
            if super_book_data:
                # [REMOVED] write_book_file (Legacy JSON)
                if self.sqlite_gen:
                    self.sqlite_gen.insert_super_book(super_book_data)

        # [NEW] Finalize SQLite DB
        if self.sqlite_gen:
            # Generate constants.js (needed by frontend)
            from .optimizer.pool_manager import PoolManager
            pm = PoolManager()
            pm.set_sutta_universe(self.processed_book_ids)
            pm.group_structure = self.group_structure
            # Mock pools for secondary book detection (needed by pm.generate_js_constants)
            pm.register_pools({bid: [None] for bid in self.processed_book_ids})
            pm.generate_js_constants()
            
            # Also insert into SQLite Config
            from .optimizer.config import PRIMARY_BOOKS_LIST
            self.sqlite_gen.insert_config("primary_books", PRIMARY_BOOKS_LIST)
            self.sqlite_gen.insert_config("sub_books_map", self.group_structure)

            # Insert Parallels
            parallels_file = PROJECT_ROOT / "data" / "json" / "sc-data" / "parallels.json"
            if parallels_file.exists():
                parallels_data = parse_parallels(parallels_file)
                self.sqlite_gen.insert_parallels(parallels_data)

            self.sqlite_gen.finalize()

        # [REMOVED] Legacy Optimizer
        # logger.info("⚡ Transforming processed data to Optimized DB...")
        # run_optimizer(dry_run=self.dry_run)
        
        if not self.dry_run:
            # [UPDATED] Copy ALL SQLite DBs to public assets
            DIST_DB_DIR.mkdir(parents=True, exist_ok=True)
            db_files = list(STAGE_PROCESSED_DIR.glob("*.db"))
            for db_file in db_files:
                shutil.copy2(db_file, DIST_DB_DIR / db_file.name)
                logger.info(f"🚀 Copied {db_file.name} to {DIST_DB_DIR}")
            
            # [NEW] Generate manifest based on the copied files
            generate_db_manifest()
        
        logger.info("✅ All processing tasks completed.")
        
        if generated_msg:
            logger.info(generated_msg)
        if missing_msg:
            logger.warning(missing_msg)
        
        if generated_msg:
            logger.info(generated_msg)
        if missing_msg:
            logger.warning(missing_msg)