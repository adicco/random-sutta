# Path: src/data_fetcher/bilara/sync_manager.py
import sys
from src.logging_config import setup_logging
from ..fetcher_config import BilaraConfig, HtmlTextConfig
from .vcs.git_wrapper import GitWrapper
from .logic.content_manager import ContentManager

logger = setup_logging("DataFetcher.Bilara")

def run_bilara_sync() -> None:
    """Điều phối quá trình đồng bộ dữ liệu Bilara và HtmlText từ Git về Local."""
    try:
        # 1. Thu thập tất cả sparse paths từ cả hai config
        sparse_paths = list(BilaraConfig.FETCH_MAPPING.keys()) + list(HtmlTextConfig.FETCH_MAPPING.keys())

        # 2. Sync Git Repo
        git_manager = GitWrapper()
        git_manager.sync_repo(sparse_paths)

        # 3. Process Content
        content_manager = ContentManager()

        # 3a. Bilara Data
        content_manager.clean_destination(BilaraConfig.DATA_ROOT)
        content_manager.copy_data(BilaraConfig.FETCH_MAPPING, BilaraConfig.DATA_ROOT)

        # 3b. HtmlText Data
        content_manager.clean_destination(HtmlTextConfig.DATA_ROOT)
        content_manager.copy_data(HtmlTextConfig.FETCH_MAPPING, HtmlTextConfig.DATA_ROOT)

        logger.info("✨ Sutta Data Sync (Bilara & HtmlText) completed successfully.")

    except Exception as e:
        logger.error(f"❌ Critical Error: {e}")
        # Không sys.exit(1) ở đây để Orchestrator có thể xử lý tiếp
        raise e