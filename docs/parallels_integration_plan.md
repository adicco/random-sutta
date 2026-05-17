# Kế Hoạch Tích Hợp Parallels (Kinh Tương Đương)

## 1. Mục Tiêu
Cung cấp khả năng tra cứu các bản kinh tương đương (parallels) cho một bài kinh đang được đọc. Ví dụ: Đang đọc `mn1`, có thể biết được các bản `ma10`, `ea12.1`, v.v... là các bản kinh tương đương.

## 2. Đánh Giá Giải Pháp
Giải pháp phân tích từ `suttadb` hoàn toàn đáp ứng được nhu cầu này. Thay vì lưu trữ phức tạp theo từng phân đoạn (segment) và xuất ra nhiều file JSON rời rạc (cách suttadb làm cho file tĩnh), chúng ta sẽ tối ưu bằng cách lưu trực tiếp các liên kết này vào cơ sở dữ liệu SQLite điều phối chính (`sutta_core.db`). 

Việc lưu vào DB dưới dạng Relational Table cho phép truy vấn cực nhanh (chỉ bằng một lệnh `SELECT` dựa trên `src_uid`), phù hợp với kiến trúc "Vertical Sharded Architecture" của dự án hiện tại.

## 3. Kiến Trúc Cơ Sở Dữ Liệu
Sẽ bổ sung thêm một bảng `parallels` vào `sutta_core.db`.

```sql
CREATE TABLE IF NOT EXISTS parallels (
    src_uid TEXT NOT NULL,       -- UID gốc (vd: 'mn1')
    target_uid TEXT NOT NULL,    -- UID tương đương (vd: 'ma10')
    relation_type TEXT NOT NULL, -- Loại liên kết: 'parallels', 'resembles', 'mentions', 'retells'
    PRIMARY KEY (src_uid, target_uid, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_parallels_src ON parallels(src_uid);
```
*Lưu ý:* Lưu liên kết hai chiều. Nếu A parallel với B, ta lưu dòng (A, B, 'parallels') và (B, A, 'parallels'). Điều này giúp frontend chỉ cần filter theo `src_uid`.

## 4. Các Bước Triển Khai (Pipeline Ingestion)

### Bước 1: Data Fetching (Tải dữ liệu)
- **Công cụ:** `src.data_fetcher`
- **Nhiệm vụ:** Viết module `fetch_parallels` để tải trực tiếp file `parallels.json` từ kho `sc-data` của SuttaCentral (GitHub raw URL).
- **Lưu trữ:** Lưu vào thư mục `data/json/sc-data/parallels.json` (tương tự cách lưu metadata API).

### Bước 2: Ingestion & Parsing (Xử lý dữ liệu)
- **Công cụ:** `src.sutta_processor`
- **Nhiệm vụ:**
  - Viết module `parallels_parser.py` để đọc file `parallels.json`.
  - Phân tách (parse) các ID: loại bỏ dấu `~` (nếu có dấu `~` thì gán type là `resembles`), cắt bỏ phần segment ID (phần sau dấu `#`) để chỉ lấy cấp độ bài kinh (Sutta UID).
  - Sử dụng thuật toán tổ hợp chập 2 (`itertools.combinations`) để tạo các cặp (A, B) và (B, A) cho các ID trong cùng một mảng.

### Bước 3: Database Generation (Lưu vào SQLite)
- **Công cụ:** `SqliteGenerator` (`src/sutta_processor/output/sqlite_generator.py`)
- **Nhiệm vụ:**
  - Bổ sung định nghĩa bảng `parallels` vào `_init_core_db`.
  - Bổ sung phương thức `insert_parallels(parallels_list)` để chạy `INSERT OR IGNORE` hàng loạt các cặp liên kết này vào `sutta_core.db`.
  - Gọi phương thức này ở cuối tiến trình build trong `BuildManager`.

## 5. UI/UX (Hỗ trợ Frontend)
* (Phase sau) Frontend truy vấn: `SELECT target_uid, relation_type FROM parallels WHERE src_uid = 'mn1'`.
* Sau khi lấy danh sách `target_uid`, có thể JOIN với bảng `metadata` để lấy thêm tiêu đề (`translated_title`, `acronym`) hiển thị cho người dùng lựa chọn.
