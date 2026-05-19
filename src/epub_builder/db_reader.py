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

    def _get_category(self, book_id: Optional[str]) -> str:
        if not book_id:
            return "minor"
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
        # [UPDATED] Query new vertical schema
        cursor.execute(
            "SELECT segment_id, type, content FROM content_segments WHERE sutta_uid = ? ORDER BY segment_order ASC", 
            (sutta_uid,)
        )
        rows = cursor.fetchall()
        
        # Aggregate vertical rows back into horizontal segments
        segments_map = {}
        order_list = [] # Maintain segment order
        
        for row in rows:
            seg_id = row["segment_id"]
            if seg_id not in segments_map:
                segments_map[seg_id] = {"segment_id": seg_id}
                order_list.append(seg_id)
            
            c_type = row["type"]
            content = row["content"]
            
            # Map back to legacy horizontal keys
            if c_type == "root": segments_map[seg_id]["pli"] = content
            elif c_type == "translation": segments_map[seg_id]["eng"] = content
            elif c_type == "html": segments_map[seg_id]["html"] = content
            elif c_type == "comment": segments_map[seg_id]["comm"] = content
            elif c_type == "variant": segments_map[seg_id]["variant"] = content
            elif c_type == "reference": segments_map[seg_id]["reference"] = content
            
        return [segments_map[sid] for sid in order_list]

    def has_segments(self, sutta_uid: str, book_id: str) -> bool:
        category = self._get_category(book_id)
        conn = self._get_content_conn(category)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT 1 FROM content_segments WHERE sutta_uid = ? LIMIT 1", 
            (sutta_uid,)
        )
        return cursor.fetchone() is not None
