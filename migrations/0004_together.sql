-- Học cùng nhau: hai tài khoản song song (admin = 'anh', viewer = 'em').
-- Chỉ THÊM bảng/cột, không dựng lại bảng cũ, để dữ liệu thật an toàn.

-- Cài đặt riêng của mỗi người (Pomodoro, lời nhắc, chuông). Tên gọi + chatHello vẫn nằm ở bảng settings chung.
CREATE TABLE user_settings (
  who TEXT PRIMARY KEY CHECK (who IN ('anh', 'em')),
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
-- Em giữ nguyên cài đặt cũ; anh bắt đầu từ mặc định
INSERT INTO user_settings (who, data, updated_at)
  SELECT 'em', data, updated_at FROM settings WHERE id = 1;

-- Trạng thái trực tiếp của mỗi người (đồng hồ, số liệu hôm nay, lần nhắc gần nhất), lưu JSON.
-- updated_at là giờ server, dùng để biết bên kia còn đang mở trang không.
CREATE TABLE presence (
  who TEXT PRIMARY KEY CHECK (who IN ('anh', 'em')),
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Kế hoạch học: day = ngày tạo (YYYY-MM-DD giờ Việt Nam). Việc chưa xong tự hiện tiếp ở các ngày sau.
CREATE TABLE plan_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  who TEXT NOT NULL CHECK (who IN ('anh', 'em')),
  day TEXT NOT NULL,
  text TEXT NOT NULL,
  done_at INTEGER,
  done_day TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_plan_who ON plan_items (who, done_day, day);

-- Tim cổ vũ gửi cho nhau
CREATE TABLE cheers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT NOT NULL CHECK (sender IN ('anh', 'em')),
  created_at INTEGER NOT NULL
);

-- Thư hai chiều: thư cũ đều là anh gửi
ALTER TABLE messages ADD COLUMN sender TEXT NOT NULL DEFAULT 'anh';

-- Câu cổ vũ / hũ lời yêu do ai viết (người kia sẽ đọc). Nội dung cũ là của anh.
ALTER TABLE items ADD COLUMN author TEXT NOT NULL DEFAULT 'anh';
