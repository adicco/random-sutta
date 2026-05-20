# Path: src/alfred_workflow/search_logic.py
import sqlite3
import re

def normalize_query(query):
    """Clean query for FTS5 compatibility."""
    return re.sub(r'[.*"\'/:]', ' ', query).strip()

def get_fts_query(clean_query):
    """Generate FTS5 match string."""
    terms = clean_query.split()
    if not terms:
        return ""
    
    normalized = "".join(terms)
    fts_terms = " AND ".join([f"{t}*" for t in terms])
    return f'("{clean_query}" OR ({fts_terms}) OR "{normalized}*")'

def search_suttas(db_path, query, limit=30):
    """Search for suttas in the database and return raw results."""
    if not query or len(query) < 2:
        return []

    clean_query = normalize_query(query)
    if not clean_query:
        return []

    fts_query = get_fts_query(clean_query)
    phrase = clean_query.lower()
    acronym_search = f"%{phrase}%"
    normalized_query = "".join(clean_query.split()).lower()

    sql = """
        SELECT 
            m.uid, m.type, m.target_uid, m.parent_uid, m.acronym,
            m.original_title, m.translated_title, m.blurb,
            t.original_title as target_original_title, t.translated_title as target_translated_title, t.blurb as target_blurb,
            p.original_title as parent_original_title, p.translated_title as parent_translated_title, p.blurb as parent_blurb,
            (CASE 
                WHEN m.uid = ? THEN 0
                WHEN m.acronym LIKE ? THEN 1
                WHEN (m.original_title LIKE '%' || ? || '%' OR m.translated_title LIKE '%' || ? || '%' OR m.blurb LIKE '%' || ? || '%') THEN 2
                ELSE 3
            END) as match_priority
        FROM metadata_fts f
        JOIN metadata m ON f.rowid = m.rowid
        LEFT JOIN metadata t ON m.target_uid = t.uid
        LEFT JOIN metadata p ON m.parent_uid = p.uid
        WHERE f.metadata_fts MATCH ? 
        ORDER BY match_priority, m.search_priority, rank 
        LIMIT ?
    """

    results = []
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute(sql, (
            normalized_query, 
            acronym_search,
            phrase, phrase, phrase,
            fts_query,
            limit
        ))
        
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
    except Exception as e:
        print(f"Database error: {e}")
    
    return results
