# Path: src/epub_builder/core/structure_processor.py
import logging
from typing import Dict, Any, List

logger = logging.getLogger("EpubBuilder.StructureProcessor")

class StructureProcessor:
    @staticmethod
    def _merge_titles(p_title: str, c_title: str) -> str:
        """Merge titles intelligently by collapsing overlapping suffix/prefix."""
        p_words = p_title.split()
        c_words = c_title.split()
        
        max_overlap = 0
        for i in range(1, min(len(p_words), len(c_words)) + 1):
            if p_words[-i:] == c_words[:i]:
                max_overlap = i
                
        if max_overlap > 0:
            return " ".join(p_words + c_words[max_overlap:])
        return f"{p_title} / {c_title}"

    @staticmethod
    def flatten_single_chains(structure: Any, meta_map: Dict[str, Dict[str, Any]]) -> Any:
        """
        Flattens hierarchy levels that have only one child, merging their titles.
        Example: Vinaya -> Pli-tv-bu-vb -> pli-tv-bu-vb-pj becomes 
        Vinaya / Pli-tv-bu-vb / pli-tv-bu-vb-pj if they were single chains.
        """
        if not structure:
            return structure
            
        if isinstance(structure, list):
            return [StructureProcessor.flatten_single_chains(child, meta_map) for child in structure]
            
        if isinstance(structure, dict):
            new_dict = {}
            for parent_id, content in structure.items():
                # Check if this parent has a single child to merge with
                if isinstance(content, list) and len(content) == 1:
                    child = content[0]
                    child_id = None
                    grandchildren = None
                    
                    if isinstance(child, str):
                        child_id = child
                    elif isinstance(child, dict) and len(child) == 1:
                        child_id = list(child.keys())[0]
                        grandchildren = child[child_id]
                    
                    if child_id and parent_id != child_id:
                        p_meta = meta_map.get(parent_id, {})
                        c_meta = meta_map.get(child_id, {})
                        
                        if p_meta and c_meta:
                            p_title = p_meta.get("translated_title") or p_meta.get("acronym") or parent_id.upper()
                            if not c_meta.get("_is_merged"):
                                c_title = c_meta.get("translated_title") or c_meta.get("acronym") or child_id
                                c_meta["translated_title"] = StructureProcessor._merge_titles(str(p_title).strip(), str(c_title).strip())
                                c_meta["_is_merged"] = True
                                
                            if not c_meta.get("blurb") and p_meta.get("blurb"):
                                c_meta["blurb"] = p_meta.get("blurb")
                                
                            if not c_meta.get("acronym") and p_meta.get("acronym"):
                                c_meta["acronym"] = p_meta.get("acronym")
                                
                            if not c_meta.get("child_range") and p_meta.get("child_range"):
                                c_meta["child_range"] = p_meta.get("child_range")
                                
                        # RECURSE from child level instead of keeping parent_id
                        if grandchildren is not None:
                            # It was a dict, keep flattening grandchildren
                            res = StructureProcessor.flatten_single_chains({child_id: grandchildren}, meta_map)
                            new_dict.update(res)
                        else:
                            # It was a string, parent is now replaced by child string
                            # But wait, new_dict is a mapping. A leaf is just a UID.
                            # In _traverse_tree, a dict {uid: children} is a branch.
                            # If we replace parent_id with child_id, we need to know children.
                            # If child was a string, it has no children.
                            new_dict[child_id] = None
                        continue
                
                # Normal recursion
                new_dict[parent_id] = StructureProcessor.flatten_single_chains(content, meta_map)
            return new_dict
            
        return structure

    @staticmethod
    def correct_types(meta_map: Dict[str, Dict[str, Any]], db: Any):
        """
        Heuristic: if it's a branch but has segments, it's actually a leaf.
        """
        for m_uid, m_data in meta_map.items():
            if m_data.get("type") == "branch":
                if db.has_segments(m_uid, m_data.get("book_id", "")):
                    m_data["type"] = "leaf"
                    logger.info(f"🔄 Corrected branch to leaf: {m_uid}")
