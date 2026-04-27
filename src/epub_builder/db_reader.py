# Path: src/epub_builder/db_reader.py
import sqlite3
import json
from pathlib import Path
from typing import Dict, Any, List, Optional

class DbReader:
    def __init__(self, db_dir: Path):
        self.db_dir = db_dir
        self.core_db_path = self.db_dir / "sutta_core.db"
        self.core_conn = None
        self.content_conns: Dict[str, sqlite3.Connection] = {}
        
        if not self.core_db_path.exists():
            raise FileNotFoundError(f"Core DB not found at {self.core_db_path}")

    def __enter__(self):
        self.core_conn = sqlite3.connect(str(self.core_db_path))
        self.core_conn.row_factory = sqlite3.Row
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.core_conn:
            self.core_conn.close()
        for conn in self.content_conns.values():
            conn.close()

    def get_structure(self, book_id: str = "tpk") -> Any:
        cursor = self.core_conn.cursor()
        cursor.execute("SELECT tree_json FROM structure WHERE book_id = ?", (book_id,))
        row = cursor.fetchone()
        if row:
            return json.loads(row["tree_json"])
        return None

    def get_metadata(self, uid: str) -> Optional[Dict[str, Any]]:
        cursor = self.core_conn.cursor()
        cursor.execute("SELECT * FROM metadata WHERE uid = ?", (uid,))
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None

    def get_all_metadata(self) -> Dict[str, Dict[str, Any]]:
        cursor = self.core_conn.cursor()
        cursor.execute("SELECT * FROM metadata")
        rows = cursor.fetchall()
        return {row["uid"]: dict(row) for row in rows}

    def _get_category(self, book_id: str) -> str:
        if book_id in ['dn', 'mn', 'sn', 'an']: return "major"
        if book_id.startswith('pli-tv-'): return "vinaya"
        if book_id in ['ds', 'dt', 'kv', 'pp', 'vb', 'ya', 'patthana']: return "abhidhamma"
        return "minor"

    def _get_content_conn(self, category: str) -> sqlite3.Connection:
        if category not in self.content_conns:
            db_path = self.db_dir / f"sutta_content_{category}.db"
            if not db_path.exists():
                raise FileNotFoundError(f"Content DB not found: {db_path}")
            conn = sqlite3.connect(str(db_path))
            conn.row_factory = sqlite3.Row
            self.content_conns[category] = conn
        return self.content_conns[category]

    def get_segments(self, sutta_uid: str, book_id: str) -> List[Dict[str, Any]]:
        category = self._get_category(book_id)
        conn = self._get_content_conn(category)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM content_segments WHERE sutta_uid = ? ORDER BY segment_order ASC", 
            (sutta_uid,)
        )
        return [dict(row) for row in cursor.fetchall()]
