# 💗 Góc Học Của Bé

Web học tập dễ thương cho bạn gái. Có nhạc không lời, Pomodoro, nhắc uống nước và vận động, hộp thư nhận lời chúc, cùng góc giải trí.

**Stack (miễn phí 100%):** Cloudflare Workers (backend + phục vụ frontend) và Cloudflare D1 (database SQLite).
Toàn bộ chạy trên một nền tảng, deploy bằng một lệnh, server không bị "ngủ" như Render.
Gói free gồm 100.000 request/ngày. D1 cho 5 triệu lượt đọc và 100.000 lượt ghi mỗi ngày, cùng 5 GB lưu trữ. Một tab mở cả ngày chỉ dùng khoảng 2.000 request.

## Cấu trúc
```
public/              # Frontend (HTML/CSS/JS thuần)
  index.html         # Trang của em
  admin.html         # Trang quản trị của anh (/admin)
  login.html         # Trang đăng nhập dùng chung
  js/api.js          # gọi backend (cookie đăng nhập)
  js/mailbox.js      # hộp thư, 60 giây kiểm tra thư mới một lần
  js/admin.js        # gửi thư, xem đã đọc chưa, sửa cài đặt và nội dung
  ...
src/index.js         # Backend Worker: API /api/*
migrations/          # Schema database + dữ liệu mẫu
wrangler.toml        # Cấu hình Cloudflare
```

## Đăng nhập & bảo mật
- **Cả hai trang đều cần đăng nhập.** Chưa đăng nhập thì mọi trang, file JS và API đều bị chặn, chỉ còn trang `/login`.
  - `VIEWER_PASSWORD` (mật khẩu của em) vào được trang học. Phiên đăng nhập giữ 30 ngày.
  - `ADMIN_PASSWORD` (mật khẩu của anh) vào được `/admin` và cả trang của em. Phiên đăng nhập giữ 7 ngày.
- **Mỗi thư có mã PIN riêng.** Mã được tạo sẵn ngẫu nhiên 4 số, anh có thể sửa và thêm gợi ý.
  - Server không gửi nội dung thư cho trình duyệt trước khi mở đúng mã.
  - Mở khoá 1 lần là xem lại được mãi, kể cả trên máy khác.
  - Bỏ trống mã thì thư không khoá.
- **Chống dò mật khẩu:** sai quá 8 lần trong 15 phút (mỗi IP) thì bị chặn tạm thời. Đăng nhập và mã thư tính riêng.
- Đổi một trong hai mật khẩu sẽ đăng xuất mọi thiết bị.
- Nội dung thư luôn hiển thị dạng chữ thường, không chạy HTML.
- Đừng đưa `.dev.vars` lên GitHub (đã có trong `.gitignore`).

## Chạy trên máy (không cần tài khoản Cloudflare)
```bash
npm install
cp .dev.vars.example .dev.vars   # rồi đặt 2 mật khẩu trong .dev.vars
npm run db:local                 # tạo / cập nhật database local
npm run dev                      # mở http://localhost:8787
```
- Trang của em: `http://localhost:8787` (thêm `?fast` để test nhanh: 1 phút = 1 giây)
- Trang của anh: `http://localhost:8787/admin`

## Đưa lên mạng lần đầu (bằng dòng lệnh)
1. Đăng nhập Cloudflare (tạo tài khoản miễn phí nếu chưa có):
   ```bash
   npx wrangler login
   ```
2. Tạo database:
   ```bash
   npx wrangler d1 create goc-hoc-db
   ```
   Copy `database_id` nó in ra và dán vào `wrangler.toml` (thay chuỗi `00000000-...`).
3. Đặt 2 mật khẩu (nhập khi được hỏi, không ghi vào code). Nên dùng mật khẩu dài, khó đoán:
   ```bash
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put VIEWER_PASSWORD
   ```
   Nếu wrangler báo Worker chưa tồn tại thì làm bước 4 trước rồi quay lại đặt mật khẩu. Chưa đặt đủ 2 mật khẩu thì trang đăng nhập sẽ báo lỗi.
4. Deploy (lệnh này tự chạy migration database rồi mới deploy):
   ```bash
   npm run deploy
   ```
   Wrangler in ra link dạng `https://goc-cua-be.<tên-tài-khoản>.workers.dev` (hiện tại: `https://goc-cua-be.thuy-an.workers.dev`). Trang quản trị nằm ở `/admin`.

## Tự deploy khi push lên GitHub (giống Vercel/Netlify)
Cloudflare có **Workers Builds**: nối repo GitHub vào Worker, mỗi lần push lên nhánh `main` sẽ tự build và deploy.

1. Làm xong phần "Đưa lên mạng lần đầu" ở trên trước. Builds không đọc được `.dev.vars`, và nếu `database_id` vẫn là chuỗi giả thì lần build đầu sẽ lỗi. Secret đã đặt bằng `wrangler secret put` thì được giữ qua các lần deploy sau.
2. Tạo repo và push code (`.dev.vars`, `node_modules`, `.wrangler` đã nằm trong `.gitignore`):
   ```bash
   git init
   git add .
   git commit -m "Góc học của bé"
   git branch -M main
   git remote add origin https://github.com/<tài-khoản>/<repo>.git
   git push -u origin main
   ```
3. Vào Cloudflare Dashboard → **Workers & Pages** → chọn Worker `goc-cua-be` → **Settings** → **Builds** → **Connect**, rồi chọn repo GitHub.
4. Đặt **Deploy command** là `npm run deploy` để mỗi lần deploy đều tự áp dụng migration mới.
5. Từ giờ chỉ cần `git push`, Cloudflare tự lo phần còn lại.

Nếu build báo lỗi:
- Lỗi quyền ở bước migration: kiểm tra token của Builds có quyền sửa D1.
- Lỗi khác tên: tên Worker trên dashboard phải khớp với `name` trong `wrangler.toml`.

## Thông báo trên điện thoại
Thông báo hệ thống (khi em đang ở tab khác) chỉ chạy trên trình duyệt máy tính.
Trên điện thoại, lời nhắc và thư mới hiện thành popup kèm chuông khi đang mở trang.

## Thêm trò chơi mới
Mở `public/js/games.js` và thêm một phần tử vào mảng `GAMES` có hàm `play()`.
