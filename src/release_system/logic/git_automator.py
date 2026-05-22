# Path: src/release_system/logic/git_automator.py
import logging
import subprocess
from pathlib import Path
from typing import List

from ..release_config import PROJECT_ROOT

logger = logging.getLogger("Release.GitAutomator")

def _run_git_cmd(args: List[str]) -> bool:
    # ... (Giữ nguyên hàm này) ...
    try:
        subprocess.run(
            ["git"] + args,
            cwd=PROJECT_ROOT,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Git Error: {' '.join(args)}\n   {e.stderr.strip()}")
        return False

def commit_source_changes(version_tag: str) -> bool:
    """Commit source changes (version bump and altstore update)."""
    logger.info("🐙 Committing source changes...")
    
    # Files to stage
    target_files = ["package.json", "altstore.json", "web/"]
    
    for target in target_files:
        if (PROJECT_ROOT / target).exists():
            _run_git_cmd(["add", target])

    # Kiểm tra xem có gì để commit không
    status = subprocess.run(["git", "status", "--porcelain"], cwd=PROJECT_ROOT, capture_output=True, text=True)
    if not status.stdout.strip():
        logger.info("   ℹ️  No source changes to commit.")
        return True

    commit_msg = f"chore(release): bump version and update altstore source for {version_tag}"
    
    # [FIX 2] Thêm cờ '-n' (no-verify) để bỏ qua pre-commit hook
    # Tránh việc script commit -> kích hoạt hook -> hook lại chạy script build -> vòng lặp
    if _run_git_cmd(["commit", "-n", "-m", commit_msg]):
        logger.info(f"   ✅ Git committed: '{commit_msg}'")
        return True
    return False

def push_changes() -> bool:
    logger.info("⬆️  Pushing source code to remote...")
    return _run_git_cmd(["push"])