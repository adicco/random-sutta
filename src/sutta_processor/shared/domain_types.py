# Path: src/sutta_processor/shared/domain_types.py
from typing import TypedDict, Dict, Optional, Any

class SuttaMeta(TypedDict):
    uid: str
    type: str  # 'leaf' | 'branch' | 'subleaf' | 'alias'
    root_lang: Optional[str] # [NEW] 'pi' | 'lzh' | etc.
    acronym: str
    translated_title: str
    original_title: str
    blurb: Optional[str]
    best_author_uid: Optional[str]
    author_uid: Optional[str]
    
    # Dùng cho Subleaf: ID của thẻ article chứa nội dung
    extract_id: Optional[str]
    
    # Dùng cho Alias/Subleaf: UID của file mẹ chứa nội dung
    parent_uid: Optional[str]

    # [NEW] Dùng cho Alias: UID của file vật lý cần load (thường trùng parent_uid)
    target_uid: Optional[str]
    
    # [NEW] Dùng cho Alias: ID của phần tử HTML cần cuộn tới (Anchor)
    hash_id: Optional[str]
    
    # [NEW] Dùng cho Branch: Phạm vi suttas con (lấy từ child_range.json)
    child_range: Optional[str]

class SuttaSegment(TypedDict, total=False):
    pli: str
    eng: str
    html: str
    comm: str

class WorkerOutput(TypedDict):
    author_uid: Optional[str]
    data: Dict[str, SuttaSegment] 

class BookOutput(TypedDict):
    id: str
    title: str
    structure: Any
    meta: Dict[str, Dict[str, Any]]
    content: Dict[str, Dict[str, SuttaSegment]]