# Path: src/sutta_processor/output/sqlite_generator.py
import sqlite3
import json
import logging
from pathlib import Path
from typing import Dict, Any, List
from collections import defaultdict

from ..shared.app_config import STAGE_PROCESSED_DIR

logger = logging.getLogger("SuttaProcessor.Output.Sqlite")

class SqliteGenerator:
    """
    Generates a normalized SQLite database containing metadata, content segments, and structure.
    """
    def __init__(self, db_path: Path):
        self.db_path = Path(str(db_path.absolute()))
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(str(self.db_path))
        conn.execute("PRAGMA busy_timeout = 30000")
        return conn

    def finalize(self):
        """Perform final optimizations on the database."""
        try:
            with self._get_connection() as conn:
                conn.execute("PRAGMA journal_mode=DELETE")
                conn.execute("VACUUM")
                conn.execute("ANALYZE")
                conn.commit()
                logger.info(f"   [SQLite] Database finalized and optimized: {self.db_path}")
        except Exception as e:
            logger.error(f"❌ [SQLite] Finalization failed: {e}")

    def _init_db(self):
        if not self.db_path.parent.exists():
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            
        conn = sqlite3.connect(str(self.db_path.absolute()))
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS metadata (
                uid TEXT PRIMARY KEY,
                book_id TEXT,
                type TEXT,
                acronym TEXT,
                translated_title TEXT,
                original_title TEXT,
                blurb TEXT,
                author_uid TEXT,
                parent_uid TEXT,
                target_uid TEXT,
                children TEXT,
                hash_id TEXT,
                extract_id TEXT,
                nav_prev TEXT,
                nav_next TEXT
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS content_segments (
                sutta_uid TEXT,
                segment_id TEXT,
                segment_order INTEGER,
                pli TEXT,
                eng TEXT,
                html TEXT,
                comm TEXT,
                PRIMARY KEY (sutta_uid, segment_id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS structure (
                book_id TEXT PRIMARY KEY,
                tree_json TEXT NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS random_pools (
                book_id TEXT,
                sutta_uid TEXT,
                PRIMARY KEY (book_id, sutta_uid)
            )
        """)
        
        # Indexes for fast lookup
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_metadata_book_id ON metadata(book_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_content_segments_order ON content_segments(sutta_uid, segment_order)")
        
        conn.commit()
        conn.close()
        logger.info(f"Normalized SQLite Database initialized at {self.db_path}")

    def _extract_all_children_from_tree(self, node: Any, result: Dict[str, List[str]]):
        """Duyệt cây cấu trúc để lấy danh sách con (UID) của từng node."""
        if isinstance(node, dict):
            for uid, content in node.items():
                child_uids = []
                if isinstance(content, list):
                    for item in content:
                        if isinstance(item, str):
                            child_uids.append(item)
                        elif isinstance(item, dict):
                            keys = list(item.keys())
                            child_uids.extend(keys)
                            self._extract_all_children_from_tree(item, result)
                elif isinstance(content, dict):
                    keys = list(content.keys())
                    child_uids.extend(keys)
                    self._extract_all_children_from_tree(content, result)
                
                # Cập nhật kết quả: dùng set để tránh duplicate
                existing_set = set(result[uid])
                for cid in child_uids:
                    if cid not in existing_set:
                        result[uid].append(cid)
                        existing_set.add(cid)
        elif isinstance(node, list):
            for item in node:
                self._extract_all_children_from_tree(item, result)

    def insert_book(self, book_obj: Dict[str, Any]):
        book_id = book_obj.get("id")
        if not book_id:
            logger.warning("No book_id found, skipping SQLite insertion.")
            return

        structure = book_obj.get("structure", [])
        meta_dict = book_obj.get("meta", {})
        content_dict = book_obj.get("content", {})
        random_pool = book_obj.get("random_pool", [])
        
        # [NEW] Pre-extract children map
        children_map = defaultdict(list)
        self._extract_all_children_from_tree(structure, children_map)
        
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                # 1. Structure
                cursor.execute(
                    "INSERT OR REPLACE INTO structure (book_id, tree_json) VALUES (?, ?)",
                    (book_id, json.dumps(structure, ensure_ascii=False))
                )
                
                # 2. Random Pool
                if random_pool:
                    for uid in random_pool:
                        cursor.execute(
                            "INSERT OR REPLACE INTO random_pools (book_id, sutta_uid) VALUES (?, ?)",
                            (book_id, uid)
                        )
                
                # 3. Metadata
                for uid, m in meta_dict.items():
                    nav = m.get("nav", {})
                    children_json = json.dumps(children_map.get(uid, []), ensure_ascii=False)
                    cursor.execute("""
                        INSERT OR REPLACE INTO metadata (
                            uid, book_id, type, acronym, translated_title, original_title,
                            blurb, author_uid, parent_uid, target_uid, children,
                            hash_id, extract_id, nav_prev, nav_next
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        uid, book_id, m.get("type"), m.get("acronym"), m.get("translated_title"),
                        m.get("original_title"), m.get("blurb"), m.get("author_uid") or m.get("best_author_uid"),
                        m.get("parent_uid"), m.get("target_uid"), children_json,
                        m.get("hash_id"), m.get("extract_id"), nav.get("prev"), nav.get("next")
                    ))
                    
                # 4. Content
                for uid, segments in content_dict.items():
                    order = 0
                    for seg_id, seg in segments.items():
                        cursor.execute("""
                            INSERT OR REPLACE INTO content_segments (
                                sutta_uid, segment_id, segment_order, pli, eng, html, comm
                            ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, (
                            uid, seg_id, order,
                            seg.get("pli"), seg.get("eng"), seg.get("html"), seg.get("comm")
                        ))
                        order += 1
                        
                conn.commit()
                logger.info(f"   [SQLite] Inserted {book_id} with {len(meta_dict)} meta, {len(content_dict)} content segments.")
        except Exception as e:
            logger.error(f"❌ [SQLite] Failed to insert book {book_id}: {e}")
            
    def insert_super_book(self, super_book_data: Dict[str, Any]):
        book_id = super_book_data.get("id", "super")
        structure = super_book_data.get("structure", [])
        meta_dict = super_book_data.get("meta", {})
        
        # [NEW] Pre-extract children map
        children_map = defaultdict(list)
        self._extract_all_children_from_tree(structure, children_map)

        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute(
                    "INSERT OR REPLACE INTO structure (book_id, tree_json) VALUES (?, ?)",
                    (book_id, json.dumps(structure, ensure_ascii=False))
                )
                
                for uid, m in meta_dict.items():
                    nav = m.get("nav", {})
                    children_json = json.dumps(children_map.get(uid, []), ensure_ascii=False)
                    # Use UPSERT style to avoid changing book_id if it already exists
                    cursor.execute("""
                        INSERT INTO metadata (
                            uid, book_id, type, acronym, translated_title, original_title,
                            blurb, author_uid, parent_uid, target_uid, children,
                            hash_id, extract_id, nav_prev, nav_next
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(uid) DO UPDATE SET
                            type=excluded.type,
                            acronym=excluded.acronym,
                            translated_title=excluded.translated_title,
                            original_title=excluded.original_title,
                            blurb=excluded.blurb,
                            author_uid=excluded.author_uid,
                            parent_uid=excluded.parent_uid,
                            target_uid=excluded.target_uid,
                            children=excluded.children,
                            hash_id=excluded.hash_id,
                            extract_id=excluded.extract_id,
                            nav_prev=excluded.nav_prev,
                            nav_next=excluded.nav_next
                    """, (
                        uid, book_id, m.get("type"), m.get("acronym"), m.get("translated_title"),
                        m.get("original_title"), m.get("blurb"), m.get("author_uid") or m.get("best_author_uid"),
                        m.get("parent_uid"), m.get("target_uid"), children_json,
                        m.get("hash_id"), m.get("extract_id"), nav.get("prev"), nav.get("next")
                    ))
                    
                conn.commit()
        except Exception as e:
            logger.error(f"❌ [SQLite] Failed to insert super book: {e}")