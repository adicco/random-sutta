# Path: Makefile
.PHONY: help setup sync sync-text sync-api sync-dpd dry data d de dv dz da dt df build re dev view deploy beta official publish clean noedit undo mini app clean-releases apk open-apk clean-apk ios open-ios clean-ios macos macos-debug app-debug alfred

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
	@echo "  make macos-debug    - Build MacOS App (Debug mode)"
	@echo "  make app            - Build MacOS App & Install to /Applications"
	@echo "  make alfred         - Build Alfred Workflow for quick search"
	@echo "  make dev            - Vite Dev Server with HMR"
	@echo "  make view           - Preview Vite Production Build"
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

# ==============================================================================
# 🚀 RELEASE ACTIONS
# ==============================================================================

# Deploy Web (GH Pages via Vite plugin / npm script)
# [UPDATED] Automatically generate OTA package during deploy for native app sync
deploy: re ota
	npm run deploy

# Publish Pre-release
beta: apk ios macos alfred
	@echo "🚀 PUBLISHING BETA..."
	$(PYTHON) -m src.release_system --publish --altstore

# Publish Official
official: apk ios macos alfred
	@echo "🚀 PUBLISHING OFFICIAL..."
	$(PYTHON) -m src.release_system --official

# Publish + Deploy
publish: official deploy
	@echo "🌟 PUBLISHED AND DEPLOYED!"

# [NEW] OTA Update Packaging
ota: re
	@echo "📦 Packaging Lean OTA Update..."
	$(PYTHON) -m src.release_system --ota
	@echo "✅ OTA Update files are ready in dist/web/ for deployment"

# Sync AltStore manifest with latest GitHub release
altstore-sync:
	@echo "📡 Syncing AltStore with GitHub latest release..."
	$(PYTHON) -m src.release_system --sync
	@echo "✅ altstore.json updated. Remember to git push if needed."

# Delete all releases except the latest one
clean-releases:
	@echo "🧹 Cleaning up old GitHub releases..."
	@latest=$$(gh release list --limit 1 --json tagName --jq '.[0].tagName'); \
	all_tags=$$(gh release list --limit 100 --json tagName --jq '.[].tagName'); \
	for tag in $$all_tags; do \
		if [ "$$tag" != "$$latest" ]; then \
			echo "🗑️ Deleting release and tag: $$tag"; \
			gh release delete "$$tag" --yes --cleanup-tag; \
		fi; \
	done
	@echo "✅ Cleanup complete. Only latest release ($$latest) remains."

# ==============================================================================
# 🧹 CLEANUP
# ==============================================================================
clean:
	@echo "🧹 Cleaning up..."
	rm -rf build/ dist/ release/ tmp/ web/dev-dist/
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

# Build APK (Common logic)
apk-build:
	@echo "🚀 Đang biên dịch mã nguồn cho APK (Offline mode)..."
	APK_BUILD=true npm run build
	@echo "🔄 Đồng bộ với dự án Android (Capacitor)..."
	npx cap sync
	@echo "📦 Đang tạo file APK (Debug)..."
	export JAVA_HOME="/Library/Java/JavaVirtualMachines/microsoft-25.jdk/Contents/Home" && \
	cd android && ./gradlew assembleDebug
	@mkdir -p dist/apk
	@cp android/app/build/outputs/apk/debug/app-debug.apk dist/apk/randomsutta.apk
	@echo "✅ Build hoàn tất: dist/apk/randomsutta.apk"

# Build và Copy vào thư mục Download
apk: apk-build apk-copy

# Copy APK vào thư mục Download của Android (Yêu cầu ADB và bật USB Debugging)
apk-copy:
	@if command -v adb >/dev/null 2>&1; then \
		if [ "$$(adb devices | grep -v "List" | grep "device")" != "" ]; then \
			echo "📲 Phát hiện thiết bị Android. Đang copy APK vào thư mục Download..."; \
			adb push dist/apk/randomsutta.apk /sdcard/Download/randomsutta.apk && \
			echo "✅ Đã copy vào /sdcard/Download/randomsutta.apk thành công!" || \
			echo "❌ Lỗi khi copy. Hãy kiểm tra kết nối USB."; \
		else \
			echo "⚠️ Không tìm thấy thiết bị Android nào qua ADB. Hãy bật USB Debugging."; \
		fi \
	else \
		echo "⚠️ Không tìm thấy lệnh 'adb'. Hãy cài đặt Android Platform Tools."; \
	fi

# Cài đặt trực tiếp APK vào máy Android và khởi chạy
apk-install: apk-build
	@if command -v adb >/dev/null 2>&1; then \
		echo "🚀 Đang cài đặt APK trực tiếp vào thiết bị..."; \
		adb install -r dist/apk/randomsutta.apk && \
		echo "✅ Đã cài đặt thành công! Đang khởi chạy ứng dụng..." && \
		adb shell am start -n com.randomsutta.app/com.randomsutta.app.MainActivity || \
		echo "❌ Thất bại. Hãy đảm bảo máy đã mở khóa và cho phép cài đặt."; \
	else \
		echo "⚠️ ADB không khả dụng."; \
	fi

# Mở dự án Android bằng Android Studio
open-apk:
	npx cap open android

# Dọn dẹp cache Android
clean-apk:
	cd android && ./gradlew clean

# ==============================================================================
# 🍎 IOS COMMANDS
# ==============================================================================

