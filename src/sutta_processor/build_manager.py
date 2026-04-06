# Path: src/sutta_processor/build_manager.py
import logging
import os
import shutil
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Dict, List, Any, Tuple, Optional

from .shared.app_config import (
    STAGE_PROCESSED_DIR, 
    LEGACY_DIST_BOOKS_DIR,
    PROJECT_ROOT 
)
from .ingestion.metadata_parser import load_names_map
from .ingestion.file_crawler import generate_book_tasks
from .ingestion.fix_loader import load_fix_map

# Logic Imports
from .logic.content_merger import process_worker, init_worker
from .logic.structure import build_book_data
# [UPDATED] Import precalculate_super_navigation
from .logic.super_generator import generate_super_book_data, precalculate_super_navigation
from .logic.universe_builder import UniverseBuilder

# Output Imports
from .output.asset_generator import write_book_file
from .output.zip_generator import create_db_bundle
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
        
        # Accumulators
        self.all_generated_items: List[Tuple[str, str, str, str]] = []
        
        # [NEW] Super Navigation Map
        self.super_nav_map: Dict[str, Dict[str, str]] = {}

    def _prepare_environment(self) -> None:
        if STAGE_PROCESSED_DIR.exists():
            shutil.rmtree(STAGE_PROCESSED_DIR)
        STAGE_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        
        self.sqlite_gen = SqliteGenerator(STAGE_PROCESSED_DIR / "sutta_data.db")
        
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
            self.processed_book_ids.append(book_obj["id"])

        write_book_file(group, book_obj, dry_run=True) 

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
                write_book_file("super", super_book_data, dry_run=True)
                self.sqlite_gen.insert_super_book(super_book_data)

        logger.info("⚡ Transforming processed data to Optimized DB...")
        run_optimizer(dry_run=self.dry_run)
        
        if not self.dry_run:
            create_db_bundle()
        
        logger.info("✅ All processing tasks completed.")
        
        if generated_msg:
            logger.info(generated_msg)
        if missing_msg:
            logger.warning(missing_msg)
        
        if generated_msg:
            logger.info(generated_msg)
        if missing_msg:
            logger.warning(missing_msg)