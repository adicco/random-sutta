# Path: src/alfred_workflow/workflow_builder.py
import os
import shutil
import zipfile
import plistlib
import json
from pathlib import Path

# Metadata cho Workflow
WORKFLOW_NAME = "Random Sutta Search"
WORKFLOW_BUNDLE_ID = "com.randomsutta.alfred"
WORKFLOW_KEYWORD = "rs"

def create_info_plist():
    """Tạo file info.plist cho Alfred Workflow."""
    plist = {
        "bundleid": WORKFLOW_BUNDLE_ID,
        "category": "Tools",
        "connections": {
            "7D52B7C1-4D6F-4B7C-8A5E-F7C93F9A1B2D": [
                {
                    "destinationuid": "9B1A2C3D-4E5F-6A7B-8C9D-0E1F2A3B4C5D",
                    "modifiers": 0,
                    "modifiersubtext": "",
                    "vitoclose": False
                }
            ]
        },
        "createdby": "Gemini CLI",
        "description": "Tìm kiếm kinh điển Phật giáo qua Random Sutta App",
        "disabled": False,
        "name": WORKFLOW_NAME,
        "objects": [
            {
                "config": {
                    "alfredfiltersresults": False,
                    "alfredfiltersresultsmargin": 0,
                    "argumenttreatemptyqueryasnil": True,
                    "argumenttrimmode": 0,
                    "argumenttype": 0,
                    "escaping": 102,
                    "keyword": WORKFLOW_KEYWORD,
                    "queuedelaycustom": 3,
                    "queuedelayimmediatelyinitially": True,
                    "queuedelaymode": 0,
                    "queuemode": 1,
                    "runningsubtext": "Đang tìm kiếm...",
                    "script": "/usr/bin/python3 search.py \"$1\"",
                    "scriptargtype": 1,
                    "scriptfile": "",
                    "subtext": "Nhập tên kinh hoặc mã UID (ví dụ: an1.1)",
                    "title": "Tìm kiếm kinh điển",
                    "type": 0,
                    "withspace": True
                },
                "type": "alfred.workflow.input.scriptfilter",
                "uid": "7D52B7C1-4D6F-4B7C-8A5E-F7C93F9A1B2D",
                "version": 3
            },
            {
                "config": {
                    "browser": "",
                    "spaces": "",
                    "url": "{query}",
                    "utf8": True
                },
                "type": "alfred.workflow.action.openurl",
                "uid": "9B1A2C3D-4E5F-6A7B-8C9D-0E1F2A3B4C5D",
                "version": 1
            }
        ],
        "readme": "Workflow này giúp tìm kiếm kinh điển nhanh chóng và mở bằng Random Sutta App (giao thức randomsutta://).",
        "uidata": {
            "7D52B7C1-4D6F-4B7C-8A5E-F7C93F9A1B2D": {
                "xpos": 50,
                "ypos": 50
            },
            "9B1A2C3D-4E5F-6A7B-8C9D-0E1F2A3B4C5D": {
                "xpos": 300,
                "ypos": 50
            }
        },
        "version": "1.0.0",
        "webaddress": "https://randomsutta.com"
    }
    return plist

