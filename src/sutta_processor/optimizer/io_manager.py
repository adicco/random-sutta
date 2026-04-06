# Path: src/sutta_processor/optimizer/io_manager.py
import json
import shutil
import logging
from pathlib import Path
from typing import Any, List
from .config import (
    WEB_DB_DIR, WEB_META_DIR, WEB_CONTENT_DIR, WEB_INDEX_DIR,
    MIRROR_DB_DIR, MIRROR_META_DIR, MIRROR_CONTENT_DIR, MIRROR_INDEX_DIR
)

logger = logging.getLogger("Optimizer.IO")

class IOManager:
    def __init__(self, dry_run: bool):
        self.dry_run = dry_run

    def setup_directories(self) -> None:
        """
        Reset và tạo mới cấu trúc thư mục.
        [UPDATED] Selective Cleanup: Chỉ xóa các artifact do processor tạo ra,
        giữ nguyên các file khác trong thư mục db/.
        """
        # 1. Mirror (Always Reset completely - Safe for Dev)
        if MIRROR_DB_DIR.exists():
            shutil.rmtree(MIRROR_DB_DIR)
        
        MIRROR_DB_DIR.mkdir(parents=True)
        MIRROR_META_DIR.mkdir()
        MIRROR_CONTENT_DIR.mkdir()
        MIRROR_INDEX_DIR.mkdir()

        # 2. Web (Prod Only)
        if not self.dry_run:
            # Đảm bảo thư mục gốc tồn tại
            if not WEB_DB_DIR.exists():
                WEB_DB_DIR.mkdir(parents=True, exist_ok=True)
            
            # Danh sách các mục tiêu cần xóa (Selective Delete)
            targets_to_clean: List[Path] = [
                WEB_META_DIR,
                WEB_CONTENT_DIR,
                WEB_INDEX_DIR,
                WEB_DB_DIR / "uid_index.json",
                WEB_DB_DIR / "db_bundle.zip"
            ]

            logger.info("   🧹 Cleaning up old DB artifacts...")
            
            for target in targets_to_clean:
                if target.exists():
                    try:
                        if target.is_dir():
                            shutil.rmtree(target)
                        else:
                            target.unlink()
                    except Exception as e:
                        logger.warning(f"   ⚠️ Could not delete {target.name}: {e}")

            # Re-create sub-directories
            WEB_META_DIR.mkdir(exist_ok=True)
            WEB_CONTENT_DIR.mkdir(exist_ok=True)
            WEB_INDEX_DIR.mkdir(exist_ok=True)
            
        else:
            logger.info("   🧪 Dry-run: Skipping Web DB write")

    def get_safe_name(self, relative_path: Path) -> str:
        name = relative_path.name.replace("_book.json", "").replace(".json", "")
        parts = list(relative_path.parent.parts)
        parts.append(name)
        return "_".join(parts)

    def save_category(self, category: str, filename: str, data: Any) -> None:
        """
        Lưu file vào category tương ứng ('meta', 'content', hoặc 'root').
        [UPDATED] Disabled production JSON output as it's replaced by SQLite.
        Only writes to Mirror for debugging purposes.
        """
        # Xác định target path
        mirror_target = None

        if category == "meta":
            mirror_target = MIRROR_META_DIR / filename
        elif category == "content":
            mirror_target = MIRROR_CONTENT_DIR / filename
        else: 
            mirror_target = MIRROR_DB_DIR / filename

        # 1. Write Mirror (Pretty Print - Dễ đọc)
        try:
            if not mirror_target.parent.exists():
                mirror_target.parent.mkdir(parents=True, exist_ok=True)
                
            with open(mirror_target, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"❌ Write Mirror Error {filename}: {e}")

        # [DISABLED] Production Web write is now handled by SQLite.
        pass