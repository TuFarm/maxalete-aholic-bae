/* Backend Cloudflare Worker: chặn người chưa đăng nhập, phục vụ public/ và API /api/* với database D1.
   Bí mật (đặt bằng `wrangler secret put`, hoặc file .dev.vars khi chạy local):
     ADMIN_PASSWORD   mật khẩu của anh: vào /admin và cả trang của em
     VIEWER_PASSWORD  mật khẩu của em: vào trang học
   Đổi một trong hai mật khẩu sẽ đăng xuất mọi thiết bị. */

const DEFAULT_SETTINGS = {
  herName: 'Bé',
  hisName: 'Anh',
  focus: 25,
  short: 5,
  long: 15,
  longEvery: 4,
  autoStart: true,
  waterEvery: 30,
  waterMl: 200,
  waterGoal: 8,
  moveEvery: 30,
  eyeRest: true,
  eyeEvery: 20,
  sound: true,
  chatHello: 'Chưa có tin nhắn nào. Viết dòng đầu tiên nha ✏️',
};

// Kiểu và giới hạn hợp lệ của từng trường cài đặt
const SETTINGS_SCHEMA = {
  herName: { type: 'string', max: 20 },
  hisName: { type: 'string', max: 20 },
  focus: { type: 'int', min: 1, max: 120 },
  short: { type: 'int', min: 1, max: 60 },
  long: { type: 'int', min: 1, max: 60 },
  longEvery: { type: 'int', min: 2, max: 10 },
  autoStart: { type: 'bool' },
  waterEvery: { type: 'int', min: 10, max: 120 },
  waterMl: { type: 'int', min: 50, max: 1000 },
  waterGoal: { type: 'int', min: 1, max: 20 },
  moveEvery: { type: 'int', min: 15, max: 120 },
  eyeRest: { type: 'bool' },
  eyeEvery: { type: 'int', min: 10, max: 60 },
  sound: { type: 'bool' },
  chatHello: { type: 'string', max: 120 },
};

const ITEM_KINDS = ['sweet', 'note', 'preset'];
const MAX_MESSAGE = 2000;
const MAX_ITEMS = 100;
const SESSION_DAYS = { admin: 30, viewer: 30 };
// Tối đa 8 lần sai trong 15 phút cho mỗi IP (đăng nhập và PIN thư tính riêng)
const RATE = { max: 8, windowMs: 15 * 60 * 1000 };

// Trang/tệp xem được khi chưa đăng nhập. Asset tự đổi /login.html -> /login nên phải có cả hai dạng.
const PUBLIC_PATHS = new Set(['/login', '/login.html', '/css/style.css']);
const ADMIN_PATHS = new Set(['/admin', '/admin.html', '/js/admin.js']);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const enc = (s) => new TextEncoder().encode(s);

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});

const redirect = (location) => new Response(null, { status: 302, headers: { location, 'cache-control': 'no-store' } });

async function readJson(request) {
  try { return await request.json(); } catch { throw new HttpError(400, 'Dữ liệu gửi lên không hợp lệ'); }
}

// Chỉ cho phép chuyển hướng nội bộ (chặn //evil.com và /\evil.com)
function safeNext(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';
}

// So sánh bí mật trong thời gian không đổi để tránh dò theo thời gian phản hồi
async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc(a)), crypto.subtle.digest('SHA-256', enc(b))]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