def build_workflow(output_dir="dist/alfred"):
    print(f"🚀 Building Alfred Workflow: {WORKFLOW_NAME}...")
    
    # 1. Chuẩn bị thư mục tạm
    tmp_dir = Path("tmp/alfred_build")
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    tmp_dir.mkdir(parents=True)

    # 2. Copy Database
    db_src = Path("data/processed/sutta_core.db")
    if not db_src.exists():
        print(f"❌ Không tìm thấy database tại {db_src}. Hãy chạy 'make data' trước.")
        return
    shutil.copy(db_src, tmp_dir / "sutta_core.db")

    # 3. Copy Icon
    icon_src = Path("assets/icon.png")
    if icon_src.exists():
        shutil.copy(icon_src, tmp_dir / "icon.png")

    # 4. Tạo script search.py (Standalone version)
    search_script_content = """# -*- coding: utf-8 -*-
import sqlite3
import json
import sys
import os
import re

def normalize_query(query):
    return re.sub(r'[.*\\"\\\'/:]', ' ', query).strip()

def get_fts_query(clean_query):
    terms = clean_query.split()
    if not terms: return ""
    normalized = "".join(terms)
    fts_terms = " AND ".join([f"{t}*" for t in terms])
    return f'("{clean_query}" OR ({fts_terms}) OR "{normalized}*")'

def search(db_path, query):
    if not query or len(query) < 2: return {"items": []}
    clean_query = normalize_query(query)
    if not clean_query: return {"items": []}
    fts_query = get_fts_query(clean_query)
    phrase = clean_query.lower()
    acronym_search = f"%{phrase}%"
    normalized_query = "".join(clean_query.split()).lower()

    # Lưu ý: Join qua uid thay vì rowid để đảm bảo chính xác tuyệt đối
    sql = \"\"\"
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
        JOIN metadata m ON f.uid = m.uid
        LEFT JOIN metadata t ON m.target_uid = t.uid
        LEFT JOIN metadata p ON m.parent_uid = p.uid
        WHERE f.metadata_fts MATCH ? 
        ORDER BY match_priority, m.search_priority, rank 
        LIMIT 30
    \"\"\"
    items = []
    try:
        if not os.path.exists(db_path):
            return {"items": [{"title": "Database not found", "subtitle": f"Checked: {db_path}"}]}
            
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(sql, (normalized_query, acronym_search, phrase, phrase, phrase, fts_query))
        
        for row in cursor.fetchall():
            uid = row['uid']
            m_type = row['type']
            
            # Rendering logic
            if m_type in ['alias', 'subleaf']:
                is_alias = m_type == 'alias'
                orig = row['target_original_title'] if is_alias else row['parent_original_title']
                trans = row['target_translated_title'] if is_alias else row['parent_translated_title']
                title = trans or orig or row['acronym'] or uid
                subtitle = f"{uid} → {orig if trans else ''}"
                blurb = (row['target_blurb'] if is_alias else row['parent_blurb']) or row['blurb'] or ""
            else:
                orig = row['original_title']
                trans = row['translated_title']
                title = trans or orig or row['acronym'] or uid
                subtitle = f"{row['acronym'] or uid} | {orig if trans else ''}"
                blurb = row['blurb'] or ""

            if blurb:
                clean_blurb = re.sub('<[^<]+?>', '', blurb)
                clean_blurb = clean_blurb.replace('\\n', ' ').strip()
                if len(clean_blurb) > 100: clean_blurb = clean_blurb[:97] + "..."
                subtitle += f" | {clean_blurb}"

            items.append({
                "uid": uid,
                "title": title,
                "subtitle": subtitle,
                "arg": f"randomsutta://{uid}",
                "autocomplete": uid,
                "icon": {"path": "icon.png"}
            })
        conn.close()
    except Exception as e:
        return {"items": [{"title": "Error during search", "subtitle": str(e)}]}
    
    if not items:
        return {"items": [{"title": "No results found", "subtitle": f"No matches for '{query}'"}]}
        
    return {"items": items}

if __name__ == "__main__":
    # Alfred passes the query as the first argument
    query = sys.argv[1] if len(sys.argv) > 1 else ""
    # In Alfred, the working directory is the workflow folder
    # We use __file__ to get the absolute path to the script folder
    script_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(script_dir, "sutta_core.db")
    
    output = search(db_path, query)
    sys.stdout.write(json.dumps(output))
"""
    with open(tmp_dir / "search.py", "w") as f:
        f.write(search_script_content)

    # 5. Tạo info.plist
    plist_data = create_info_plist()
    with open(tmp_dir / "info.plist", "wb") as f:
        plistlib.dump(plist_data, f)

    # 6. Đóng gói thành .alfredworkflow (Zip)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    workflow_file = output_path / "RandomSutta.alfredworkflow"
    
    with zipfile.ZipFile(workflow_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(tmp_dir):
            for file in files:
                zipf.write(os.path.join(root, file), arcname=file)

    print(f"✅ Workflow đã được tạo tại: {workflow_file}")
    print(f"💡 Chỉ cần click đúp vào file trên để cài đặt vào Alfred.")

if __name__ == "__main__":
    build_workflow()
