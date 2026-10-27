# Sổ Ngữ · Flashcard

Ứng dụng học từ vựng tiếng Anh chạy hoàn toàn trên trình duyệt: HTML/CSS/JS thuần, không cần cài đặt hay build.

🌐 Bản đang chạy: <https://flashcard.knowlytics.work>

## Tính năng

- **Nhiệm vụ hằng ngày (Tasks):** Focus, Phát âm, Nghe & chính tả, Điền từ vào câu và Viết đoạn văn. Có 3 chế độ: Quick, Standard và Deep. Làm theo thứ tự tuỳ thích.
- **Focus & Vườn hoa:** mỗi phiên Focus được thêm 1 bông hoa; hoàn thành đủ 5 nhiệm vụ được thêm 2 bông nhỏ.
- **Notes:** sổ từ vựng có ví dụ, bộ lọc nhiều lựa chọn và xoá hàng loạt.
- **Flashcard & Typing:** ôn từ theo thẻ hoặc gõ đáp án, có đọc phát âm.
- **Dịch nhanh:** nút dịch ở góc dưới bên phải, tách riêng nghĩa chính và nghĩa phụ.
- **Song ngữ:** giao diện có cả tiếng Việt và tiếng Anh.
- **Đồng bộ đám mây (tuỳ chọn):** dữ liệu từng người dùng được lưu qua Firebase Realtime Database.

## Cấu trúc thư mục

```
index.html              Khung HTML (header, các tab, bảng nổi) + nạp CSS/JS
css/
  base.css              Biến màu, header, tab, nút, form, bảng
  practice.css          Luyện gõ, Flashcard, trắc nghiệm, bộ lọc nhóm
  streak.css            Hiệu ứng chuỗi đúng & khiên
  sacred.css            Thử thách thiêng, nhãn CEFR
  components.css        Đăng nhập, mức ghi nhớ, Tập trung, vườn hoa…
  tasks.css             Tab Nhiệm vụ (5 nhiệm vụ mỗi ngày)
  tools.css             Lịch sử bài viết, Dịch nhanh, Tra dạng từ, nút nổi
  responsive.css        Máy tính bảng & điện thoại
js/
  core/                 Cấu hình, trạng thái, lưu trữ + đám mây, SRS, tiện ích
  i18n/                 vi.js, en.js (từ điển giao diện) + i18n.js (hàm t())
  services/             Phát âm/IPA, nhận dạng giọng nói, AI sửa văn phong
  tabs/                 Ghi chú, Luyện gõ, Flashcard, Tập trung
  tasks/                Nhiệm vụ: trạng thái, giao diện, Viết, lịch sử, sự kiện
  tools/                Dịch nhanh, Tra dạng từ, nút nổi
  features/             Thử thách thiêng, phân loại CEFR
  effects/              Hiệu ứng canvas: streak, khiên
  app/                  Điều hướng tab, đăng nhập, khởi động (main.js)
```

Các file JS là script thường (không phải module) và dùng chung phạm vi toàn cục, nên **thứ tự thẻ `<script>` trong `index.html` rất quan trọng**: file nạp sau được dùng hàm và biến của file nạp trước. Khi thêm file mới, hãy chèn vào đúng chỗ trong danh sách đó.

- Thêm/sửa chữ trên giao diện: sửa **cả** `js/i18n/vi.js` và `js/i18n/en.js` với cùng một khoá.
- Thêm ngôn ngữ mới: tạo `js/i18n/<mã>.js`, nạp trước `i18n.js`, rồi thêm vào object `I18N` trong `i18n.js`.

## Chạy trên máy

Mở trực tiếp `index.html`, hoặc chạy một server tĩnh để micro và nhận dạng giọng nói hoạt động ổn định hơn:

```bash
python3 -m http.server 8000
# rồi mở http://localhost:8000
```

> Chấm phát âm dùng Web Speech API của trình duyệt. Chrome và Edge hoạt động tốt nhất. Một số trình duyệt (Brave, Arc, Chromium) không có dịch vụ nhận dạng trên máy chủ, khi đó ứng dụng sẽ đề nghị dùng chế độ nhận dạng trên thiết bị nếu trình duyệt hỗ trợ.

## Đồng bộ đám mây

1. Tạo project tại [Firebase Console](https://console.firebase.google.com) và bật **Realtime Database**.
2. Dán URL database vào hằng số `CLOUD_URL` trong `js/core/config.js`. Để chuỗi rỗng `''` nếu chỉ muốn lưu trên trình duyệt.
3. **Đặt Rules cho database.** Đừng để ở chế độ test mode, vì như vậy ai biết URL cũng đọc và ghi được dữ liệu.

## Dịch vụ bên ngoài

- [LanguageTool](https://languagetool.org): kiểm tra chính tả và ngữ pháp trong nhiệm vụ Viết.
- Google Translate (endpoint công khai), với MyMemory làm phương án dự phòng: dùng cho tính năng dịch nhanh.
- Firebase Realtime Database: đồng bộ dữ liệu (tuỳ chọn).

## Triển khai

Repo có sẵn file `CNAME` để chạy trên **GitHub Pages** với tên miền riêng. Vào Settings → Pages → chọn nhánh `main` và thư mục `/ (root)`.
