# Kiến trúc "Fixed Shell" giải quyết lỗi Fixed Positioning trên iOS

Tài liệu này ghi lại giải pháp kiến trúc để khắc phục triệt để lỗi các phần tử `position: fixed` bị xê dịch hoặc trôi khi cuộn trang (scrolling) và khi bàn phím (virtual keyboard) xuất hiện trên iOS Safari.

## 1. Vấn đề (The Problem)

Trên iOS Safari, các thành phần `position: fixed` thường xuyên gặp lỗi:
- **Jitter/Drift:** Khi cuộn trang, các phần tử cố định bị rung lắc hoặc trôi khỏi vị trí chuẩn.
- **Keyboard Viewport Glitch:** Khi bàn phím hiện lên, trình duyệt thay đổi "Visual Viewport" nhưng không cập nhật chính xác tọa độ cho các phần tử `fixed` được neo vào "Layout Viewport". Sau khi đóng bàn phím, sự sai lệch này thường trở thành vĩnh viễn cho đến khi tải lại trang.
- **Stacking Context Conflict:** Các thuộc tính như `filter` (dùng cho Sepia) hoặc `transform` trên các container cha tạo ra ngữ cảnh hiển thị mới, làm hỏng khả năng neo vào màn hình của `position: fixed`.

## 2. Giải pháp: Kiến trúc Fixed Shell (The Solution)

Thay vì cố gắng sửa lỗi bằng JavaScript (vốn thường gây giật và không ổn định), chúng ta thay đổi cấu trúc cơ bản của ứng dụng:

### 2.1. Khóa cứng Lớp vỏ (Locking the Body)
Thẻ `html` và `body` được thiết lập để không bao giờ cuộn và luôn cố định:
```css
html, body {
  height: 100dvh;
  width: 100%;
  overflow: hidden; /* Ngăn cuộn ở mức độ body */
  position: fixed; /* Khóa cứng body vào viewport */
}
```
Việc này biến `body` thành một nền tảng tĩnh 100%, đảm bảo các phần tử con sử dụng `position: fixed` sẽ luôn được tính toán tọa độ dựa trên một khung tham chiếu không bao giờ thay đổi.

### 2.2. Cuộn nội bộ (Internal Scrolling)
Mọi nội dung cần cuộn (kinh văn, danh sách) được đưa vào các container nội bộ:
```css
#reader-view, #landing-view {
  position: absolute;
  inset: 0;
  overflow-y: auto; /* Chỉ cuộn bên trong container này */
  -webkit-overflow-scrolling: touch;
}
```
Lúc này, sự kiện cuộn (scroll event) chỉ xảy ra bên trong container, không tác động đến `window` hay `body`.

### 2.3. Điều chỉnh Scroller Utility
Toàn bộ logic cuộn trong JavaScript (như nhảy đến đoạn kinh, lưu vị trí đọc) được cập nhật để tác động vào `container.scrollTop` thay vì `window.scrollTo`.

### 2.4. Xử lý Bàn phím bằng Visual Viewport API
Để tránh UI bị bàn phím che mất, chúng ta sử dụng `window.visualViewport` để tính toán khoảng không gian bàn phím chiếm dụng và đẩy các phần tử UI lên tương ứng:
```javascript
const handleViewportChange = () => {
    const offset = window.innerHeight - window.visualViewport.height;
    fixedElement.style.bottom = `${offset}px`;
};
```

## 3. Ưu điểm
- **Ổn định tuyệt đối:** Các nút bấm và Toolbar không bao giờ bị xê dịch khi cuộn trang.
- **Snappy UI:** Cảm giác ứng dụng mượt mà như Native App vì không có độ trễ của các script ổn định Viewport.
- **Tương thích cao:** Giải quyết được xung đột với `filter` (Sepia) và các hiệu ứng phức tạp khác.

## 4. Lưu ý khi bảo trì
- Không bao giờ cho phép `body` cuộn trở lại.
- Luôn đảm bảo các popup mới được thêm vào phải được neo vào Shell (body) hoặc có cơ chế bù trừ tọa độ tương tự.
- Khi tính toán tọa độ phần tử (getBoundingClientRect), cần cộng thêm `container.scrollTop` thay vì `window.scrollY`.
