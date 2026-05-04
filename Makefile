# Path: Makefile
.PHONY: help setup sync sync-text sync-api sync-dpd dry data d de dv dz da dt df build re dev view deploy beta official publish clean noedit undo mini

# Python command (sử dụng môi trường hiện tại do direnv quản lý)
PYTHON := python3

# ==============================================================================
# 🎯 DEFAULT / HELP
# ==============================================================================
help:
	@echo "📚 RANDOM SUTTA DEVELOPER TOOLS"
	@echo "----------------------------------------------------------------"
	@echo "🛠️  SETUP & SYNC:"
	@echo "  make setup          - Install Git hooks"
	@echo "  make sync           - Sync ALL data (Bilara + API + DPD)"
	@echo "  make sync-text      - Sync ONLY Bilara Text (-s)"
	@echo "  make sync-api       - Sync ONLY API Metadata (-a)"
	@echo "  make sync-dpd       - Sync ONLY DPD Dictionary (-d)"
	@echo ""
	@echo "⚙️  DATA PROCESSING:"
	@echo "  make data           - Process JSON -> Optimized Assets"
	@echo "  make dry            - Process Data (Dry Run)"
	@echo ""
	@echo "📖 DICTIONARY BUILDER:"
	@echo "  make d              - Build Mini Dictionary ONLY (-m)"
	@echo "  make de           - Build Mini Dictionary & Zip (-e)"
	@echo "  make dvz          - Update Search Logic & Zip (-vz)"
	@echo "  make dv             - Update Search Logic ONLY (-v)"
	@echo "  make dz           - Package Existing DB to Web Assets (-z)"
	@echo "  make da           - Build ALL Dictionaries (-a)"
	@echo "  make dt          - Build Tiny Dictionary (-t)"
	@echo "  make df          - Build Full Dictionary (-f)"
	@echo "  make mini {word} - Search 'word' in Mini DB (Open CSV)"
	@echo ""
	@echo "🏗️  BUILD & PREVIEW:"
	@echo "  make build          - Run Full Build (Data + Vite)"
	@echo "  make re             - Quick Re-build (Vite Only)"
	@echo "  make dev            - Vite Dev Server with HMR"
	@echo "  make view           - Preview Vite Production Build"
	@echo "  make epub           - Generate EPUB Book"
	@echo "  make calibre        - Build and Copy EPUB to Calibre Library"
	@echo ""
	@echo "🚀 RELEASE & DEPLOY:"
	@echo "  make deploy         - Build & Deploy Web to GH-Pages"
	@echo "  make beta           - Publish Pre-release (Commit -> Push -> GH Release)"
	@echo "  make official       - Publish OFFICIAL (Commit -> Push -> GH Release)"
	@echo "  make publish        - Publish OFFICIAL and Deploy"
	@echo ""
	@echo "🧹 MAINTENANCE:"
	@echo "  make clean          - Remove all build artifacts & cache"
	@echo "----------------------------------------------------------------"

# ==============================================================================
# 🛠️ SETUP & SYNC
# ==============================================================================
setup:
	@echo "🔧 Installing Git Hooks..."
	$(PYTHON) src/setup_hooks.py

sync:
	@echo "📥 Syncing ALL Data (Bilara + API + DPD)..."
	$(PYTHON) -m src.data_fetcher -s -a -d

sync-text:
	@echo "📥 Syncing Bilara Text only..."
	$(PYTHON) -m src.data_fetcher -s

sync-api:
	@echo "📥 Fetching API Metadata only..."
	$(PYTHON) -m src.data_fetcher -a

sync-dpd:
	@echo "📥 Fetching/Updating DPD Dictionary..."
	$(PYTHON) -m src.data_fetcher -d

# ==============================================================================
# ⚙️ BUILD & PROCESS
# ==============================================================================
dry:
	@echo "🧠 Processing Data (Dry Run)..."
	$(PYTHON) -m src.sutta_processor -d

data:
	@echo "🧠 Processing Data..."
	$(PYTHON) -m src.sutta_processor

# ==============================================================================
# 📖 DICTIONARY BUILDER
# ==============================================================================
d:
	@echo "📖 Building Dictionary Local (Mini)..."
	$(PYTHON) -m src.dict_builder -m

de:
	@echo "📖 Building Dictionary (Mini)..."
	$(PYTHON) -m src.dict_builder -e

dvz:
	@echo "🔮 Updating Dictionary Views & Zip..."
	$(PYTHON) -m src.dict_builder -vz

dv:
	@echo "🔮 Updating Dictionary Views (Logic Only)..."
	$(PYTHON) -m src.dict_builder -v

