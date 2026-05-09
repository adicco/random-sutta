# Giải quyết lỗi Jetsam Crash trên iOS khi sử dụng WebAssembly (wa-sqlite)

Tài liệu này ghi chép lại nguyên nhân và cách khắc phục tình trạng ứng dụng PWA (hoặc Web) bị trình duyệt Safari/Chrome trên iOS buộc đóng (crash) đột ngột do vi phạm giới hạn bộ nhớ (Jetsam Event), cụ thể là khi kết hợp WebAssembly với IndexedDB.

## 1. Dấu hiệu nhận biết bệnh (Symptoms)

- Ứng dụng PWA hoạt động bình thường trên Android, Windows, macOS, nhưng **luôn bị reload hoặc văng (crash) trên iPhone/iPad**.
- Lỗi thường xảy ra ngay lúc ứng dụng vừa khởi động hoặc khi cố gắng tải dữ liệu ban đầu.
- Khi sử dụng công cụ **Safari Web Inspector (Timelines)** để profiling:
  - **Memory (RAM)** không có dấu hiệu phình to đột biến do DOM hay JS.
  - Tuy nhiên, **CPU (Wasm Worklist Helper Thread)** bị khóa ở mức **~100% liên tục trong nhiều giây (thậm chí hàng chục giây)**.
  - Main Thread (Javascript/UI) lại gần như rảnh rỗi.

## 2. Nguyên nhân sâu xa: Asyncify Lock trong WebAssembly

Vấn đề bắt nguồn từ việc sử dụng các thư viện SQLite biên dịch sang WebAssembly (như `wa-sqlite`, `sql.js`) kết hợp với **hệ thống lưu trữ bất đồng bộ (Asynchronous VFS)** như IndexedDB (`IDBBatchAtomicVFS`).

1. **Bản chất của WebAssembly:** Wasm ban đầu được thiết kế để chạy các tác vụ đồng bộ (Synchronous). Nó không có khái niệm `async/await` bản địa như Javascript.
2. **Kỹ thuật Asyncify:** Để Wasm có thể gọi các API bất đồng bộ của trình duyệt (như đọc/ghi IndexedDB), người ta phải sử dụng một công cụ biên dịch gọi là "Asyncify".
3. **Cơ chế hoạt động của Asyncify:** Khi Wasm gọi một lệnh đọc IndexedDB, tiến trình Asyncify buộc phải:
   - Dừng (pause) toàn bộ trạng thái chạy của Wasm.
   - Trả quyền điều khiển về cho Javascript.
   - Chờ Javascript lấy dữ liệu từ IndexedDB bằng Promise.
   - Khôi phục (resume) lại trạng thái của Wasm để chạy tiếp.
4. **Vòng lặp tử thần (The Death Loop):** Khi bạn thực hiện một câu lệnh `SELECT` đọc toàn bộ một bảng (ví dụ: 1000 dòng), SQLite sẽ cố gắng lấy từng "block" dữ liệu nhỏ từ IndexedDB. Quá trình Dừng (pause) và Khôi phục (resume) của Asyncify diễn ra **hàng ngàn, thậm chí hàng chục ngàn lần liên tục**.
5. **Cú chốt Jetsam của iOS:** Việc chuyển đổi ngữ cảnh (Context Switching) điên cuồng này tạo ra một áp lực khổng lồ lên CPU và sinh ra vô số rác bộ nhớ (Garbage) ở tầng thấp. Hệ điều hành iOS cực kỳ khắt khe với tài nguyên. Khi thấy một thread (Wasm) đốt 100% CPU quá lâu và gây nguy hiểm cho hệ thống, cơ chế **Jetsam** của iOS sẽ thẳng tay "bắn bỏ" tiến trình trình duyệt đó, dẫn đến crash trang web.

## 3. Cách khắc phục (Resolution)

Tùy thuộc vào kích thước của file cơ sở dữ liệu, bạn cần chọn chiến lược tiếp cận phù hợp để né tránh Asyncify.

### Trường hợp 1: Database nhỏ (Dưới 5MB - 10MB) -> Dùng MemoryVFS

Đây là trường hợp phổ biến nhất cho các ứng dụng PWA đọc nội dung tĩnh. Nếu DB nhỏ, hãy **từ bỏ IndexedDB** và chuyển toàn bộ DB lên RAM.