# Biên dịch web và đồng bộ với iOS, sau đó build release IPA cho AltStore
ios:
	@echo "🚀 Đang biên dịch mã nguồn cho iOS (AltStore mode)..."
	CAPACITOR_BUILD=true npm run build
	@echo "🔄 Đồng bộ với dự án iOS (Capacitor)..."
	npx cap sync ios
	@echo "📦 Đang tạo bản build IPA cho AltStore..."
	npx cap build ios --scheme App --configuration Release --xcode-export-method debugging
	@mkdir -p dist/ios
	@cp ios/App/output/App.ipa dist/ios/randomsutta.ipa
	@echo "✅ XONG! File IPA của bạn nằm tại:"
	@echo "📍 dist/ios/randomsutta.ipa"
	@$(MAKE) ios-copy

# Chỉ thực hiện copy IPA vào iPhone (yêu cầu đã build trước đó)
ios-copy:
	@if command -v idevice_id >/dev/null 2>&1 && [ "$$(idevice_id -l)" != "" ]; then \
		echo "📲 Phát hiện iPhone đang kết nối. Đang tìm ứng dụng đích..."; \
		READDLE_ID=$$(ideviceinstaller list | grep "com.readdle.ReaddleDocs" | head -n 1 | cut -d, -f1 | tr -d ' '); \
		if [ "$$READDLE_ID" != "" ]; then \
			echo "📥 Đang copy vào ứng dụng Documents ($$READDLE_ID)..."; \
			afcclient --documents "$$READDLE_ID" put dist/ios/randomsutta.ipa /Documents/randomsutta.ipa || true; \
			echo "✅ Đã copy vào ứng dụng Documents thành công!"; \
			echo "📍 Vị trí: Mở app Documents -> 'My Files' -> Bạn sẽ thấy 'randomsutta.ipa'"; \
		else \
			echo "📥 Không thấy app Documents, đang thử copy vào chính app Random Sutta..."; \
			afcclient --documents com.randomsutta.app put dist/ios/randomsutta.ipa /Documents/randomsutta.ipa >/dev/null 2>&1 && \
			echo "✅ Đã copy vào app Random Sutta thành công!" || \
			(echo "⚠️ Không tìm thấy ứng dụng nào có quyền chia sẻ file. Hãy cài đặt app Documents của Readdle trước." && false); \
		fi \
	else \
		echo "❌ Không tìm thấy iPhone qua USB. Hãy cắm máy và thử lại."; \
		exit 1; \
	fi

# Mở dự án iOS bằng Xcode
open-ios:
	npx cap open ios

# Dọn dẹp build folder iOS
clean-ios:
	rm -rf ios/App/App/build ios/App/DerivedData

# ==============================================================================
# 🍏 MACOS / TAURI COMMANDS
# ==============================================================================

# Biên dịch ứng dụng MacOS bằng Tauri
macos:
	@echo "🍏 Đang biên dịch ứng dụng MacOS (Tauri)..."
	export PATH="$$HOME/.cargo/bin:$$PATH" && npx tauri build
	@echo "📦 Đang chép file cài đặt vào thư mục dist/macos..."
	@mkdir -p dist/macos
	@cp -R "src-tauri/target/release/bundle/macos/Random Sutta.app" dist/macos/
	@cp src-tauri/target/release/bundle/dmg/*.dmg dist/macos/
	@echo "✅ XONG! Ứng dụng MacOS của bạn nằm tại:"
	@echo "📍 dist/macos/Random Sutta.app"
	@echo "📍 dist/macos/"

# [NEW] Biên dịch ứng dụng MacOS chế độ DEBUG (Nhanh hơn để test)
macos-debug:
	@echo "🍏 Đang biên dịch ứng dụng MacOS (DEBUG)..."
	export PATH="$$HOME/.cargo/bin:$$PATH" && npx tauri build --debug --no-bundle
	@echo "📦 Đang chép file cài đặt vào thư mục dist/macos-debug..."
	@mkdir -p dist/macos-debug
	@cp -R "src-tauri/target/debug/bundle/macos/Random Sutta.app" dist/macos-debug/
	@echo "✅ XONG! Bản Debug nằm tại: dist/macos-debug/Random Sutta.app"

# Cài đặt ứng dụng vào /Applications và cập nhật Launch Services
app: macos
	@echo "🛑 Đang dừng các bản App đang chạy..."
	@pkill -fi "Random Sutta" || true
	@sleep 1
	@echo "🚚 Đang cài đặt ứng dụng vào /Applications..."
	@rm -rf "/Applications/Random Sutta.app"
	@cp -R "src-tauri/target/release/bundle/macos/Random Sutta.app" "/Applications/"
	@echo "🔄 Đang cập nhật Launch Services để nhận diện deep link..."
	@/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "/Applications/Random Sutta.app"
	@echo "✅ Đã cài đặt và đăng ký giao thức randomsutta:// thành công!"

# [NEW] Cài đặt bản DEBUG vào /Applications và tự động mở
app-debug: macos-debug
	@echo "🛑 Đang dừng các bản App đang chạy..."
	@pkill -fi "Random Sutta" || true
	@sleep 1
	@echo "🚚 Đang cài đặt bản DEBUG vào /Applications..."
	@rm -rf "/Applications/Random Sutta.app"
	@cp -R "src-tauri/target/debug/bundle/macos/Random Sutta.app" "/Applications/"
	@echo "🔄 Đang cập nhật Launch Services..."
	@/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "/Applications/Random Sutta.app"
	@echo "🚀 Đang khởi chạy ứng dụng..."
	@open -a "Random Sutta"
	@echo "✅ Đã cài đặt và khởi chạy bản DEBUG thành công!"

# [NEW] Tạo Alfred Workflow để tìm kiếm nhanh
alfred:
	@echo "🍎 Đang tạo Alfred Workflow..."
	$(PYTHON) -m src.alfred_workflow.workflow_builder
	@echo "✅ XONG! File cài đặt nằm tại: dist/alfred/RandomSutta.alfredworkflow"
