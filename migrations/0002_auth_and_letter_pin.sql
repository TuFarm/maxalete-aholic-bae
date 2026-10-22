-- Mã PIN riêng cho từng thư: mở khoá 1 lần (unlocked_at) thì xem lại được mãi, trên mọi thiết bị
ALTER TABLE messages ADD COLUMN pin TEXT;
ALTER TABLE messages ADD COLUMN pin_hint TEXT;
ALTER TABLE messages ADD COLUMN unlocked_at INTEGER;

-- Ghi lại lần đăng nhập / nhập PIN sai để chặn dò mật khẩu
CREATE TABLE attempts (
  key TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX idx_attempts_key_at ON attempts (key, at);
