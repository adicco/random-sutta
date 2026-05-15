# Path: src/sutta_processor/logic/range_expander/__init__.py
from .range_id_processor import expand_range_ids, generate_vinaya_variants
from .range_shortcut_generator import generate_subleaf_shortcuts

__all__ = ["expand_range_ids", "generate_vinaya_variants", "generate_subleaf_shortcuts"]
