/* Tiện ích dùng chung: lưu trữ, cài đặt, thống kê, âm thanh, thông báo, toast */

const Store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('bae:' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('bae:' + key, JSON.stringify(value)); } catch { /* bỏ qua */ }
  },
};

// Thêm ?fast vào URL để test: 1 "phút" = 1 giây
const FAST = new URLSearchParams(location.search).has('fast');
const MIN = FAST ? 1000 : 60000;

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

const Settings = {
  data: { ...DEFAULT_SETTINGS, ...Store.get('settings', {}) },
  // Áp dụng cài đặt (từ server hoặc form) và lưu bản sao vào máy
  apply(patch) {
    Object.assign(this.data, patch);
    Store.set('settings', this.data);
    document.dispatchEvent(new CustomEvent('settings:changed'));
  },
};

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const Stats = {
  all() { return Store.get('stats', {}); },
  today() { return { pomos: 0, minutes: 0, water: 0, ...this.all()[dateKey()] }; },
  add(field, amount = 1) {
    const all = this.all();
    const key = dateKey();
    all[key] = { pomos: 0, minutes: 0, water: 0, ...all[key] };
    all[key][field] += amount;
    Store.set('stats', all);
    document.dispatchEvent(new CustomEvent('stats:changed'));
  },
  // Số ngày liên tiếp có ít nhất 1 phiên học (tính cả hôm nay nếu đã học)
  streak() {
    const all = this.all();
    const d = new Date();
    if (!(all[dateKey(d)]?.pomos > 0)) d.setDate(d.getDate() - 1);
    let n = 0;
    while (all[dateKey(d)]?.pomos > 0) { n++; d.setDate(d.getDate() - 1); }
    return n;
  },
};

const Sound = {
  ctx: null,
  // Tạo tiếng chuông bằng Web Audio, không cần file âm thanh
  play(kind = 'soft') {
    if (!Settings.data.sound) return;
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      const notes = {
        soft: [784, 988, 1175],
        done: [523, 659, 784, 1047],
        break: [1047, 784, 659],
      }[kind] || [784];
      const t0 = this.ctx.currentTime;
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t = t0 + i * 0.16;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.65);
      });
    } catch { /* trình duyệt không hỗ trợ */ }
  },
  unlock() {
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { /* bỏ qua */ }
  },
};

const Notify = {
  supported: 'Notification' in window,
  get granted() { return this.supported && Notification.permission === 'granted'; },
  async request() {
    if (!this.supported) return false;
    try { return (await Notification.requestPermission()) === 'granted'; } catch { return false; }
  },
  // Chỉ bật thông báo hệ thống khi bé đang ở tab khác
  send(title, body) {
    if (!this.granted || !document.hidden) return;
    try { new Notification(title, { body, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💗</text></svg>' }); } catch { /* bỏ qua */ }
  },
};

function toast(message, ms = 4000) {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, ms);
}

// Nội dung chỉnh sửa được từ trang quản trị; đây chỉ là bản dự phòng khi không có server
const Content = {
  data: Store.get('content', null) || {
    sweet: ['Cố lên nè, {his} luôn ở đây cổ vũ {her} đó 💌', '{his} tự hào về {her} lắm luôn 🥰', 'Mệt thì nghỉ chút, {his} thương {her} nhiều 💗'],
    note: ['Phiếu ôm 1 cái thật chặt 🤗 (có hiệu lực vĩnh viễn)', '{his} nợ {her} một ly trà sữa full topping 🧋'],
    preset: [
      { name: '☁️ 4 A.M Study', src: 'TURbeWK2wwg' },
      { name: '🌙 1 A.M Study', src: 'lTRiuFIWV54' },
      { name: '🎹 Piano học bài', src: 'HSOtku1j600' },
      { name: '🌧️ Tiếng mưa', src: 'mPZkdNFkNps' },
    ],
  },
  apply(items) {
    this.data = items;
    Store.set('content', items);
    document.dispatchEvent(new CustomEvent('content:changed'));
  },
};

// Thay {her}/{his} bằng tên thật
function personalize(text) {
  const s = Settings.data;
  return text.replaceAll('{her}', s.herName || 'em').replaceAll('{his}', s.hisName || 'anh');
}

function pickRandom(list, fallback = '') {
  return list.length ? list[Math.floor(Math.random() * list.length)] : fallback;
}

function sweetLine() {
  return personalize(pickRandom(Content.data.sweet, '{his} thương {her} nhiều 💗'));
}

function fmtTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
