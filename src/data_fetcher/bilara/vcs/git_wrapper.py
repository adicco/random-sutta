# Path: src/data_fetcher/bilara/vcs/git_wrapper.py
import logging
import shutil
import subprocess
from pathlib import Path
from typing import List

from ...fetcher_config import FetcherConfig, BilaraConfig

logger = logging.getLogger("DataFetcher.Bilara.VCS")

class GitWrapper:
    def _run_git(self, cwd: Path, args: List[str]) -> None:
        try:
            subprocess.run(
                ["git"] + args,
                cwd=cwd,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Git command failed: {' '.join(args)}\nError: {e.stderr.strip()}")

    def _perform_fresh_clone(self, target_dir: Path) -> None:
        logger.info(f"   📥 Cloning fresh repository into {target_dir}...")
        if target_dir.exists():
            shutil.rmtree(target_dir)

        target_dir.mkdir(parents=True, exist_ok=True)
        self._run_git(target_dir.parent, [
            "clone", "--depth", "1", "--branch", BilaraConfig.BRANCH_NAME,
            BilaraConfig.REPO_URL, target_dir.name
        ])

    def _update_existing(self, target_dir: Path) -> None:
        if not (target_dir / ".git").exists():
            raise RuntimeError(f"Invalid git repository at {target_dir}")

        logger.info(f"   🔄 Updating existing repository (Target: {BilaraConfig.BRANCH_NAME})...")
        self._run_git(target_dir, ["fetch", "--depth", "1", "origin", BilaraConfig.BRANCH_NAME])
        self._run_git(target_dir, ["reset", "--hard", "FETCH_HEAD"])
        self._run_git(target_dir, ["clean", "-fdx"])

    def sync_repo(self, target_dir: Path) -> None:
        logger.info(f"⚡ Setting up data repository at {target_dir}...")
        if target_dir.exists():
            try:
                self._update_existing(target_dir)
                logger.info("✅ Repository updated.")
                return
            except Exception as e:
                logger.warning(f"⚠️ Update failed ({e}). Re-cloning...")

        try:
            self._perform_fresh_clone(target_dir)
            logger.info("✅ Repository synced successfully.")
        except Exception as e:
            logger.error(f"❌ Sync failed: {e}")
            raise e