**Giải pháp:**
1. Chuyển từ phiên bản wasm bất đồng bộ (`wa-sqlite-async.wasm`) sang phiên bản đồng bộ thuần túy (`wa-sqlite.wasm`).
2. Thay thế `IDBBatchAtomicVFS` bằng **`MemoryVFS`**.
3. **Chiến lược Caching:** Vì `MemoryVFS` bị xóa khi tắt app, bạn phải thiết lập **Service Worker (PWA)** để cache file `.db`. Khi app mở lên, nó sẽ fetch file `.db` từ Service Worker (siêu nhanh) và nạp thẳng vào `MemoryVFS`.

**Kết quả:** 
- Tốc độ truy vấn tính bằng micro-giây (vì chạy hoàn toàn trên RAM).
- Tránh được 100% chi phí của Asyncify. Không bao giờ còn lỗi 100% CPU.

### Giải pháp hiện tại của dự án: OPFSAnyContextVFS + Vertical Sharding

Dự án Random Sutta đã áp dụng thành công giải pháp kết hợp để triệt tiêu hoàn toàn lỗi Jetsam trên iOS:

1. **Sử dụng `OPFSAnyContextVFS`**: 
   - Thay vì `IndexedDB` (gây ra vòng lặp dừng/ngắt Asyncify), chúng ta sử dụng **Origin Private File System (OPFS)**. 
   - VFS này tận dụng `FileSystemSyncAccessHandle` trong một Worker riêng biệt để thực hiện các thao tác I/O đồng bộ. Điều này giúp SQLite-Wasm đọc/ghi dữ liệu trực tiếp với tốc độ gần như bản địa (native), loại bỏ hoàn toàn hiện tượng 100% CPU do chuyển đổi ngữ cảnh.

2. **Cấu trúc Vertical Sharding (Phân mảnh dọc)**:
   - Dữ liệu được chia nhỏ thành các tệp `.db` dưới 50MB. Việc mở nhiều tệp nhỏ giúp kiểm soát bộ nhớ tốt hơn việc mở một tệp khổng lồ hàng trăm MB.

3. **Cấu hình SQLite tối ưu (iOS Optimized PRAGMAs)**:
   Mỗi kết nối cơ sở dữ liệu đều được áp dụng các cấu hình "tiết kiệm" bộ nhớ nhưng vẫn đảm bảo tốc độ:
   - `PRAGMA cache_size = -5000`: Ép buộc mỗi DB chỉ được chiếm tối đa ~5MB RAM để làm cache. Với 4-5 shard đang mở, tổng RAM tiêu tốn cho SQLite chỉ khoảng 25MB, nằm dưới ngưỡng báo động của iOS.
   - `PRAGMA journal_mode = DELETE`: Giảm thiểu file phụ tạm thời, tiết kiệm I/O.
   - `PRAGMA mmap_size = 256MB`: Cho phép ánh xạ tệp vào bộ nhớ (Memory Mapping). Trên các thiết bị iOS hiện đại, điều này giúp việc đọc dữ liệu cực nhanh mà không làm tăng bộ nhớ "Dirty RAM" (loại RAM bị Jetsam theo dõi chặt chẽ nhất).
   - **JS Mutex Serialization**: Sử dụng cơ chế khóa (`withLock`) trong JavaScript để đảm bảo các thao tác mở/đóng/ghi DB diễn ra tuần tự, tránh việc nhiều luồng Wasm cùng lúc yêu cầu cấp phát bộ nhớ, dễ gây ra lỗi `out of bounds`.

## 4. Bài học rút ra cho mọi dự án Wasm

1. **Tránh Asyncify bằng mọi giá:** Bất cứ khi nào làm việc với WebAssembly, hãy cố gắng giữ mọi thứ đồng bộ (Synchronous). Việc gọi cầu nối Async/Await giữa JS và Wasm trong một vòng lặp (loop) là "tự sát" trên các thiết bị di động.
2. **IndexedDB không sinh ra cho SQLite:** IndexedDB bản chất là một Object Store, nó không phù hợp để làm hệ thống file ảo (VFS) cho SQLite vì việc phân mảnh và truy xuất block quá chậm. Luôn ưu tiên Memory hoặc OPFS.
3. **Luôn Test bằng Timelines/Profiler:** Nếu Web/PWA chạy chậm, đừng vội đoán mò do React/Vue/DOM. Hãy mở Inspector, nhìn vào biểu đồ CPU và xem luồng (Thread) nào đang đốt tài nguyên. Nếu là `Wasm Worklist Helper`, 99% vấn đề nằm ở giao tiếp I/O.
