# Path: src/sutta_processor/ingestion/parallels_parser.py
import json
import logging
from collections import defaultdict
from typing import Dict, List, Any
from pathlib import Path

logger = logging.getLogger("SuttaProcessor.ParallelsParser")

__all__ = ["parse_parallels"]

def _get_base_uid(full_id: str) -> str:
    """Extracts the base sutta UID (e.g., 'dn1' from 'dn1#1.1')."""
    return full_id.split("#")[0]

def parse_parallels(file_path: Path) -> Dict[str, Dict[str, Any]]:
    """
    Parses new_parallels.json and returns a mapping from sutta UID to its parallel relationships.
    Structure: { uid: { segment_id: { type: [target_ids...] } } }
    """
    if not file_path.exists():
        logger.warning(f"⚠️ Parallels file not found at {file_path}")
        return {}

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # sutta_map[base_uid][full_id][rel_type] = set()
    sutta_map = defaultdict(lambda: defaultdict(lambda: defaultdict(set)))
    
    # Map from sc-data keys to our internal types
    TYPE_MAP = {
        "full": "parallels",
        "resembling": "resembles",
        "mentions": "mentions",
        "retells": "retells"
    }
    
    def add_relation(source: str, target: str, rel_type: str):
        if not source or not target: return
        src_base = _get_base_uid(source)
        tgt_base = _get_base_uid(target)
        
        # Don't add self-parallels if they are the same sutta
        if src_base == tgt_base: return
        
        sutta_map[src_base][source][rel_type].add(target)
        sutta_map[tgt_base][target][rel_type].add(source)

    for source_id, content in data.items():
        # Handle top-level relations
        for raw_type, targets in content.items():
            if raw_type == "sections": continue
            rel_type = TYPE_MAP.get(raw_type)
            if not rel_type: continue
            
            for target_id in targets:
                add_relation(source_id, target_id, rel_type)
        
        # Handle section-level relations
        sections = content.get("sections", {})
        for section_id, section_content in sections.items():
            for raw_type, targets in section_content.items():
                rel_type = TYPE_MAP.get(raw_type)
                if not rel_type: continue
                
                for target_id in targets:
                    add_relation(section_id, target_id, rel_type)

    # Format the final dictionary
    RELATION_ORDER = ["parallels", "resembles", "mentions", "retells"]
    final_dict = {}
    
    for uid, segments in sutta_map.items():
        cleaned_segments = {}
        for seg_id, rels in segments.items():
            sorted_rels = {}
            for rel_type in RELATION_ORDER:
                if rel_type in rels:
                    sorted_rels[rel_type] = sorted(list(rels[rel_type]))
            if sorted_rels:
                cleaned_segments[seg_id] = sorted_rels
            
        if cleaned_segments:
            final_dict[uid] = cleaned_segments

    logger.info(f"   🔍 Parsed parallels for {len(final_dict)} unique suttas from {file_path.name}")
    return final_dict
