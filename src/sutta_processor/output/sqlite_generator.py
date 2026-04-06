# Path: src/sutta_processor/output/sqlite_generator.py
import sqlite3
import json
import logging
from pathlib import Path
from typing import Dict, Any

from ..shared.app_config import STAGE_PROCESSED_DIR

logger = logging.getLogger("SuttaProcessor.Output.Sqlite")

class SqliteGenerator:
    """
    Generates a single SQLite database containing all metadata, content, and structure
    for Phase 1 of the SQLite migration.
    """
    def __init__(self, db_path: Path):
        self.db_path = Path(str(db_path.absolute()))
        self._init_db()

    def _get_connection(self):
        # Always use absolute path as string for sqlite3
        conn = sqlite3.connect(str(self.db_path))
        # Wait up to 30 seconds for locks to be released
        conn.execute("PRAGMA busy_timeout = 30000")
        # Use WAL mode for better concurrency during writing
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def _init_db(self):
        if not self.db_path.parent.exists():
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            
        conn = sqlite3.connect(str(self.db_path.absolute()))
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS metadata (
                uid TEXT PRIMARY KEY,
                json_data TEXT NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS content (
                uid TEXT PRIMARY KEY,
                json_data TEXT NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS structure (
                book_id TEXT PRIMARY KEY,
                json_data TEXT NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                json_data TEXT NOT NULL
            )
        """)
        
        conn.commit()
        conn.close()
        logger.info(f"SQLite Database initialized at {self.db_path}")

    def insert_book(self, book_obj: Dict[str, Any]):
        book_id = book_obj.get("id")
        if not book_id:
            logger.warning("No book_id found, skipping SQLite insertion.")
            return

        structure = book_obj.get("structure", [])
        meta_dict = book_obj.get("meta", {})
        content_dict = book_obj.get("content", {})
        random_pool = book_obj.get("random_pool", [])
        
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                # 1. Structure
                cursor.execute(
                    "INSERT OR REPLACE INTO structure (book_id, json_data) VALUES (?, ?)",
                    (book_id, json.dumps(structure, ensure_ascii=False))
                )
                
                # 2. Config (Random Pool)
                if random_pool:
                    cursor.execute(
                        "INSERT OR REPLACE INTO config (key, json_data) VALUES (?, ?)",
                        (f"{book_id}_random_pool", json.dumps(random_pool, ensure_ascii=False))
                    )
                
                # 3. Metadata
                for uid, meta_val in meta_dict.items():
                    cursor.execute(
                        "INSERT OR REPLACE INTO metadata (uid, json_data) VALUES (?, ?)",
                        (uid, json.dumps(meta_val, ensure_ascii=False))
                    )
                    
                # 4. Content
                for uid, content_val in content_dict.items():
                    cursor.execute(
                        "INSERT OR REPLACE INTO content (uid, json_data) VALUES (?, ?)",
                        (uid, json.dumps(content_val, ensure_ascii=False))
                    )
                    
                conn.commit()
                logger.info(f"   [SQLite] Inserted {book_id} with {len(meta_dict)} meta, {len(content_dict)} content.")
        except Exception as e:
            logger.error(f"❌ [SQLite] Failed to insert book {book_id}: {e}")
            
    def insert_super_book(self, super_book_data: Dict[str, Any]):
        book_id = super_book_data.get("id", "super")
        structure = super_book_data.get("structure", [])
        meta_dict = super_book_data.get("meta", {})
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute(
                "INSERT OR REPLACE INTO structure (book_id, json_data) VALUES (?, ?)",
                (book_id, json.dumps(structure, ensure_ascii=False))
            )
            
            for uid, meta_val in meta_dict.items():
                cursor.execute(
                    "INSERT OR REPLACE INTO metadata (uid, json_data) VALUES (?, ?)",
                    (uid, json.dumps(meta_val, ensure_ascii=False))
                )
                
            conn.commit()
