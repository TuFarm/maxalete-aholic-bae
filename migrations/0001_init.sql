-- Cài đặt chung (chỉ có 1 dòng, id = 1), lưu dạng JSON
CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Lời chúc / thư anh gửi cho em. Thời gian lưu bằng mili-giây UTC.
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '💌',
  show_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX idx_messages_show_at ON messages (show_at);

-- Các danh sách chỉnh sửa được:
--   sweet  = câu cổ vũ ({her}/{his} sẽ được thay bằng tên)
--   note   = lời nhắn trong "Hũ lời yêu"
--   preset = nhạc mẫu (text = tên hiển thị, meta = ID video hoặc link YouTube)
CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('sweet', 'note', 'preset')),
  text TEXT NOT NULL,
  meta TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_items_kind ON items (kind, position);

INSERT INTO items (kind, text, position) VALUES
  ('sweet', 'Cố lên nè, {his} luôn ở đây cổ vũ {her} đó 💌', 0),
  ('sweet', 'Học xong {his} dẫn {her} đi ăn trà sữa nha 🧋', 1),
  ('sweet', '{her} giỏi lắm luôn, từng chút một là tới đích thôi 🌷', 2),
  ('sweet', 'Mệt thì nghỉ chút, {his} thương {her} nhiều 💗', 3),
  ('sweet', 'Hôm nay {her} cũng thật đáng yêu ✨', 4),
  ('sweet', 'Mỗi phiên học là một bước gần hơn tới ước mơ đó 🌈', 5),
  ('sweet', 'Uống nước đầy đủ để da đẹp, đầu óc tỉnh táo nha 💧', 6),
  ('sweet', '{his} tự hào về {her} lắm luôn 🥰', 7),
  ('sweet', 'Không cần hoàn hảo, chỉ cần chăm chỉ mỗi ngày thôi 🍀', 8),
  ('sweet', 'Thả tim cho cô gái chăm chỉ nhất của {his} 💕', 9);

INSERT INTO items (kind, text, position) VALUES
  ('note', 'Phiếu ôm 1 cái thật chặt 🤗 (có hiệu lực vĩnh viễn)', 0),
  ('note', 'Phiếu được {his} chở đi ăn món {her} thích nhất 🍜', 1),
  ('note', '{his} nợ {her} một ly trà sữa full topping 🧋', 2),
  ('note', 'Hôm nay {her} là người dễ thương nhất thế giới 🌍💗', 3),
  ('note', 'Phiếu được giận dỗi 5 phút mà {his} vẫn dỗ 🥺', 4),
  ('note', 'Nhớ ăn uống đủ bữa nha, {his} sẽ kiểm tra đó 🍱', 5),
  ('note', 'Phiếu xem phim cùng nhau, {her} chọn phim 🎬', 6),
  ('note', 'Cảm ơn {her} vì đã xuất hiện trong đời {his} 🌷', 7),
  ('note', 'Phiếu đổi lấy một bức thư tay của {his} ✉️', 8),
  ('note', 'Thi xong mình đi chơi một chuyến thật xa nha 🚌', 9);

INSERT INTO items (kind, text, meta, position) VALUES
  ('preset', '☁️ 4 A.M Study', 'TURbeWK2wwg', 0),
  ('preset', '🌙 1 A.M Study', 'lTRiuFIWV54', 1),
  ('preset', '🎹 Piano học bài', 'HSOtku1j600', 2),
  ('preset', '🌧️ Tiếng mưa', 'mPZkdNFkNps', 3),
  ('preset', '🌊 Piano & tiếng nước', '77ZozI0rw7w', 4);
