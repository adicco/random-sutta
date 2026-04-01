# Path: src/release_system/release_config.py
from pathlib import Path

PROJECT_ROOT = Path(__file__).parents[2]
WEB_DIR = PROJECT_ROOT / "web"

BUILD_ROOT = PROJECT_ROOT / "build"

# [REFACTORED] Đổi tên Server -> PWA
# 1. PWA Build: Bản Web chuẩn (Progressive Web App), cần HTTP Server
# Trước đây là BUILD_ONLINE_DIR hoặc BUILD_SERVER_DIR
BUILD_PWA_DIR = BUILD_ROOT / "pwa"

# 2. Serverless Build: Bản Bundle, chạy trực tiếp file://
# Trước đây là BUILD_OFFLINE_DIR
BUILD_SERVERLESS_DIR = BUILD_ROOT / "serverless"

RELEASE_DIR = PROJECT_ROOT / "release"
APP_NAME = "random-sutta"

ENTRY_POINT = "assets/modules/core/app.js"

CRITICAL_ASSETS = [
    "assets/db/uid_index.json", 
    "assets/modules/data/constants.js"
]

VERSION_PLACEHOLDER = "dev-placeholder"