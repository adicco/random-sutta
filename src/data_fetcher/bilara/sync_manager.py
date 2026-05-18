# Path: src/data_fetcher/bilara/sync_manager.py
import sys
from src.logging_config import setup_logging
from ..fetcher_config import FetcherConfig, BilaraConfig, HtmlTextConfig
from .vcs.git_wrapper import GitWrapper
from .logic.content_manager import ContentManager

logger = setup_logging("DataFetcher.Bilara")

def run_bilara_sync() -> None:
    """Điều phối quá trình đồng bộ toàn bộ repository sc-data từ GitHub về Local."""
    try:
        # 1. Sync Git Repo
        git_manager = GitWrapper()
        git_manager.sync_repo(FetcherConfig.SC_DATA_REPO_DIR)

        logger.info("✨ Sutta Data Sync (Full sc-data repository) completed successfully.")

    except Exception as e:
        logger.error(f"❌ Critical Error: {e}")
        # Không sys.exit(1) ở đây để Orchestrator có thể xử lý tiếp
        raise e