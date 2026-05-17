# Báo cáo Phân tích: Quy luật Phân tách Bilara của SuttaCentral cho Hán văn (Lzh)

Tài liệu này trình bày phân tích chuyên sâu về mối quan hệ giữa định dạng HTML di sản (`html_text`) và định dạng phân đoạn (`bilara`) của SuttaCentral, dựa trên dữ liệu đối sánh của Trung A-hàm (MA 1). Báo cáo này đã khắc phục các thiếu sót trong phân tích trước đó (đặc biệt là vấn đề xử lý thẻ tham chiếu Taisho).

## 1. Cấu trúc File (Mô hình Bilara)

Một file `html_text` duy nhất (ví dụ: `ma1.html`) được SuttaCentral tách thành 3 (hoặc 4) file độc lập trong hệ thống Bilara:

1.  **Văn bản gốc (Root):** `root/lzh/sct/.../ma1_root-lzh-sct.json` - Chứa văn bản thuần túy đã được làm sạch và phân câu.
2.  **Khung hiển thị (HTML):** `html/lzh/sct/.../ma1_html.json` - Chứa các thẻ HTML định dạng với placeholder `{}`.
3.  **Tham chiếu (Reference):** `reference/lzh/sct/.../ma1_reference.json` - Chứa các mốc tham chiếu (vd: số trang/cột/dòng của Đại Chính Tân Tu - Taisho).
4.  **(Tùy chọn) Biến thể (Variant):** `variant/lzh/sct/.../ma1_variant-lzh-sct.json` - Chứa các ghi chú về khác biệt văn bản (thường lấy từ CBETA apparatus).

## 2. Quy luật Phân tách (Segmentation Logic)

### 2.1 Định dạng ID (Segment ID)
*   **Cú pháp:** `[uid]:[đoạn].[câu]` (ví dụ: `ma1:1.1`, `ma1:1.2`).
*   **Metadata:** Các segment `0.x` (như `0.1`, `0.2`) được dành riêng cho tiêu đề (Title) và phân mục (Division).

### 2.2 Xử lý Metadata & Khối thông tin (Header/Suttainfo)
*   Khối `<header class='mirror'>`: SuttaCentral lấy phần text tiếng Trung ở đây để làm segment `0.1` và `0.2`, bỏ qua phần tiếng Anh và Latin.
*   Khối `<div class='suttainfo'>`: **Bị loại bỏ hoàn toàn.** Các thông tin về quyển (juan), người dịch, người ghi chép, và thậm chí cả các bài kệ tóm tắt (uddana) nằm trong thẻ này đều không được đưa vào Bilara root text.

### 2.3 Xử lý Nội dung (Body Text) & Tách câu
*   Mỗi thẻ khối (block-level tags) như `<p>`, `<blockquote>`, `<h2>` (trong nội dung) được xem là một "Đoạn" (Paragraph).
*   Đoạn được tách thành các "Câu" (Sentence) dựa trên dấu câu tiếng Trung: Dấu chấm `。`, dấu hai chấm `：`, dấu hỏi `？`, dấu chấm than `！`.
*   Các dấu ngoặc kép `「` và `」` được giữ nguyên trong text và không phải là điểm cắt câu chính nếu không đi kèm dấu kết thúc.

### 2.4 Xử lý Tham chiếu (Taisho References)
*   Trong `html_text`, tham chiếu Taisho nằm dạng thẻ: `<a class='ref t' id='t0421a14' href='#t0421a14'>T 0421a14</a>`.
*   SuttaCentral **xóa hoàn toàn thẻ này khỏi Root Text** để văn bản được liền mạch.
*   Thay vào đó, ID của thẻ (`t0421a14`) được trích xuất và biến đổi thành định dạng `t{số_volume}.{id}` (ví dụ: `t26.421a14` vì MA thuộc Volume 26).
*   Giá trị này được lưu vào `ma1_reference.json` và map (gắn) với Segment ID chứa thẻ đó (ví dụ: `"ma1:1.2": "t26.421a14"`).
*   Nếu một segment có nhiều thẻ, chúng được nối bằng dấu phẩy. Nếu segment không có thẻ nào, nó không xuất hiện trong file reference.

### 2.5 Biến đổi Văn bản & Biến thể (Variants)
*   Văn bản trong Bilara Root của SuttaCentral đôi khi có khác biệt nhỏ so với `html_text` (ví dụ: `html_text` ghi `說是義`, nhưng `root` ghi `説義。`).
*   Lý do là SuttaCentral đã hiệu đính root text dựa trên CBETA và lưu ghi chú vào file `variant` (`義 → 是義 (大, cbeta)`).

---

## 3. Kế hoạch Triển khai (Batch Conversion `bilara_more`)

Vì chúng ta không có nguồn dữ liệu CBETA gốc như SuttaCentral để tạo file `variant`, mục tiêu của `bilara_more` là phân tách **trung thành 100%** với nội dung đang có trong `html_text`, đồng thời tuân thủ chuẩn cấu trúc Bilara (Root, HTML, Reference).

### Giai đoạn 1: Xây dựng Bộ chuyển đổi (Python Engine)
Tạo script `src/sutta_processor/legacy_converter.py` với 3 module:
1.  **HTML Parser & Cleaner:**
    *   Dùng `BeautifulSoup4`.
    *   Trích xuất tiêu đề từ `<header class='mirror'>`.
    *   (Tùy chọn) Quyết định giữ hay bỏ `<div class='suttainfo'>`. Đề xuất: Dù SC bỏ, nhưng để bảo toàn dữ liệu (đặc biệt là uddana), ta nên gom khối này thành segment `0.3` hoặc `0.x` thay vì xóa đi.
2.  **Segmenter & Reference Extractor:**
    *   Duyệt qua các thẻ `<p>`, `<blockquote>`. Tách câu bằng regex `[。：？！]`.
    *   Khi gặp thẻ `<a class='ref t' id='...'>`, trích xuất `id`, ghép với `vol_num` tương ứng của bộ kinh (cấu hình qua dictionary: MA->26, SA->2...), và đưa vào danh sách reference mapping.
    *   Làm sạch text bằng cách xóa thẻ HTML nhưng giữ nguyên text bên trong.
3.  **Template Generator:**
    *   Sau khi trích text, thay thế nội dung các thẻ HTML gốc bằng `{}` để tạo file `_html.json`.

### Giai đoạn 2: Quy trình Thực thi (Pipeline)
1.  **Quét & Lọc (Discovery):** Scan toàn bộ `data/html_text/lzh`. Đối chiếu với `data/bilara/root/lzh` (cả những file bạn vừa fetch). **Chỉ chuyển đổi những file chưa tồn tại trong bilara chuẩn của SC.**
2.  **Xử lý hàng loạt (Batch Processing):** Chạy parser cho các file cần thiết.
3.  **Xuất file (Output):** Lưu kết quả vào thư mục mới để dễ phân biệt:
    ```
    data/bilara_more/
    ├── root/lzh/...      (Văn bản đã phân câu)
    ├── html/lzh/...      (Template giao diện)
    └── reference/lzh/... (Tham chiếu Taisho t26.xxxx)
    ```

Kế hoạch này đảm bảo tính tương thích với hệ thống hiển thị (đang thiết kế theo chuẩn Bilara), không làm mất dữ liệu tham chiếu (Taisho), và tránh được việc trùng lặp công việc mà SuttaCentral đã làm.