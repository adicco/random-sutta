# Path: src/sutta_processor/logic/structure/tree_loader.py
import json
import logging
from typing import Dict, Any, List

from ...shared.app_config import RAW_BILARA_DIR, RAW_STRUCTURE_DIR

logger = logging.getLogger("SuttaProcessor.Logic.Structure.Loader")

def load_original_tree(group_name: str) -> Dict[str, Any]:
    """Tải file tree gốc từ thư mục raw."""
    book_id = group_name.split("/")[-1]
    tree_path = RAW_STRUCTURE_DIR / "tree" / group_name / f"{book_id}-tree.json"
    
    if not tree_path.exists():
        # Fallback search
        found = list((RAW_STRUCTURE_DIR / "tree").rglob(f"{book_id}-tree.json"))
        if found:
            tree_path = found[0]
        else:
            # [FIXED] Critical Fallback cho Single Leaf Books (như Patimokkha)
            # Nếu không có tree file, giả định sách chứa chính nó là content node.
            # Điều này kích hoạt logic quét Alias/Subleaf trong structure_expansion.
            logger.info(f"   ⚠️ No tree file for {book_id}. Assuming Single Leaf Structure.")
            return {book_id: [book_id]}

    try:
        with open(tree_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"⚠️ Could not load tree for {book_id}: {e}")
        # Return fallback structure on error too
        return {book_id: [book_id]}

def simplify_structure(node: Any) -> Any:
    """Đệ quy đơn giản hóa cấu trúc cây (loại bỏ các list lồng nhau không cần thiết)."""
    if isinstance(node, list):
        if all(isinstance(x, str) for x in node):
            return node
        if any(isinstance(x, str) for x in node):
            # Mixed content? Keep as is or process recursive
            return [simplify_structure(item) for item in node]
        
        # Flatten logic for list of dicts
        new_dict = {}
        for item in node:
            if isinstance(item, dict):
                for key, val in item.items():
                    new_dict[key] = simplify_structure(val)
            elif isinstance(item, str):
                 # Should be caught above, but safe fallback
                 pass
        return new_dict
        
    elif isinstance(node, dict):
        return {k: simplify_structure(v) for k, v in node.items()}
    return node