dz:
	@echo "📦 Packaging Dictionary..."
	$(PYTHON) -m src.dict_builder -z

da:
	@echo "📖 Building ALL Dictionaries..."
	$(PYTHON) -m src.dict_builder -a

dt:
	@echo "📖 Building Dictionary (Tiny)..."
	$(PYTHON) -m src.dict_builder -t

df:
	@echo "📖 Building Dictionary (Full)..."
	$(PYTHON) -m src.dict_builder -f

# Handle arguments for 'mini' command
ifeq (mini,$(firstword $(MAKECMDGOALS)))
  # Get arguments after 'mini'
  MINI_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  # Turn them into do-nothing targets so make doesn't complain
  $(eval $(MINI_ARGS):;@:)
endif

mini:
	@echo "🔍 Searching for '$(MINI_ARGS)' in Mini DB..."
	$(PYTHON) scripts/db_search.py $(MINI_ARGS) -d data/dpd/dpd_mini.db -c

build: data re

# Chỉ chạy Vite Build (không chạy lại Data Processor)
re:
	@echo "🔨 Running Vite Build..."
	npm run build

# ==============================================================================
# 🌍 SERVERS & PREVIEW
# ==============================================================================
dev:
	@echo "🌍 Starting Vite Dev Server on port 8000..."
	npm run dev -- --port 8000

view:
	@echo "🌍 Starting Vite Preview Server on port 8001..."
	npm run preview -- --port 8001

epub:
	@echo "📚 Building EPUB Book..."
	$(PYTHON) -m src.epub_builder

calibre: epub
	@echo "🚚 Copying EPUB to Calibre Library..."
	@mkdir -p "../../My Drive/Calibre Library/Random Sutta/SuttaCentral Tipitaka (3564)"
	cp dist/epub/random_sutta.epub "../../My Drive/Calibre Library/Random Sutta/SuttaCentral Tipitaka (3564)/SuttaCentral Tipitaka - Random Sutta.epub"
	@echo "✅ EPUB copied to Calibre Library."

# ==============================================================================
# 🚀 RELEASE ACTIONS
# ==============================================================================

# Deploy Web (GH Pages via Vite plugin / npm script)
deploy: re
	npm run deploy

# Publish Pre-release
beta: apk epub
	@echo "🚀 PUBLISHING BETA..."
	$(PYTHON) -m src.release_system --publish

# Publish Official
official: apk epub
	@echo "🚀 PUBLISHING OFFICIAL..."
	$(PYTHON) -m src.release_system --official

# Publish + Deploy
publish: official deploy
	@echo "🌟 PUBLISHED AND DEPLOYED!"

# ==============================================================================
# 🧹 CLEANUP
# ==============================================================================
clean:
	@echo "🧹 Cleaning up..."
	rm -rf build/ dist/ release/ tmp/
	rm -f web/public/assets/db/sutta_*.db
	rm -f web/public/assets/db/db_manifest.json
	rm -rf web/assets/modules/data/constants.js
	@echo "🗑️  Removing cache directories (skipping envs)..."
	find . \( -name ".venv" -o -name ".direnv" -o -name "node_modules" -o -name ".git" \) -prune -o \
		\( -type d -name "__pycache__" -o -type d -name ".pytest_cache" \) -exec rm -rf {} +
	@echo "✅ Clean complete."

# Git helpers
noedit:
	@git add . && git commit --amend --no-edit
undo:
	@git reset --soft HEAD~1

# ==============================================================================
# 📱 ANDROID / APK COMMANDS
# ==============================================================================

# Biên dịch web cho APK và xuất file APK ngay lập tức
apk:
	@echo "🚀 Đang biên dịch mã nguồn cho APK (Offline mode)..."
	APK_BUILD=true npm run build
	@echo "🔄 Đồng bộ với dự án Android (Capacitor)..."
	npx cap sync
	@echo "📦 Đang tạo file APK (Debug)..."
	export JAVA_HOME="/Library/Java/JavaVirtualMachines/microsoft-25.jdk/Contents/Home" && \
	cd android && ./gradlew assembleDebug
	@mkdir -p dist/apk
	@cp android/app/build/outputs/apk/debug/app-debug.apk dist/apk/randomsutta.apk
	@rm -f randomsutta.apk
	@echo "✅ XONG! File APK của bạn nằm tại:"
	@echo "📍 dist/apk/randomsutta.apk"

# Mở dự án Android bằng Android Studio
open-apk:
	npx cap open android

# Dọn dẹp cache Android
clean-apk:
	cd android && ./gradlew clean