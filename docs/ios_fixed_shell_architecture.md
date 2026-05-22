# Kiến trúc "Fixed Shell" giải quyết lỗi Viewport trên iOS (WKWebView)

Tài liệu này ghi lại giải pháp kiến trúc để khắc phục triệt để lỗi các phần tử `position: fixed` bị xê dịch, giật (jitter) hoặc trôi khi bàn phím ảo (virtual keyboard) xuất hiện trên iOS (Capacitor/WKWebView).

## 1. Vấn đề (The Problem)

Trên iOS Safari và WKWebView, cơ chế "Visual Viewport" và "Layout Viewport" thường xuyên gây ra các vấn đề nghiêm trọng cho Single Page Apps (PWA/Hybrid):
- **Keyboard Viewport Glitch:** Khi bàn phím hiện lên, hệ điều hành đẩy toàn bộ Viewport lên trên để giữ input trong tầm mắt, nhưng thường làm sai lệch tọa độ của các phần tử `fixed` (Toolbar, Settings). Sau khi đóng bàn phím, UI thường không trở về vị trí cũ (bị hở chân trang).
- **Dynamic Toolbar Shifting:** Thanh địa chỉ của Safari (URL bar) thay đổi kích thước khi cuộn trang, làm giá trị `100vh` thay đổi liên tục, gây ra hiện tượng nhảy UI.
- **Stacking Context & Filter:** Việc sử dụng `filter` (cho Sepia) trên thẻ `html` hoặc `body` có thể làm mất tác dụng của `position: fixed` bên trong nó.

## 2. Giải pháp: Kiến trúc Fixed Shell (The Solution)

Thay vì cố gắng tính toán tọa độ bù trừ bằng JavaScript (vốn không ổn định và gây giật), chúng ta sử dụng kiến trúc khóa cứng lớp vỏ ngoài cùng.

### 2.1. Khóa cứng HTML (Locking the HTML)
Thẻ `html` được thiết lập làm "Shell" cố định, không bao giờ cuộn và chiếm trọn màn hình:
```css
/* Path: web/assets/css/base/_reset.css */
html {
  height: 100dvh;
  width: 100%;
  overflow: hidden; /* Ngăn cuộn ở mức độ trình duyệt */
  position: fixed; /* Khóa cứng Shell vào Viewport */
  -webkit-text-size-adjust: 100%;
}
```
Việc này biến `html` thành một nền tảng tĩnh 100%. Bất kỳ lỗi xê dịch Viewport nào từ hệ điều hành sẽ bị giới hạn bởi thuộc tính `fixed` này.

### 2.2. Body và Container nội bộ
`body` và các View chính (`#reader-view`, `#landing-view`) đóng vai trò là container chứa nội dung và quản lý việc cuộn:
```css
body {
  height: 100%;
  width: 100%;
  overflow: hidden;
}

#landing-view, #reader-view {
  position: absolute;
  inset: 0;
  overflow-y: auto; /* Chỉ cho phép cuộn bên trong View */
  -webkit-overflow-scrolling: touch; /* Đảm bảo hiệu ứng cuộn mượt mà trên iOS */
}
```

### 2.3. Khóa Safe Area Bottom (UIUtils)
Để tránh chân trang bị đẩy lên khi URL bar hoặc Keyboard xuất hiện/biến mất, chúng ta sử dụng JavaScript để khóa giá trị `safe-area-inset-bottom` vào một biến CSS ngay khi khởi động:
```javascript
// web/assets/modules/utils/ui_utils.js
const computed = window.getComputedStyle(div).paddingBottom;
const safeAreaPx = parseInt(computed) || 0;
document.documentElement.style.setProperty('--safe-bottom', `${safeAreaPx}px`);
```
Biến `--safe-bottom` này được dùng để tính toán `padding-bottom` cố định cho các view, đảm bảo không có sự thay đổi đột ngột khi cuộn.

### 2.4. Xử lý Sepia bằng Overlay riêng
Thay vì áp dụng `filter` lên toàn bộ `body` (gây lag và hỏng `fixed positioning`), chúng ta sử dụng một lớp overlay riêng biệt:
```css
#sepia-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10000;
  background-color: #704214;
  opacity: var(--sepia-overlay-opacity, 0);
}
```

## 3. Kết quả (The Benefits)
- **Ổn định tuyệt đối:** Các thành phần như Toolbar, Settings Drawer luôn nằm đúng vị trí, không bị "bay" khỏi màn hình khi bàn phím bật/tắt.
- **Không có Jitter:** Việc cuộn trang diễn ra mượt mà vì nó là cuộn nội bộ (internal scroll), không gây ra các sự kiện thay đổi kích thước Viewport của trình duyệt.
- **Tiết kiệm tài nguyên:** Loại bỏ hoàn toàn các listener `window.onscroll` và `window.onresize` phức tạp để sửa lỗi UI.

## 4. Lưu ý cho Nhà phát triển
1. **Không sử dụng `window.scrollTo`:** Hãy sử dụng `document.getElementById('reader-view').scrollTo()` hoặc các hàm tương đương trên scroller container.
2. **Tọa độ phần tử:** Khi dùng `getBoundingClientRect()`, hãy nhớ rằng tọa độ này là tương đối so với Viewport tĩnh. Nếu cần tọa độ trong tài liệu, phải cộng thêm `container.scrollTop`.
3. **Z-Index:** Các phần tử fixed cần được quản lý Z-Index cẩn thận vì giờ đây chúng đều nằm trong một Shell tĩnh.
