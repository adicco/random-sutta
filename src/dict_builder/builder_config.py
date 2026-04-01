# Path: src/dict_builder/builder_config.py
from pathlib import Path
from typing import List

class BuilderConfig:
    # --- Paths ---
    PROJECT_ROOT: Path = Path(__file__).parents[2]
    DPD_DB_PATH: Path = PROJECT_ROOT / "data" / "dpd" / "dpd.db"
    
    # Output Directories
    LOCAL_OUTPUT_DIR: Path = PROJECT_ROOT / "data" / "dpd"
    WEB_OUTPUT_DIR: Path = PROJECT_ROOT / "web" / "public" / "assets" / "db" / "dictionaries"
    
    TEMPLATES_DIR: Path = Path(__file__).parent / "templates"

    # --- Settings ---
    USE_COMPRESSION: bool = False 

    # --- Batch Sizes ---
    BATCH_SIZE_HEADWORDS: int = 10000
    BATCH_SIZE_DECON: int = 10000
    BATCH_SIZE_GRAMMAR: int = 10000
    
    ROOTS_START_ID: int = 1
    ROOTS_BATCH_SIZE: int = 500

    # EBTS Books Filter
    EBTS_BOOKS: List[str] = [""]

    def __init__(self, mode: str = "mini", export_web: bool = False, zip_only: bool = False):
        self.mode = mode
        # [REMOVED] html_mode
        self.export_web = export_web
        self.zip_only = zip_only
        
        self.OUTPUT_DIR = self.LOCAL_OUTPUT_DIR
        
        # [CLEANUP] Luôn dùng prefix chuẩn, không còn dpd_html_
        prefix = "dpd_"
        
        if self.mode == "tiny":
            self.DB_NAME = f"{prefix}tiny.db"
        elif self.mode == "full":
            self.DB_NAME = f"{prefix}full.db"
        else:
            self.DB_NAME = f"{prefix}mini.db"
            
        self.output_path = self.OUTPUT_DIR / self.DB_NAME

    @property
    def is_full_mode(self) -> bool:
        return self.mode == "full"
        
    @property
    def is_tiny_mode(self) -> bool:
        return self.mode == "tiny"