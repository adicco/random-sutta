# Path: src/sutta_processor/output/sqlite_generator.py
import sqlite3
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from collections import defaultdict

logger = logging.getLogger("SuttaProcessor.Output.Sqlite")

class SqliteGenerator:
    """
    Generates sharded SQLite databases:
    1. sutta_core.db: Metadata, Structure, Config, Random Pools.
    2. sutta_content_{category}.db: Segmented content (pli, eng, html).
    """
    def __init__(self, output_dir: Path):
        self.output_dir = Path(str(output_dir.absolute()))
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.core_db_path = self.output_dir / "sutta_core.db"
        self.content_conns: Dict[str, sqlite3.Connection] = {}
        
        self._init_core_db()

    def _get_core_connection(self):
        conn = sqlite3.connect(str(self.core_db_path))
        conn.execute("PRAGMA busy_timeout = 30000")
        return conn

    def _get_content_connection(self, category: str):
        if category not in self.content_conns:
            db_path = self.output_dir / f"sutta_content_{category}.db"
            conn = sqlite3.connect(str(db_path))
            conn.execute("PRAGMA busy_timeout = 30000")
            self._init_content_db(conn)
            self.content_conns[category] = conn
        return self.content_conns[category]

    def _init_core_db(self):
        with self._get_core_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA page_size = 4096")
            # Config Table
            cursor.execute("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)")
            # Metadata Table
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
                    nav_next TEXT,
                    child_range TEXT,
                    search_priority INTEGER DEFAULT 3
                )
            """)
            # Structure Table
            cursor.execute("CREATE TABLE IF NOT EXISTS structure (book_id TEXT PRIMARY KEY, tree_json TEXT NOT NULL)")
            # Random Pools
            cursor.execute("CREATE TABLE IF NOT EXISTS random_pools (book_id TEXT, sutta_uid TEXT, PRIMARY KEY (book_id, sutta_uid))")
            
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_metadata_book_id ON metadata(book_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_metadata_search_priority ON metadata(search_priority)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_random_pools_book_id ON random_pools(book_id)")
            
            # FTS5 for metadata
            cursor.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS metadata_fts USING fts5(
                    uid,
                    acronym,
                    original_title,
                    translated_title,
                    blurb,
                    content='metadata',
                    content_rowid='rowid',
                    tokenize='unicode61 remove_diacritics 2'
                )
            """)
            conn.commit()
        logger.info(f"✨ [SQLite] Core Database initialized at {self.core_db_path}")

    def _init_content_db(self, conn: sqlite3.Connection):
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS content_segments (
                sutta_uid TEXT,
                segment_id TEXT,
                segment_order INTEGER,
                type TEXT,
                lang TEXT,
                author_uid TEXT,
                content TEXT,
                PRIMARY KEY (sutta_uid, segment_id, type, lang, author_uid)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_content_segments_lookup ON content_segments(sutta_uid, segment_order)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_content_segments_meta ON content_segments(type, lang, author_uid)")
        conn.commit()

    def finalize(self):
        """Optimize all databases."""
        # Ensure FTS is fully populated and optimized
        try:
            with self._get_core_connection() as conn:
                logger.info("   ⚡ [SQLite] Rebuilding Metadata FTS index...")
                conn.execute("INSERT INTO metadata_fts(metadata_fts) VALUES('rebuild')")
                conn.commit()
        except Exception as e:
            logger.error(f"❌ [SQLite] FTS rebuild failed: {e}")

        db_paths = [self.core_db_path] + [self.output_dir / f"sutta_content_{cat}.db" for cat in self.content_conns.keys()]
        
        for conn in self.content_conns.values():
            conn.close()
        self.content_conns.clear()

        for path in db_paths:
            if not path.exists(): continue
            try:
                conn = sqlite3.connect(str(path))
                conn.execute("PRAGMA journal_mode=DELETE")
                conn.execute("VACUUM")
                conn.execute("ANALYZE")
                conn.close()
                logger.info(f"   ✅ [SQLite] Optimized: {path.name}")
            except Exception as e:
                logger.error(f"❌ [SQLite] Finalization failed for {path.name}: {e}")

    def _get_category(self, book_id: str) -> str:
        """Xác định shard dựa trên book_id."""
        if book_id in ['dn', 'mn', 'sn', 'an']: return "major"
        if book_id.startswith('pli-tv-'): return "vinaya"
        if book_id in ['ds', 'dt', 'kv', 'pp', 'vb', 'ya', 'patthana']: return "abhidhamma"
        return "minor" # Khuddaka and others

    def insert_book(self, book_obj: Dict[str, Any]):
        book_id = book_obj.get("id")
        if not book_id: return

        structure = book_obj.get("structure", [])
        meta_dict = book_obj.get("meta", {})
        content_dict = book_obj.get("content", {})
        random_pool = book_obj.get("random_pool", [])
        
        children_map = defaultdict(list)
        self._extract_all_children_from_tree(structure, children_map)
        
        parent_map = self._build_parent_map(structure)
        
        # 1. CORE DATA
        with self._get_core_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT OR REPLACE INTO structure (book_id, tree_json) VALUES (?, ?)",
                         (book_id, json.dumps(structure, ensure_ascii=False)))
            
            if random_pool:
                for uid in random_pool:
                    cursor.execute("INSERT OR REPLACE INTO random_pools (book_id, sutta_uid) VALUES (?, ?)", (book_id, uid))
            
            for uid, m in meta_dict.items():
                if uid in parent_map:
                    m["parent_uid"] = parent_map[uid]

                # Pre-calculate search priority
                # 0: Primary, 1: Vinaya, 2: Abhidhamma, 3: Others
                priority = 3
                if book_id in ['dn', 'mn', 'sn', 'an', 'kp', 'dhp', 'ud', 'iti', 'snp', 'thag', 'thig']:
                    priority = 0
                elif book_id.startswith('pli-tv-'):
                    priority = 1
                elif book_id in ['ds', 'dt', 'kv', 'pp', 'vb', 'ya', 'patthana']:
                    priority = 2

                nav = m.get("nav", {})
                children_json = json.dumps(children_map.get(uid, []), ensure_ascii=False)
                cursor.execute("""
                    INSERT OR REPLACE INTO metadata (
                        uid, book_id, type, acronym, translated_title, original_title,
                        blurb, author_uid, parent_uid, target_uid, children,
                        hash_id, extract_id, nav_prev, nav_next, child_range, search_priority
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    uid, book_id, m.get("type"), m.get("acronym"), m.get("translated_title"),
                    m.get("original_title"), m.get("blurb"), m.get("author_uid") or m.get("best_author_uid"),
                    m.get("parent_uid"), m.get("target_uid"), children_json,
                    m.get("hash_id"), m.get("extract_id"), nav.get("prev"), nav.get("next"),
                    m.get("child_range"), priority
                ))
            conn.commit()

        # 2. CONTENT DATA (Sharded & Vertical)
        category = self._get_category(book_id)
        conn_content = self._get_content_connection(category)
        cursor_content = conn_content.cursor()
        
        for uid, sutta_data in content_dict.items():
            segments = sutta_data.get("data", {})
            order = 0
            for seg_id, content_list in segments.items():
                # content_list is a list of {"type": ..., "lang": ..., "author": ..., "content": ...}
                for item in content_list:
                    c_type = item.get("type")
                    c_lang = item.get("lang")
                    c_author = item.get("author")
                    c_text = item.get("content")

                    if c_text:
                        cursor_content.execute("""
                            INSERT OR REPLACE INTO content_segments (
                                sutta_uid, segment_id, segment_order, type, lang, author_uid, content
                            ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        """, (uid, seg_id, order, c_type, c_lang, c_author, c_text))
                order += 1
        conn_content.commit()
        logger.info(f"   📦 [SQLite] {book_id} -> Core + Content({category} - Vertical)")

    def insert_super_book(self, super_book_data: Dict[str, Any]):
        book_id = super_book_data.get("id", "super")
        structure = super_book_data.get("structure", [])
        meta_dict = super_book_data.get("meta", {})
        
        children_map = defaultdict(list)
        self._extract_all_children_from_tree(structure, children_map)
        
        parent_map = self._build_parent_map(structure)

        with self._get_core_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT OR REPLACE INTO structure (book_id, tree_json) VALUES (?, ?)",
                         (book_id, json.dumps(structure, ensure_ascii=False)))
            
            for uid, m in meta_dict.items():
                if uid in parent_map:
                    m["parent_uid"] = parent_map[uid]

                # Pre-calculate search priority
                # 0: Primary, 1: Vinaya, 2: Abhidhamma, 3: Others
                b_id = m.get("book_id") or book_id
                priority = 3
                if b_id in ['dn', 'mn', 'sn', 'an', 'kp', 'dhp', 'ud', 'iti', 'snp', 'thag', 'thig']:
                    priority = 0
                elif b_id.startswith('pli-tv-'):
                    priority = 1
                elif b_id in ['ds', 'dt', 'kv', 'pp', 'vb', 'ya', 'patthana']:
                    priority = 2

                nav = m.get("nav", {})
                children_json = json.dumps(children_map.get(uid, []), ensure_ascii=False)
                cursor.execute("""
                    INSERT INTO metadata (
                        uid, book_id, type, acronym, translated_title, original_title,
                        blurb, author_uid, parent_uid, target_uid, children,
                        hash_id, extract_id, nav_prev, nav_next, child_range, search_priority
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(uid) DO UPDATE SET
                        type=excluded.type, acronym=excluded.acronym,
                        translated_title=excluded.translated_title, original_title=excluded.original_title,
                        blurb=excluded.blurb, author_uid=excluded.author_uid,
                        parent_uid=excluded.parent_uid, target_uid=excluded.target_uid,
                        children=CASE WHEN excluded.children = '[]' THEN metadata.children ELSE excluded.children END,
                        hash_id=excluded.hash_id,
                        extract_id=excluded.extract_id, nav_prev=excluded.nav_prev, nav_next=excluded.nav_next,
                        child_range=excluded.child_range,
                        search_priority=excluded.search_priority
                """, (
                    uid, b_id, m.get("type"), m.get("acronym"), m.get("translated_title"),
                    m.get("original_title"), m.get("blurb"), m.get("author_uid") or m.get("best_author_uid"),
                    m.get("parent_uid"), m.get("target_uid"), children_json,
                    m.get("hash_id"), m.get("extract_id"), nav.get("prev"), nav.get("next"),
                    m.get("child_range"), priority
                ))
            conn.commit()

    def insert_config(self, key: str, value: Any):
        """Lưu cấu hình ứng dụng vào core_db."""
        with self._get_core_connection() as conn:
            conn.execute("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", (key, json.dumps(value, ensure_ascii=False)))
            conn.commit()

    def _build_parent_map(self, node: Any, current_parent: Optional[str] = None, parent_map: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        """Extracts parent mappings based on the tree hierarchy."""
        if parent_map is None:
            parent_map = {}
        
        if isinstance(node, dict):
            for k, v in node.items():
                if current_parent:
                    parent_map[k] = current_parent
                self._build_parent_map(v, k, parent_map)
        elif isinstance(node, list):
            for item in node:
                if isinstance(item, str):
                    if current_parent:
                        parent_map[item] = current_parent
                else:
                    self._build_parent_map(item, current_parent, parent_map)
        
        return parent_map

    def _extract_all_children_from_tree(self, node: Any, result: Dict[str, List[str]]):
        if isinstance(node, dict):
            for uid, content in node.items():
                child_uids = []
                if isinstance(content, list):
                    for item in content:
                        if isinstance(item, str): child_uids.append(item)
                        elif isinstance(item, dict):
                            keys = list(item.keys())
                            child_uids.extend(keys)
                            self._extract_all_children_from_tree(item, result)
                elif isinstance(content, dict):
                    keys = list(content.keys())
                    child_uids.extend(keys)
                    self._extract_all_children_from_tree(content, result)
                
                existing_set = set(result[uid])
                for cid in child_uids:
                    if cid not in existing_set:
                        result[uid].append(cid)
                        existing_set.add(cid)
        elif isinstance(node, list):
            for item in node:
                self._extract_all_children_from_tree(item, result)
