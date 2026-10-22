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
const SESSION_DAYS = { admin: 7, viewer: 30 };
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

async function getSettings(env) {
  const row = await env.DB.prepare('SELECT data FROM settings WHERE id = 1').first();
  return { ...DEFAULT_SETTINGS, ...(row ? JSON.parse(row.data) : {}) };
}

async function saveSettings(env, patch) {
  const merged = { ...await getSettings(env), ...validateSettings(patch) };
  await env.DB.prepare(
    'INSERT INTO settings (id, data, updated_at) VALUES (1, ?1, ?2) ON CONFLICT(id) DO UPDATE SET data = ?1, updated_at = ?2',
  ).bind(JSON.stringify(merged), Date.now()).run();
  return merged;
}

async function getItems(env) {
  const { results } = await env.DB.prepare('SELECT kind, text, meta FROM items ORDER BY kind, position, id').all();
  const out = { sweet: [], note: [], preset: [] };
  for (const r of results) out[r.kind]?.push(r.kind === 'preset' ? { name: r.text, src: r.meta } : r.text);
  return out;
}

async function replaceItems(env, kind, list) {
  if (!ITEM_KINDS.includes(kind)) throw new HttpError(404, 'Không có danh sách này');
  if (!Array.isArray(list) || list.length > MAX_ITEMS) throw new HttpError(400, `Tối đa ${MAX_ITEMS} dòng`);
  const rows = list.map((item) => {
    const text = String(kind === 'preset' ? item?.name : item).trim();
    const meta = kind === 'preset' ? String(item?.src ?? '').trim() : null;
    if (!text || text.length > 300) throw new HttpError(400, 'Mỗi dòng dài 1–300 ký tự');
    if (kind === 'preset' && (!meta || meta.length > 300)) throw new HttpError(400, 'Nhạc mẫu cần có link YouTube');
    return [text, meta];
  });
  await env.DB.batch([
    env.DB.prepare('DELETE FROM items WHERE kind = ?').bind(kind),
    ...rows.map(([text, meta], i) => env.DB
      .prepare('INSERT INTO items (kind, text, meta, position) VALUES (?, ?, ?, ?)')
      .bind(kind, text, meta, i)),
  ]);
}

// ---------- Thư ----------

// Cột cho phía em: KHÔNG bao giờ có pin; thư còn khoá thì content = NULL
const LOCKED = '(pin IS NOT NULL AND unlocked_at IS NULL)';
const PUBLIC_COLS = `id, emoji, show_at AS showAt, read_at AS readAt, unlocked_at AS unlockedAt, pin_hint AS hint,
  ${LOCKED} AS locked, CASE WHEN ${LOCKED} THEN NULL ELSE content END AS content`;
// Cột cho trang quản trị: có pin để anh còn nhắn cho em
const ADMIN_COLS = `id, content, emoji, pin, pin_hint AS hint, show_at AS showAt, created_at AS createdAt,
  read_at AS readAt, unlocked_at AS unlockedAt`;

const publicMessage = (r) => r && { ...r, locked: Boolean(r.locked) };

async function getPublicMessage(env, id) {
  return publicMessage(await env.DB.prepare(`SELECT ${PUBLIC_COLS} FROM messages WHERE id = ? AND show_at <= ?`)
    .bind(id, Date.now()).first());
}

async function createMessage(env, body) {
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
    `INSERT INTO messages (content, emoji, show_at, created_at, pin, pin_hint) VALUES (?, ?, ?, ?, ?, ?) RETURNING ${ADMIN_COLS}`,
  ).bind(content, emoji, Math.round(showAt), now, pin, hint).first();
}