// ---------- Phiên đăng nhập (cookie ký HMAC: role.hết_hạn.chữ_ký) ----------

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function hmacKey(env) {
  const raw = await crypto.subtle.digest('SHA-256', enc(`goc-hoc|${env.ADMIN_PASSWORD}|${env.VIEWER_PASSWORD}`));
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function sessionCookie(env, url, role) {
  const maxAge = SESSION_DAYS[role] * 86400;
  const payload = `${role}.${Date.now() + maxAge * 1000}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc(payload));
  return cookie(url, `${payload}.${b64url(sig)}`, maxAge);
}

function cookie(url, value, maxAge) {
  return `session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${url.protocol === 'https:' ? '; Secure' : ''}`;
}

// Cookie đọc được bằng JS để trang biết ngay mình là ai trước khi gọi API (tách dữ liệu trong máy theo người).
// Không phải ranh giới bảo mật: server luôn xác định người dùng từ cookie session.
function whoCookie(url, who, maxAge) {
  return `who=${who}; Path=/; SameSite=Lax; Max-Age=${maxAge}${url.protocol === 'https:' ? '; Secure' : ''}`;
}

async function getSession(request, env) {
  if (!env.ADMIN_PASSWORD || !env.VIEWER_PASSWORD) return null;
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)session=([^;]+)/);
  if (!m) return null;
  const [role, exp, sig] = m[1].split('.');
  if (!(role in SESSION_DAYS) || !(Number(exp) > Date.now()) || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), fromB64url(sig), enc(`${role}.${exp}`));
    return ok ? { role } : null;
  } catch { return null; }
}

function requireRole(session, role) {
  if (!session) throw new HttpError(401, 'Cần đăng nhập');
  if (role === 'admin' && session.role !== 'admin') throw new HttpError(403, 'Chỉ anh mới làm được việc này');
}

// ---------- Chống dò mật khẩu ----------

const clientIp = (request) => request.headers.get('cf-connecting-ip') || 'local';

// Kiểm tra trước khi ghi, để khi bị spam không tốn lượt ghi D1 (gói free bị chặn cứng khi vượt)
async function assertNotLimited(env, key) {
  const row = await env.DB.prepare('SELECT count(*) AS n FROM attempts WHERE key = ? AND at > ?')
    .bind(key, Date.now() - RATE.windowMs).first();
  if (row.n >= RATE.max) throw new HttpError(429, 'Nhập sai nhiều quá rồi, đợi 15 phút rồi thử lại nha');
}

async function recordFailure(env, key) {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO attempts (key, at) VALUES (?, ?)').bind(key, now),
    env.DB.prepare('DELETE FROM attempts WHERE at < ?').bind(now - 86400000),
  ]);
}

// ---------- Cài đặt & nội dung ----------

function validateSettings(input) {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'Cài đặt không hợp lệ');
  const out = {};
  for (const [key, rule] of Object.entries(SETTINGS_SCHEMA)) {
    if (!(key in input)) continue;
    const v = input[key];
    if (rule.type === 'bool') {
      if (typeof v !== 'boolean') throw new HttpError(400, `${key} phải là true/false`);
      out[key] = v;
    } else if (rule.type === 'int') {
      const n = Number(v);
      if (!Number.isInteger(n) || n < rule.min || n > rule.max) {
        throw new HttpError(400, `${key} phải từ ${rule.min} đến ${rule.max}`);
      }
      out[key] = n;
    } else {
      const s = String(v).trim();
      if (!s || s.length > rule.max) throw new HttpError(400, `${key} dài 1–${rule.max} ký tự`);
      out[key] = s;
    }
  }
  return out;
}

// Tên gọi và dòng chào chat là của chung; còn lại (Pomodoro, lời nhắc, chuông) mỗi người một bộ
const SHARED_KEYS = ['herName', 'hisName', 'chatHello'];
const pick = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => keys.includes(k)));
const omit = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

async function getSettings(env, who) {
  const [shared, mine] = await Promise.all([
    env.DB.prepare('SELECT data FROM settings WHERE id = 1').first(),
    env.DB.prepare('SELECT data FROM user_settings WHERE who = ?').bind(who).first(),
  ]);
  return {
    ...DEFAULT_SETTINGS,
    ...pick(shared ? JSON.parse(shared.data) : {}, SHARED_KEYS),
    ...omit(mine ? JSON.parse(mine.data) : {}, SHARED_KEYS),
  };
}

async function saveSettings(env, who, patch) {
  const clean = validateSettings(patch);
  const merged = { ...await getSettings(env, who), ...clean };
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO settings (id, data, updated_at) VALUES (1, ?1, ?2) ON CONFLICT(id) DO UPDATE SET data = ?1, updated_at = ?2',
    ).bind(JSON.stringify(pick(merged, SHARED_KEYS)), now),
    env.DB.prepare(
      'INSERT INTO user_settings (who, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(who) DO UPDATE SET data = ?2, updated_at = ?3',
    ).bind(who, JSON.stringify(omit(merged, SHARED_KEYS)), now),
  ]);
  return merged;
}

// items: thứ mình đọc (câu cổ vũ / hũ lời yêu do người kia viết, nhạc mẫu chung)
// written: câu mình viết cho người kia (để sửa)
async function getItems(env, who) {
  const { results } = await env.DB.prepare('SELECT kind, text, meta, author FROM items ORDER BY kind, position, id').all();
  const items = { sweet: [], note: [], preset: [] };
  const written = { sweet: [], note: [] };
  for (const r of results) {
    if (r.kind === 'preset') items.preset.push({ name: r.text, src: r.meta });
    else if (r.author === who) written[r.kind]?.push(r.text);
    else items[r.kind]?.push(r.text);
  }
  return { items, written };
}

// Nội dung anh sửa được ở /admin: câu anh viết + nhạc mẫu
async function adminItems(env) {
  const { items, written } = await getItems(env, 'anh');
  return { ...written, preset: items.preset };
}

async function replaceItems(env, kind, list, author) {
  if (!ITEM_KINDS.includes(kind)) throw new HttpError(404, 'Không có danh sách này');
  if (kind === 'preset' && author !== 'anh') throw new HttpError(403, 'Chỉ anh mới sửa nhạc mẫu');
  if (!Array.isArray(list) || list.length > MAX_ITEMS) throw new HttpError(400, `Tối đa ${MAX_ITEMS} dòng`);
  const rows = list.map((item) => {
    const text = String(kind === 'preset' ? item?.name : item).trim();
    const meta = kind === 'preset' ? String(item?.src ?? '').trim() : null;
    if (!text || text.length > 300) throw new HttpError(400, 'Mỗi dòng dài 1–300 ký tự');
    if (kind === 'preset' && (!meta || meta.length > 300)) throw new HttpError(400, 'Nhạc mẫu cần có link YouTube');
    return [text, meta];
  });
  // Chỉ xoá dòng của chính người viết, không đụng vào câu của người kia
  await env.DB.batch([
    env.DB.prepare('DELETE FROM items WHERE kind = ? AND author = ?').bind(kind, author),
    ...rows.map(([text, meta], i) => env.DB
      .prepare('INSERT INTO items (kind, text, meta, position, author) VALUES (?, ?, ?, ?, ?)')
      .bind(kind, text, meta, i, author)),
  ]);
}

// ---------- Thư ----------

// Thư hai chiều: người nhận chỉ thấy thư người kia gửi cho mình (sender = peer),
// người gửi chỉ thấy (và xoá được) thư của chính mình (sender = who).
// Cột cho người nhận: KHÔNG bao giờ có pin; thư còn khoá thì content = NULL
const LOCKED = '(pin IS NOT NULL AND unlocked_at IS NULL)';
const PUBLIC_COLS = `id, sender, emoji, show_at AS showAt, read_at AS readAt, unlocked_at AS unlockedAt, pin_hint AS hint,
  ${LOCKED} AS locked, CASE WHEN ${LOCKED} THEN NULL ELSE content END AS content`;
// Cột cho người gửi: có pin để còn nhắn mã cho người kia
const SENT_COLS = `id, sender, content, emoji, pin, pin_hint AS hint, show_at AS showAt, created_at AS createdAt,
  read_at AS readAt, unlocked_at AS unlockedAt`;

const publicMessage = (r) => r && { ...r, locked: Boolean(r.locked) };

async function getPublicMessage(env, who, id) {
  return publicMessage(await env.DB.prepare(`SELECT ${PUBLIC_COLS} FROM messages WHERE id = ? AND sender = ? AND show_at <= ?`)
    .bind(id, peerOf(who), Date.now()).first());
}

async function inbox(env, who) {
  const { results } = await env.DB.prepare(
    `SELECT ${PUBLIC_COLS} FROM messages WHERE sender = ? AND show_at <= ? ORDER BY show_at DESC LIMIT 100`,
  ).bind(peerOf(who), Date.now()).all();
  return results.map(publicMessage);
}

async function sentBy(env, who) {
  const { results } = await env.DB.prepare(`SELECT ${SENT_COLS} FROM messages WHERE sender = ? ORDER BY show_at DESC LIMIT 300`)
    .bind(who).all();
  return results;
}

async function deleteMessage(env, who, id) {
  await env.DB.prepare('DELETE FROM messages WHERE id = ? AND sender = ?').bind(id, who).run();
}

async function createMessage(env, who, body) {
  const content = String(body?.content ?? '').trim();
  if (!content) throw new HttpError(400, 'Thư chưa có nội dung');
  if (content.length > MAX_MESSAGE) throw new HttpError(400, `Thư dài tối đa ${MAX_MESSAGE} ký tự`);
  const emoji = String(body?.emoji || '💌').slice(0, 8);
  const pin = String(body?.pin ?? '').trim() || null;
  if (pin && pin.length > 20) throw new HttpError(400, 'Mã PIN dài tối đa 20 ký tự');
  const hint = pin ? (String(body?.hint ?? '').trim().slice(0, 100) || null) : null;
  const now = Date.now();
  const showAt = body?.showAt == null || body.showAt === '' ? now : Number(body.showAt);
  if (!Number.isFinite(showAt)) throw new HttpError(400, 'Thời gian gửi không hợp lệ');
  return env.DB.prepare(
    `INSERT INTO messages (content, emoji, show_at, created_at, pin, pin_hint, sender) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING ${SENT_COLS}`,
  ).bind(content, emoji, Math.round(showAt), now, pin, hint, who).first();
}

async function unlockMessage(request, env, who, id) {
  const key = `pin:${clientIp(request)}`;
  await assertNotLimited(env, key);
  const row = await env.DB.prepare('SELECT pin, unlocked_at FROM messages WHERE id = ? AND sender = ? AND show_at <= ?')
    .bind(id, peerOf(who), Date.now()).first();
  if (!row) throw new HttpError(404, 'Không tìm thấy thư');
  if (row.pin && !row.unlocked_at) {
    const body = await readJson(request);
    if (!await safeEqual(String(body?.pin ?? '').trim(), row.pin)) {
      await recordFailure(env, key);
      throw new HttpError(403, 'Sai mã rồi, thử lại nha 🥺');
    }
    await env.DB.prepare('UPDATE messages SET unlocked_at = ? WHERE id = ? AND unlocked_at IS NULL').bind(Date.now(), id).run();
  }
  return getPublicMessage(env, who, id);
}

// ---------- Trò chuyện & phiếu hẹn ----------

const CHAT = { maxText: 1000, maxPlace: 80, maxNote: 200, page: 40 };
const CHAT_COLS = 'id, sender, kind, body, place, at, status, ref_id AS refId, created_at AS createdAt';
const ANSWERS = ['accepted', 'declined'];

const whoOf = (session) => (session.role === 'admin' ? 'anh' : 'em');
const peerOf = (who) => (who === 'anh' ? 'em' : 'anh');

async function chatState(env, who) {
  const now = Date.now();
  const [seen, upcoming, unread] = await Promise.all([
    env.DB.prepare('SELECT who, last_id AS lastId FROM chat_seen').all(),
    env.DB.prepare(`SELECT ${CHAT_COLS} FROM chats WHERE kind = 'date' AND status = 'accepted' AND at > ? ORDER BY at LIMIT 5`)
      .bind(now).all(),
    env.DB.prepare(`SELECT count(*) AS n FROM chats WHERE sender = ? AND kind != 'reply'
      AND id > (SELECT last_id FROM chat_seen WHERE who = ?)`).bind(peerOf(who), who).first(),
  ]);
  const cursor = Object.fromEntries(seen.results.map((r) => [r.who, r.lastId]));
  return { me: who, seen: cursor[who] || 0, peerSeen: cursor[peerOf(who)] || 0, unread: unread.n, upcoming: upcoming.results, now };
}

// after = poll tin mới; before = tải tin cũ hơn; không có gì = trang mới nhất.
// Trạng thái phiếu nằm sẵn trên dòng phiếu, nên trang cũ tải lại vẫn đúng.
async function listChats(env, url, who) {
  const after = Number(url.searchParams.get('after'));
  const before = Number(url.searchParams.get('before'));
  let chats = [];
  let more = false;
  if (after > 0) {
    ({ results: chats } = await env.DB.prepare(`SELECT ${CHAT_COLS} FROM chats WHERE id > ? ORDER BY id LIMIT 200`)
      .bind(after).all());
  } else {
    const stmt = before > 0
      ? env.DB.prepare(`SELECT ${CHAT_COLS} FROM chats WHERE id < ? ORDER BY id DESC LIMIT ?`).bind(before, CHAT.page + 1)
      : env.DB.prepare(`SELECT ${CHAT_COLS} FROM chats ORDER BY id DESC LIMIT ?`).bind(CHAT.page + 1);
    const { results } = await stmt.all();
    more = results.length > CHAT.page;
    chats = results.slice(0, CHAT.page).reverse();
  }
  return { chats, more, ...await chatState(env, who) };
}

function cleanText(value, max, label) {
  const s = String(value ?? '').trim();
  if (s.length > max) throw new HttpError(400, `${label} dài tối đa ${max} ký tự`);
  return s;
}

async function createChat(env, who, body) {
  const now = Date.now();
  if (body?.kind === 'date') {
    const place = cleanText(body.place, CHAT.maxPlace, 'Chỗ hẹn');
    if (!place) throw new HttpError(400, 'Phiếu hẹn cần ghi đi đâu nè');
    const note = cleanText(body.note, CHAT.maxNote, 'Ghi chú');
    const at = Number(body.at);
    if (!Number.isFinite(at)) throw new HttpError(400, 'Chọn giờ hẹn nha');
    if (at < now - 60000) throw new HttpError(400, 'Giờ hẹn phải ở tương lai nha');
    const refId = body.refId ? Number(body.refId) : null;
    const stmts = [];
    if (refId) {
      // Đổi giờ: phiếu cũ phải còn chờ trả lời
      const old = await env.DB.prepare("SELECT status FROM chats WHERE id = ? AND kind = 'date'").bind(refId).first();
      if (!old) throw new HttpError(404, 'Không tìm thấy phiếu cũ');
      if (old.status !== 'pending') throw new HttpError(409, 'Phiếu này đã được trả lời rồi');
      stmts.push(
        env.DB.prepare("UPDATE chats SET status = 'rescheduled' WHERE id = ?").bind(refId),
        env.DB.prepare("INSERT INTO chats (sender, kind, body, ref_id, created_at) VALUES (?, 'reply', 'rescheduled', ?, ?)")
          .bind(who, refId, now),
      );
    }
    stmts.push(env.DB.prepare(
      `INSERT INTO chats (sender, kind, body, place, at, status, ref_id, created_at) VALUES (?, 'date', ?, ?, ?, 'pending', ?, ?) RETURNING ${CHAT_COLS}`,
    ).bind(who, note, place, Math.round(at), refId, now));
    const results = await env.DB.batch(stmts);
    return results.at(-1).results[0];
  }
  const text = cleanText(body?.body, CHAT.maxText, 'Tin nhắn');
  if (!text) throw new HttpError(400, 'Tin nhắn trống nè');
  return env.DB.prepare(`INSERT INTO chats (sender, kind, body, created_at) VALUES (?, 'text', ?, ?) RETURNING ${CHAT_COLS}`)
    .bind(who, text, now).first();
}

async function answerDate(env, who, id, answer) {
  if (!ANSWERS.includes(answer)) throw new HttpError(400, 'Câu trả lời không hợp lệ');
  const card = await env.DB.prepare("SELECT sender, status, at FROM chats WHERE id = ? AND kind = 'date'").bind(id).first();
  if (!card) throw new HttpError(404, 'Không tìm thấy phiếu hẹn');
  // Lỗi nghiệp vụ dùng 409, không dùng 403 (trang admin coi 403 là hết phiên)
  if (card.sender === who) throw new HttpError(409, 'Phiếu của mình thì chờ người kia trả lời nha');
  if (card.status !== 'pending') throw new HttpError(409, 'Phiếu này đã được trả lời rồi');
  if (card.at < Date.now()) throw new HttpError(409, 'Giờ hẹn đã qua mất rồi');
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE chats SET status = ? WHERE id = ? AND status = 'pending'").bind(answer, id),
    env.DB.prepare("INSERT INTO chats (sender, kind, body, ref_id, created_at) VALUES (?, 'reply', ?, ?, ?)")
      .bind(who, answer, id, now),
  ]);
}

// ---------- Học cùng nhau: trạng thái, kế hoạch, tim cổ vũ ----------

const PLAN = { maxText: 100, maxOpen: 20 };
const CHEER_GAP_MS = 60000;
const PHASE_NAMES = ['focus', 'short', 'long'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Ngày theo giờ Việt Nam (UTC+7), dạng YYYY-MM-DD
const vnDay = (ms = Date.now()) => new Date(ms + 7 * 3600000).toISOString().slice(0, 10);

// Trạng thái gửi lên chỉ giữ các trường đã biết, đúng kiểu, trong giới hạn hợp lý
function cleanPresence(input) {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'Trạng thái không hợp lệ');
  const int = (v, max) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(max, Math.round(Number(v)))) : 0);
  const time = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null);
  return {
    phase: PHASE_NAMES.includes(input.phase) ? input.phase : 'focus',
    running: input.running === true,
    left: int(input.left, 4 * 3600000),
    total: int(input.total, 4 * 3600000),
    done: int(input.done, 20),
    longEvery: int(input.longEvery, 10),
    day: typeof input.day === 'string' && DAY_RE.test(input.day) ? input.day : vnDay(),
    pomos: int(input.pomos, 200),
    minutes: int(input.minutes, 3000),
    water: int(input.water, 50),
    waterGoal: int(input.waterGoal, 20),
    eyeRest: input.eyeRest !== false,
    lastWater: time(input.lastWater),
    lastMove: time(input.lastMove),
    lastEye: time(input.lastEye),
    online: input.online !== false,
  };
}

async function savePresence(env, who, data) {
  await env.DB.prepare(
    'INSERT INTO presence (who, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(who) DO UPDATE SET data = ?2, updated_at = ?3',
  ).bind(who, JSON.stringify(data), Date.now()).run();
}

const PLAN_COLS = 'id, who, day, text, done_at AS doneAt';

// Danh sách hôm nay: việc chưa xong (kể cả từ hôm trước) + việc đã xong trong hôm nay
async function plans(env, who = null) {
  const today = vnDay();
  const stmt = who
    ? env.DB.prepare(`SELECT ${PLAN_COLS} FROM plan_items WHERE who = ? AND (done_at IS NULL OR done_day = ?) ORDER BY id`).bind(who, today)
    : env.DB.prepare(`SELECT ${PLAN_COLS} FROM plan_items WHERE done_at IS NULL OR done_day = ? ORDER BY id`).bind(today);
  const { results } = await stmt.all();
  return results;
}

async function addPlan(env, who, body) {
  const text = cleanText(body?.text, PLAN.maxText, 'Mỗi việc');
  if (!text) throw new HttpError(400, 'Viết việc cần học vào nha');
  const open = await env.DB.prepare('SELECT count(*) AS n FROM plan_items WHERE who = ? AND done_at IS NULL').bind(who).first();
  if (open.n >= PLAN.maxOpen) throw new HttpError(409, `Kế hoạch đang có ${PLAN.maxOpen} việc rồi, xong bớt rồi thêm nha`);
  return env.DB.prepare(`INSERT INTO plan_items (who, day, text, created_at) VALUES (?, ?, ?, ?) RETURNING ${PLAN_COLS}`)
    .bind(who, vnDay(), text, Date.now()).first();
}

async function updatePlan(env, who, id, body) {
  const row = await env.DB.prepare('SELECT id FROM plan_items WHERE id = ? AND who = ?').bind(id, who).first();
  if (!row) throw new HttpError(404, 'Không tìm thấy việc này');
  const stmts = [];
  if (typeof body?.done === 'boolean') {
    const now = Date.now();
    stmts.push(body.done
      ? env.DB.prepare('UPDATE plan_items SET done_at = ?, done_day = ? WHERE id = ? AND done_at IS NULL').bind(now, vnDay(now), id)
      : env.DB.prepare('UPDATE plan_items SET done_at = NULL, done_day = NULL WHERE id = ?').bind(id));
  }
  if (body?.text !== undefined) {
    const text = cleanText(body.text, PLAN.maxText, 'Mỗi việc');
    if (!text) throw new HttpError(400, 'Việc này chưa có tên');
    stmts.push(env.DB.prepare('UPDATE plan_items SET text = ? WHERE id = ?').bind(text, id));
  }
  if (stmts.length) await env.DB.batch(stmts);
}

async function sendCheer(env, who) {
  const now = Date.now();
  const last = await env.DB.prepare('SELECT created_at AS at FROM cheers WHERE sender = ? ORDER BY id DESC LIMIT 1').bind(who).first();
  if (last && now - last.at < CHEER_GAP_MS) throw new HttpError(429, 'Vừa gửi tim xong, đợi một chút rồi gửi tiếp nha 💗');
  await env.DB.batch([
    env.DB.prepare('INSERT INTO cheers (sender, created_at) VALUES (?, ?)').bind(who, now),
    env.DB.prepare('DELETE FROM cheers WHERE created_at < ?').bind(now - 7 * 86400000),
  ]);
}

// Một lần gọi: (tuỳ chọn) ghi trạng thái của mình, đọc trạng thái + kế hoạch của cả hai và tim mới nhận.
// cheersAfter = id tim cuối đã thấy (0 nếu chưa có tim nào); bỏ trống = lần đầu, chỉ trả con trỏ, không trả tim cũ.
async function together(env, who, body) {
  if (body?.presence) await savePresence(env, who, cleanPresence(body.presence));
  const after = Number.isInteger(body?.cheersAfter) && body.cheersAfter >= 0 ? body.cheersAfter : null;
  const [rows, plan, cheers, top] = await Promise.all([
    env.DB.prepare('SELECT who, data, updated_at AS updatedAt FROM presence').all(),
    plans(env),
    after !== null
      ? env.DB.prepare('SELECT id, created_at AS at FROM cheers WHERE sender = ? AND id > ? ORDER BY id LIMIT 20').bind(peerOf(who), after).all()
      : Promise.resolve({ results: [] }),
    env.DB.prepare('SELECT max(id) AS id FROM cheers WHERE sender = ?').bind(peerOf(who)).first(),
  ]);
  const presence = { anh: null, em: null };
  for (const r of rows.results) presence[r.who] = { ...JSON.parse(r.data), updatedAt: r.updatedAt };
  return {
    me: who,
    now: Date.now(),
    today: vnDay(),
    presence,
    plans: { anh: plan.filter((p) => p.who === 'anh'), em: plan.filter((p) => p.who === 'em') },
    cheers: cheers.results,
    cheerCursor: top?.id || 0,
  };
}

// ---------- API ----------

async function handleApi(request, env, url, session) {
  const { pathname } = url;
  const method = request.method;
  let m;

  // Cookie tự gửi kèm nên chặn request ghi đến từ trang web khác (CSRF)
  const origin = request.headers.get('origin');
  if (method !== 'GET' && origin && origin !== url.origin) throw new HttpError(403, 'Sai nguồn gửi');

  if (pathname === '/api/login' && method === 'POST') {
    if (!env.ADMIN_PASSWORD || !env.VIEWER_PASSWORD) throw new HttpError(503, 'Server chưa đặt ADMIN_PASSWORD và VIEWER_PASSWORD');
    const key = `login:${clientIp(request)}`;
    await assertNotLimited(env, key);
    const password = String((await readJson(request))?.password ?? '');
    const role = await safeEqual(password, env.ADMIN_PASSWORD) ? 'admin'
      : await safeEqual(password, env.VIEWER_PASSWORD) ? 'viewer' : null;
    if (!role) {
      await recordFailure(env, key);
      throw new HttpError(401, 'Sai mật khẩu rồi 🥺');
    }
    const res = json({ role, me: whoOf({ role }) });
    res.headers.append('set-cookie', await sessionCookie(env, url, role));
    res.headers.append('set-cookie', whoCookie(url, whoOf({ role }), SESSION_DAYS[role] * 86400));
    return res;
  }
  if (pathname === '/api/logout' && method === 'POST') {
    const res = json({ ok: true });
    res.headers.append('set-cookie', cookie(url, '', 0));
    res.headers.append('set-cookie', whoCookie(url, '', 0));
    return res;
  }
  if (pathname === '/api/me' && method === 'GET') {
    requireRole(session, 'viewer');
    return json({ role: session.role, me: whoOf(session) });
  }

  // ----- Trang học (cả hai cùng dùng; "mình" lấy từ phiên: admin = anh, viewer = em) -----
  requireRole(session, 'viewer');
  const who = whoOf(session);

  if (pathname === '/api/bootstrap' && method === 'GET') {
    const [settings, { items, written }] = await Promise.all([getSettings(env, who), getItems(env, who)]);
    return json({ settings, items, written, role: session.role, me: who, serverTime: Date.now() });
  }
  if (pathname === '/api/settings' && method === 'PUT') {
    return json({ settings: await saveSettings(env, who, await readJson(request)) });
  }
  if ((m = pathname.match(/^\/api\/items\/(sweet|note)$/)) && method === 'PUT') {
    await replaceItems(env, m[1], (await readJson(request))?.items, who);
    return json({ written: (await getItems(env, who)).written });
  }

  // Thư: hộp thư nhận (người kia gửi), thư đã gửi (của mình)
  if (pathname === '/api/messages' && method === 'GET') {
    return json({ messages: await inbox(env, who) });
  }
  if (pathname === '/api/messages' && method === 'POST') {
    return json({ message: await createMessage(env, who, await readJson(request)) }, 201);
  }
  if (pathname === '/api/messages/sent' && method === 'GET') {
    return json({ messages: await sentBy(env, who) });
  }
  if ((m = pathname.match(/^\/api\/messages\/(\d+)$/)) && method === 'DELETE') {
    await deleteMessage(env, who, Number(m[1]));
    return json({ ok: true });
  }
  if ((m = pathname.match(/^\/api\/messages\/(\d+)\/unlock$/)) && method === 'POST') {
    return json({ message: await unlockMessage(request, env, who, Number(m[1])) });
  }
  if ((m = pathname.match(/^\/api\/messages\/(\d+)\/read$/)) && method === 'POST') {
    // Thư còn khoá thì chưa tính là đã đọc; chỉ người nhận mới đánh dấu được
    await env.DB.prepare(`UPDATE messages SET read_at = ? WHERE id = ? AND sender = ? AND read_at IS NULL AND show_at <= ? AND NOT ${LOCKED}`)
      .bind(Date.now(), Number(m[1]), peerOf(who), Date.now()).run();
    return json({ ok: true });
  }

  // Học cùng nhau
  if (pathname === '/api/together' && method === 'POST') {
    return json(await together(env, who, await readJson(request)));
  }
  if (pathname === '/api/presence/bye' && method === 'POST') {
    // sendBeacon lúc rời trang: đánh dấu đã rời, giữ nguyên số liệu
    const row = await env.DB.prepare('SELECT data FROM presence WHERE who = ?').bind(who).first();
    if (row) await savePresence(env, who, { ...JSON.parse(row.data), running: false, online: false });
    return json({ ok: true });
  }
  if (pathname === '/api/plan' && method === 'POST') {
    await addPlan(env, who, await readJson(request));
    return json({ plan: await plans(env, who) }, 201);
  }
  if ((m = pathname.match(/^\/api\/plan\/(\d+)$/)) && method === 'PATCH') {
    await updatePlan(env, who, Number(m[1]), await readJson(request));
    return json({ plan: await plans(env, who) });
  }
  if ((m = pathname.match(/^\/api\/plan\/(\d+)$/)) && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM plan_items WHERE id = ? AND who = ?').bind(Number(m[1]), who).run();
    return json({ plan: await plans(env, who) });
  }
  if (pathname === '/api/cheer' && method === 'POST') {
    await sendCheer(env, who);
    return json({ ok: true }, 201);
  }

  // ----- Trò chuyện (cả hai cùng dùng; người gửi lấy từ phiên) -----
  if (pathname === '/api/chat' && method === 'GET') {
    return json(await listChats(env, url, who));
  }
  if (pathname === '/api/chat' && method === 'POST') {
    const chat = await createChat(env, who, await readJson(request));
    return json({ chat }, 201);
  }
  if ((m = pathname.match(/^\/api\/chat\/(\d+)\/answer$/)) && method === 'POST') {
    await answerDate(env, who, Number(m[1]), (await readJson(request))?.answer);
    return json({ ok: true });
  }
  if (pathname === '/api/chat/seen' && method === 'POST') {
    const lastId = Number((await readJson(request))?.lastId);
    if (!Number.isInteger(lastId) || lastId < 0) throw new HttpError(400, 'lastId không hợp lệ');
    // Chỉ tiến lên, không lùi; không thay đổi thì không tốn lượt ghi thật
    await env.DB.prepare('UPDATE chat_seen SET last_id = ? WHERE who = ? AND last_id < ?')
      .bind(lastId, who, lastId).run();
    return json({ ok: true });
  }

  // ----- Phía anh (quản trị) -----
  if (pathname.startsWith('/api/admin/')) {
    requireRole(session, 'admin');
    // Thư của anh (không bao giờ trả thư em gửi, vì có pin)
    if (pathname === '/api/admin/messages' && method === 'GET') {
      return json({ messages: await sentBy(env, 'anh') });
    }
    if (pathname === '/api/admin/messages' && method === 'POST') {
      return json({ message: await createMessage(env, 'anh', await readJson(request)) }, 201);
    }
    if ((m = pathname.match(/^\/api\/admin\/messages\/(\d+)$/)) && method === 'DELETE') {
      await deleteMessage(env, 'anh', Number(m[1]));
      return json({ ok: true });
    }
    if (pathname === '/api/admin/content' && method === 'GET') {
      return json({ items: await adminItems(env) });
    }
    if ((m = pathname.match(/^\/api\/admin\/items\/(\w+)$/)) && method === 'PUT') {
      const body = await readJson(request);
      await replaceItems(env, m[1], body?.items, 'anh');
      return json({ items: await adminItems(env) });
    }
    // Anh chỉnh cài đặt giúp em ở /admin
    if (pathname === '/api/admin/settings/em' && method === 'GET') {
      return json({ settings: await getSettings(env, 'em') });
    }
    if (pathname === '/api/admin/settings/em' && method === 'PUT') {
      return json({ settings: await saveSettings(env, 'em', await readJson(request)) });
    }
  }

  throw new HttpError(404, 'Không tìm thấy');
}

// ---------- Cổng vào cho trang tĩnh ----------

async function handlePage(request, env, url, session) {
  const path = url.pathname;
  const isLogin = path === '/login' || path === '/login.html';

  if (PUBLIC_PATHS.has(path)) {
    // Đã đăng nhập đủ quyền thì khỏi hiện trang đăng nhập
    if (isLogin && session) {
      const next = safeNext(url.searchParams.get('next'));
      const needAdmin = ADMIN_PATHS.has(next.split('?')[0]);
      if (!needAdmin || session.role === 'admin') return redirect(next);
    }
    return env.ASSETS.fetch(request);
  }

  const next = encodeURIComponent(path + url.search);
  if (!session) return redirect(`/login?next=${next}`);
  if (ADMIN_PATHS.has(path) && session.role !== 'admin') return redirect(`/login?next=${next}&need=admin`);

  const res = await env.ASSETS.fetch(request);
  const out = new Response(res.body, res);
  out.headers.set('cache-control', 'private, no-cache');
  // Giữ cookie who khớp với phiên (kể cả phiên đăng nhập từ trước khi có cookie này)
  const who = whoOf(session);
  const hasWho = (request.headers.get('cookie') || '').split(/;\s*/).includes(`who=${who}`);
  if (!hasWho && (out.headers.get('content-type') || '').includes('text/html')) {
    out.headers.append('set-cookie', whoCookie(url, who, SESSION_DAYS[session.role] * 86400));
  }
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const session = await getSession(request, env);
    if (!url.pathname.startsWith('/api/')) return handlePage(request, env, url, session);
    try {
      return await handleApi(request, env, url, session);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: 'Lỗi server, thử lại sau nha' }, 500);
    }
  },
};
