# Kế hoạch Triển khai Hiển thị Hán văn (Lzh) trên Frontend

Tài liệu này phác thảo các bước cần thiết để hiển thị kho tàng kinh điển Hán văn (Agamas, Vinaya, Abhidhamma) một cách chuyên nghiệp trên giao diện người dùng.

## 1. Mục tiêu Trải nghiệm Người dùng (UX)
*   **Hiển thị Đa ngữ:** Cho phép xem song song (hoặc chuyển đổi) giữa bản gốc Hán văn và bản dịch (ví dụ bản tiếng Anh của Patton).
*   **Tham chiếu Taisho:** Hiển thị các mốc trang/cột của Đại Chính Tân Tu (`T 01.421a`) ở lề hoặc dạng tooltip để phục vụ nghiên cứu.
*   **Tối ưu Font chữ:** Sử dụng font chữ Hán văn phù hợp, hỗ trợ tốt các chữ cổ/hiếm.
*   **Điều hướng thông minh:** Sử dụng dữ liệu `nav_prev`/`nav_next` đã tính toán để di chuyển mượt mà giữa các kinh Hán văn.

---

## 2. Các Thay đổi Kỹ thuật Cần thiết

### A. Tầng Dữ liệu (`web/assets/modules/services/db-service.js`)
*   **Hỗ trợ Sharding mới:** Cập nhật `DbService` để nó biết cách tải các file DB mới (`lzh_major.db`, `lzh_vinaya_dg.db`...) dựa trên thông tin trong `db_manifest.json`.
*   **Lazy Loading:** Đảm bảo hệ thống chỉ tải DB Hán văn khi người dùng thực sự truy cập vào một bài kinh Hán văn.

### B. Tầng Render (`web/assets/modules/ui/reader-view.js`)
*   **Nhận diện Ngôn ngữ gốc:** Sử dụng trường `root_lang` từ metadata để áp dụng CSS class tương ứng (ví dụ: `.lang-lzh`).
*   **Xử lý Reference:** 
    *   Hiện tại UI đang tập trung vào số đoạn Pali. Cần viết logic để render dữ liệu từ mảng `reference` trong DB thành các thẻ tag nhỏ xinh ở bên lề.
*   **Xử lý HTML Template:** Đảm bảo các placeholder `{}` trong Hán văn được lấp đầy chính xác bởi nội dung từ `root/lzh` hoặc `translation/en`.

### C. Giao diện (CSS & HTML)
*   **Typography:** Định nghĩa font-family ưu tiên cho tiếng Trung cổ (ví dụ: "Source Han Serif", "Noto Serif CJK TC").
*   **Layout:** Cấu hình lại `reader-view` để hỗ trợ hiển thị tốt các câu Hán văn vốn thường ngắn hơn nhưng súc tích hơn Pali.

---

## 3. Lộ trình Thực hiện (Milestones)

### Giai đoạn 1: Nền tảng (Database & Routing) - ✅ HOÀN THÀNH
1.  Cập nhật `DbService` (`sutta_db.js` & `sutta_repository.js`) để nạp 12 shard DB.
2.  Tích hợp trường `root_lang` vào toàn bộ quy trình từ DB đến UI.
3.  Fix bug nhận diện metadata cho dữ liệu `bilara_more`.

### Giai đoạn 2: Rendering (Hiển thị văn bản) - ✅ HOÀN THÀNH
1.  Nâng cấp `ContentCompiler` để hỗ trợ đa ngữ (Pali/Lzh).
2.  Triển khai tính năng **Display Mode** (Bilingual, Root Only, Trans Only) áp dụng cho cả Pali và Hán văn.
3.  Tích hợp font chữ Hán văn (Source Han Serif).
4.  Cơ chế tham chiếu Taisho (ẩn).

### Giai đoạn 3: Tối ưu hóa (Styling & Settings) - ⏳ ĐANG THỰC HIỆN
1.  Thêm nút gạt trong "Settings" để chuyển đổi Display Mode.
2.  Tinh chỉnh CSS cho Typography Hán văn.

---
**Hành động tiếp theo:** Tôi sẽ bắt đầu rà soát file `db-service.js` để đảm bảo nó nhận diện được 12 file DB hiện tại của chúng ta. Bạn có đồng ý với lộ trình này không?