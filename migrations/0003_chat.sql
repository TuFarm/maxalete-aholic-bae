-- Trò chuyện hai chiều + phiếu hẹn. Người gửi lấy từ phiên đăng nhập: admin = 'anh', viewer = 'em'.
--   text  = tin nhắn thường (body)
--   date  = phiếu hẹn: place (đi đâu), at (lúc nào, ms UTC), body (ghi chú, có thể rỗng), status
--   reply = sự kiện trả lời phiếu: ref_id trỏ tới phiếu, body = 'accepted' | 'declined' | 'rescheduled'
-- Trả lời phiếu vừa sửa status của phiếu vừa thêm một dòng reply, để bên kia poll theo id vẫn thấy thay đổi.
CREATE TABLE chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT NOT NULL CHECK (sender IN ('anh', 'em')),
  kind TEXT NOT NULL CHECK (kind IN ('text', 'date', 'reply')),
  body TEXT NOT NULL DEFAULT '',
  place TEXT,
  at INTEGER,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined', 'rescheduled')),
  ref_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_chats_upcoming ON chats (kind, status, at);

-- Tin cuối cùng mỗi người đã xem (để hiện "Đã xem")
CREATE TABLE chat_seen (
  who TEXT PRIMARY KEY CHECK (who IN ('anh', 'em')),
  last_id INTEGER NOT NULL DEFAULT 0
);
INSERT INTO chat_seen (who, last_id) VALUES ('anh', 0), ('em', 0);
