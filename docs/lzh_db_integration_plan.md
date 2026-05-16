# Báo cáo: Kế hoạch Tích hợp Dữ liệu Hán văn (Lzh) vào Sutta DB

Tài liệu này phác thảo kế hoạch hoàn chỉnh và tối ưu nhất để tích hợp dữ liệu Hán văn (Lzh) từ hai nguồn: bản do SuttaCentral hiệu đính (`data/bilara`) và bản tự phân tách từ HTML Legacy (`data/bilara_more`) vào hệ thống cơ sở dữ liệu SQLite của ứng dụng.

## 1. Các Vấn đề Đã Giải Quyết

*   **Refactor `data/json`:** Việc gom metadata của `pli` vào thư mục con không ảnh hưởng đến tiến trình build, do `metadata_parser.py` sử dụng lệnh quét đệ quy (`rglob`).
*   **Tính toán Điều hướng (Next/Prev):** 
    *   *Vấn đề:* Hệ thống cần sơ đồ cây (Tree) để tính toán nút Next/Prev.
    *   *Giải quyết:* Đã khắc phục lỗi của script Fetcher để tải về trọn bộ 178 file cấu trúc cây của SuttaCentral (bao gồm `ma-tree.json`, `sa-tree.json`...).
    *   *Kết quả:* Module `tree_loader.py` tự động nhận diện và tính toán chuẩn xác điều hướng cho toàn bộ kinh Hán văn mà không cần lập trình thêm logic tạo cây ảo.

---

## 2. Kế hoạch Triển khai Thực tế (Chỉ 3 Bước)

Hệ thống Core Backend (Logic & Output) đã sẵn sàng. Công việc còn lại chỉ tập trung vào khâu "Nạp dữ liệu" (Ingestion) và "Cấu hình" (Config).

### Bước 1: Mở rộng Cấu hình Nguồn Dữ liệu (`src/sutta_processor/shared/app_config.py`)
Tiến trình build hiện tại đang "hardcode" đường dẫn cứng tới các thư mục Pali (`root/pli/ms`). Cần chuyển đổi các hằng số này thành danh sách mảng (List) để hệ thống quét đa nguồn.
*   **Đề xuất:**
    *   `RAW_ROOT_DIRS = [RAW_BILARA_DIR / "root/pli/ms", BILARA_MORE_DIR / "root/lzh", RAW_BILARA_DIR / "root/lzh/sct"]`
    *   Áp dụng mô hình mảng tương tự cho các thư mục `html`, `translation`, `reference`, `variant`.
*   Cập nhật `CONFIG_PRIMARY_BOOKS` để khai báo thêm các danh mục Hán văn chính (như `sa`, `ma`, `ea`, `da`).

### Bước 2: Nâng cấp File Crawler & Chiến lược Ghi Đè (`src/sutta_processor/ingestion/file_crawler.py`)
File crawler chịu trách nhiệm lập chỉ mục (index) toàn bộ file văn bản trước khi build. Cần viết lại hàm `_build_file_indices()` để quét qua danh sách `RAW_ROOT_DIRS` (thay vì một đường dẫn duy nhất).

**Chiến lược Ưu tiên (Override Strategy):**
Trình tự các đường dẫn trong cấu hình `RAW_ROOT_DIRS` sẽ quyết định quyền ưu tiên. 
1. Crawler quét thư mục `bilara_more` (bản Hán văn Legacy) trước và lưu vào dictionary chỉ mục.
2. Crawler quét tiếp thư mục `bilara/root/lzh/sct` (Bản Hán văn đã được SuttaCentral hiệu đính).
3. Nếu phát hiện UID trùng lặp (ví dụ cả hai bên đều có `ma1`), đường dẫn file của SuttaCentral sẽ ghi đè (overwrite) lên đường dẫn của `bilara_more`.
*Tác dụng:* Đảm bảo phủ kín 100% dữ liệu (bằng bản Legacy) nhưng luôn ưu tiên hiển thị bản chất lượng cao nhất (bản đã sửa lỗi của SuttaCentral).

### Bước 3: Đưa "Reference" (Taisho) vào Database (`src/sutta_processor/output/sqlite_generator.py`)
*   Khác với Pali, hệ Hán văn đặc biệt phụ thuộc vào số hiệu trang/cột của bộ Đại Chính Tân Tu (Taisho Reference, vd: `t99.2b05`).
*   Cần kiểm tra `sqlite_generator.py` để đảm bảo khi tạo bảng content (hoặc khi dump payload JSON), trường dữ liệu từ file `_reference.json` được đưa vào cơ sở dữ liệu `sutta_content_{category}.db` một cách nguyên vẹn, phục vụ cho việc hiển thị trên UI sau này.

---
**Tổng kết:** Với sự thay đổi này, hệ thống sẽ linh hoạt hơn rất nhiều, có thể nạp không giới hạn các kho dữ liệu mới trong tương lai mà không cần sửa đổi kiến trúc lõi.