async function unlockMessage(request, env, id) {
  const key = `pin:${clientIp(request)}`;
  await assertNotLimited(env, key);
  const row = await env.DB.prepare('SELECT pin, unlocked_at FROM messages WHERE id = ? AND show_at <= ?')
    .bind(id, Date.now()).first();
  if (!row) throw new HttpError(404, 'Không tìm thấy thư');
  if (row.pin && !row.unlocked_at) {
    const body = await readJson(request);
    if (!await safeEqual(String(body?.pin ?? '').trim(), row.pin)) {
      await recordFailure(env, key);
      throw new HttpError(403, 'Sai mã rồi, em thử lại nha 🥺');
    }
    await env.DB.prepare('UPDATE messages SET unlocked_at = ? WHERE id = ? AND unlocked_at IS NULL').bind(Date.now(), id).run();
  }
  return getPublicMessage(env, id);
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
    return json({ role }, 200, { 'set-cookie': await sessionCookie(env, url, role) });
  }
  if (pathname === '/api/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': cookie(url, '', 0) });
  }
  if (pathname === '/api/me' && method === 'GET') {
    requireRole(session, 'viewer');
    return json({ role: session.role });
  }

  // ----- Phía em (admin cũng dùng được) -----
  if (pathname === '/api/bootstrap' && method === 'GET') {
    requireRole(session, 'viewer');
    const [settings, items] = await Promise.all([getSettings(env), getItems(env)]);
    return json({ settings, items, role: session.role, serverTime: Date.now() });
  }
  if (pathname === '/api/settings' && method === 'PUT') {
    requireRole(session, 'viewer');
    return json({ settings: await saveSettings(env, await readJson(request)) });
  }
  if (pathname === '/api/messages' && method === 'GET') {
    requireRole(session, 'viewer');
    const { results } = await env.DB.prepare(
      `SELECT ${PUBLIC_COLS} FROM messages WHERE show_at <= ? ORDER BY show_at DESC LIMIT 100`,
    ).bind(Date.now()).all();
    return json({ messages: results.map(publicMessage) });
  }
  if ((m = pathname.match(/^\/api\/messages\/(\d+)\/unlock$/)) && method === 'POST') {
    requireRole(session, 'viewer');
    return json({ message: await unlockMessage(request, env, Number(m[1])) });
  }
  if ((m = pathname.match(/^\/api\/messages\/(\d+)\/read$/)) && method === 'POST') {
    requireRole(session, 'viewer');
    // Thư còn khoá thì chưa tính là đã đọc
    await env.DB.prepare(`UPDATE messages SET read_at = ? WHERE id = ? AND read_at IS NULL AND show_at <= ? AND NOT ${LOCKED}`)
      .bind(Date.now(), Number(m[1]), Date.now()).run();
    return json({ ok: true });
  }

  // ----- Trò chuyện (cả hai cùng dùng; người gửi lấy từ phiên) -----
  if (pathname === '/api/chat' && method === 'GET') {
    requireRole(session, 'viewer');
    return json(await listChats(env, url, whoOf(session)));
  }
  if (pathname === '/api/chat' && method === 'POST') {
    requireRole(session, 'viewer');
    const chat = await createChat(env, whoOf(session), await readJson(request));
    return json({ chat }, 201);
  }
  if ((m = pathname.match(/^\/api\/chat\/(\d+)\/answer$/)) && method === 'POST') {
    requireRole(session, 'viewer');
    await answerDate(env, whoOf(session), Number(m[1]), (await readJson(request))?.answer);
    return json({ ok: true });
  }
  if (pathname === '/api/chat/seen' && method === 'POST') {
    requireRole(session, 'viewer');
    const lastId = Number((await readJson(request))?.lastId);
    if (!Number.isInteger(lastId) || lastId < 0) throw new HttpError(400, 'lastId không hợp lệ');
    // Chỉ tiến lên, không lùi; không thay đổi thì không tốn lượt ghi thật
    await env.DB.prepare('UPDATE chat_seen SET last_id = ? WHERE who = ? AND last_id < ?')
      .bind(lastId, whoOf(session), lastId).run();
    return json({ ok: true });
  }

  // ----- Phía anh (quản trị) -----
  if (pathname.startsWith('/api/admin/')) {
    requireRole(session, 'admin');
    if (pathname === '/api/admin/messages' && method === 'GET') {
      const { results } = await env.DB.prepare(`SELECT ${ADMIN_COLS} FROM messages ORDER BY show_at DESC LIMIT 300`).all();
      return json({ messages: results });
    }
    if (pathname === '/api/admin/messages' && method === 'POST') {
      return json({ message: await createMessage(env, await readJson(request)) }, 201);
    }
    if ((m = pathname.match(/^\/api\/admin\/messages\/(\d+)$/)) && method === 'DELETE') {
      await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(Number(m[1])).run();
      return json({ ok: true });
    }
    if ((m = pathname.match(/^\/api\/admin\/items\/(\w+)$/)) && method === 'PUT') {
      const body = await readJson(request);
      await replaceItems(env, m[1], body?.items);
      return json({ items: await getItems(env) });
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
