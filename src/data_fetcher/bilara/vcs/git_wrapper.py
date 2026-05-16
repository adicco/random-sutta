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

    def _configure_sparse_checkout(self, sparse_paths: List[str]) -> None:
        self._run_git(FetcherConfig.CACHE_DIR, ["config", "core.sparseCheckout", "true"])
        sparse_path = FetcherConfig.CACHE_DIR / ".git" / "info" / "sparse-checkout"
        sparse_path.parent.mkdir(parents=True, exist_ok=True)

        with open(sparse_path, "w") as f:
            for path in sparse_paths:
                f.write(path.strip("/") + "\n")

    def _perform_fresh_clone(self, sparse_paths: List[str]) -> None:
        logger.info("   📥 Cloning fresh repository...")
        if FetcherConfig.CACHE_DIR.exists():
            shutil.rmtree(FetcherConfig.CACHE_DIR)

        FetcherConfig.CACHE_DIR.mkdir(parents=True, exist_ok=True)
        self._run_git(FetcherConfig.CACHE_DIR, ["init"])
        self._run_git(FetcherConfig.CACHE_DIR, ["remote", "add", "origin", BilaraConfig.REPO_URL])

        self._configure_sparse_checkout(sparse_paths)

        logger.info(f"   📥 Fetching {BilaraConfig.BRANCH_NAME}...")
        self._run_git(FetcherConfig.CACHE_DIR, ["fetch", "--depth", "1", "origin", BilaraConfig.BRANCH_NAME])

        logger.info("   🔨 Resetting to match remote...")
        self._run_git(FetcherConfig.CACHE_DIR, ["reset", "--hard", "FETCH_HEAD"])

    def _update_existing(self, sparse_paths: List[str]) -> None:
        if not (FetcherConfig.CACHE_DIR / ".git").exists():
            raise RuntimeError("Invalid git repository")

        logger.info(f"   🔄 Updating existing repository (Target: {BilaraConfig.BRANCH_NAME})...")
        self._configure_sparse_checkout(sparse_paths)
        self._run_git(FetcherConfig.CACHE_DIR, ["fetch", "--depth", "1", "origin", BilaraConfig.BRANCH_NAME])
        self._run_git(FetcherConfig.CACHE_DIR, ["reset", "--hard", "FETCH_HEAD"])
        self._run_git(FetcherConfig.CACHE_DIR, ["clean", "-fdx"])

    def sync_repo(self, sparse_paths: List[str]) -> None:
        logger.info("⚡ Setting up data repository...")
        if FetcherConfig.CACHE_DIR.exists():
            try:
                self._update_existing(sparse_paths)
                logger.info("✅ Repository updated.")
                return
            except Exception as e:
                logger.warning(f"⚠️ Update failed ({e}). Re-cloning...")

        try:
            self._perform_fresh_clone(sparse_paths)
            logger.info("✅ Repository synced successfully.")
        except Exception as e:
            logger.error(f"❌ Sync failed: {e}")
            raise e