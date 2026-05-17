# Kế Hoạch Tích Hợp Parallels (Kinh Tương Đương)

## 1. Mục Tiêu
Cung cấp khả năng tra cứu các bản kinh tương đương (parallels) cho một bài kinh đang được đọc. Ví dụ: Đang đọc `mn1`, có thể biết được các bản `ma10`, `ea12.1`, v.v... là các bản kinh tương đương.

## 2. Đánh Giá Giải Pháp
Giải pháp phân tích từ `suttadb` hoàn toàn đáp ứng được nhu cầu này. Thay vì lưu trữ phức tạp theo từng phân đoạn (segment) và xuất ra nhiều file JSON rời rạc (cách suttadb làm cho file tĩnh), chúng ta sẽ tối ưu bằng cách lưu trực tiếp các liên kết này vào cơ sở dữ liệu SQLite điều phối chính (`sutta_core.db`). 

Việc lưu vào DB dưới dạng Relational Table cho phép truy vấn cực nhanh (chỉ bằng một lệnh `SELECT` dựa trên `src_uid`), phù hợp với kiến trúc "Vertical Sharded Architecture" của dự án hiện tại.

## 3. Kiến Trúc Cơ Sở Dữ Liệu
Sẽ bổ sung thêm một bảng `parallels` vào `sutta_core.db`. Thay vì lưu trữ Cartesian Product gây phình to database, ta gom nhóm các UID dưới dạng JSON.

```sql
CREATE TABLE IF NOT EXISTS parallels (
    src_uid TEXT PRIMARY KEY,
    relations TEXT NOT NULL      -- Chuỗi JSON: {"parallels": ["ma10"], "resembles": ["t56"]}
);
```
*Lưu ý:* Lưu liên kết hai chiều nhưng gom nhóm theo JSON. Các key trong JSON được sắp xếp theo thứ tự: `parallels`, `resembles`, `mentions`, `retells` để dễ dàng duyệt trên UI. Điều này giúp frontend chỉ cần lấy một dòng duy nhất dựa theo `src_uid` và parse JSON để render.

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
  - Sử dụng thuật toán tổ hợp chập 2 (`itertools.combinations`) để tạo các cặp liên kết, sau đó gom nhóm vào một cấu trúc `dict` với các key được sắp xếp: `parallels`, `resembles`, `mentions`, `retells`.

### Bước 3: Database Generation (Lưu vào SQLite)
- **Công cụ:** `SqliteGenerator` (`src/sutta_processor/output/sqlite_generator.py`)
- **Nhiệm vụ:**
  - Bổ sung định nghĩa bảng `parallels` vào `_init_core_db`.
  - Bổ sung phương thức `insert_parallels(parallels_dict)` để chạy `INSERT OR REPLACE` JSON string vào `sutta_core.db`.
  - Gọi phương thức này ở cuối tiến trình build trong `BuildManager`.

## 5. UI/UX (Hỗ trợ Frontend)
* (Phase sau) Frontend truy vấn: `SELECT relations FROM parallels WHERE src_uid = 'mn1'`.
* Sau khi parse JSON lấy được các `target_uid`, có thể lấy thêm tiêu đề từ bộ nhớ (bằng cách lấy qua class DBQuery) và tạo giao diện tab để render cho người dùng lựa chọn.
