# Path: src/sutta_processor/ingestion/legacy_converter/orchestrator.py
import logging
from pathlib import Path

from src.logging_config import setup_logging
from .config import ConverterConfig
from .html_parser import LegacyHtmlParser
from .writer import BilaraWriter

logger = setup_logging("LegacyConverter")

class ConversionOrchestrator:
    def __init__(self):
        self.config = ConverterConfig()
        self.writer = BilaraWriter()

    def _is_already_converted(self, uid: str, rel_path: str) -> bool:
        """Check if SuttaCentral already processed this file in the official bilara/root."""
        # SC's path format: data/bilara/root/lzh/sct/sutta/ma/ma1_root-lzh-sct.json
        # Here we do a loose check: if a file starting with uid_root exists in SC's directory
        
        sc_dir = self.config.BILARA_ROOT_DIR / "lzh" / "sct" / rel_path
        if sc_dir.exists():
            # e.g., sa1_root-lzh-sct.json or sa1_root...
            for file in sc_dir.iterdir():
                if file.name.startswith(f"{uid}_root"):
                    return True
        return False

    def convert_file(self, html_path: Path, rel_path: str) -> bool:
        uid = html_path.stem
        
        # Check if SC already has it
        if self._is_already_converted(uid, rel_path):
            logger.debug(f"⏭️ Skipping {uid} (Already in SC Bilara)")
            return False

        logger.info(f"🔄 Converting {uid}...")
        try:
            with open(html_path, 'r', encoding='utf-8') as f:
                html_content = f.read()

            taisho_no = self.config.get_taisho_no(uid)
            parser = LegacyHtmlParser(self.config.TAISHO_MAPPING)
            
            parsed_data = parser.parse(html_content, uid, taisho_no)
            
            self.writer.write_output(
                uid=uid, 
                parsed_data=parsed_data, 
                output_dir=self.config.BILARA_MORE_DIR, 
                rel_path=rel_path
            )
            return True
        except Exception as e:
            logger.error(f"❌ Failed to convert {uid}: {e}")
            return False

    def run_batch(self) -> None:
        logger.info("🚀 Starting Batch Conversion from html_text to bilara_more...")
        lzh_dir = self.config.HTML_TEXT_DIR / "lzh"
        
        if not lzh_dir.exists():
            logger.error(f"Directory not found: {lzh_dir}")
            return

        converted_count = 0
        skipped_count = 0

        # Recursively find all HTML files
        for html_file in lzh_dir.rglob("*.html"):
            # calculate rel_path, e.g., "sutta/ma" from "data/html_text/lzh/sutta/ma/ma1.html"
            rel_path = str(html_file.parent.relative_to(lzh_dir))
            # Sometime rel_path has subdirectories like sa1-100, we should keep it to match structure
            
            success = self.convert_file(html_file, rel_path)
            if success:
                converted_count += 1
            else:
                skipped_count += 1

        logger.info(f"✨ Conversion completed! Converted: {converted_count}, Skipped (or failed): {skipped_count}")
