# Path: src/epub_builder/core/structure_processor.py
import logging
from typing import Dict, Any, List

logger = logging.getLogger("EpubBuilder.StructureProcessor")

class StructureProcessor:
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
            keys = list(structure.keys())
            if len(keys) == 1:
                parent_id = keys[0]
                content = structure[parent_id]
                
                if isinstance(content, list) and len(content) == 1:
                    child = content[0]
                    child_id = None
                    if isinstance(child, str):
                        child_id = child
                    elif isinstance(child, dict):
                        child_id = list(child.keys())[0]
                        
                    if child_id:
                        p_meta = meta_map.get(parent_id, {})
                        c_meta = meta_map.get(child_id, {})
                        
                        if p_meta and c_meta and parent_id != child_id:
                            p_title = p_meta.get("translated_title") or p_meta.get("acronym") or parent_id.upper()
                            if not c_meta.get("_is_merged"):
                                c_title = c_meta.get("translated_title") or c_meta.get("acronym") or child_id
                                c_meta["translated_title"] = f"{p_title} / {c_title}"
                                c_meta["_is_merged"] = True
                                
                            if not c_meta.get("blurb") and p_meta.get("blurb"):
                                c_meta["blurb"] = p_meta.get("blurb")
                                
                            if not c_meta.get("acronym") and p_meta.get("acronym"):
                                c_meta["acronym"] = p_meta.get("acronym")
                                
                            if not c_meta.get("child_range") and p_meta.get("child_range"):
                                c_meta["child_range"] = p_meta.get("child_range")
                                
                        return StructureProcessor.flatten_single_chains(child, meta_map)
                        
            return {k: StructureProcessor.flatten_single_chains(v, meta_map) for k, v in structure.items()}
            
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
