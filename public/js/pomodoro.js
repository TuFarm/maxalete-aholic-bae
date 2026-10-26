/* Đồng hồ Pomodoro: tính thời gian theo mốc kết thúc (endAt) nên không bị lệch khi tab chạy nền */

const PHASES = {
  focus: { label: 'Tập trung', sub: 'Tập trung nào 💪', emoji: '🍅' },
  short: { label: 'Nghỉ ngắn', sub: 'Thư giãn chút nha 🌿', emoji: '☕' },
  long: { label: 'Nghỉ dài', sub: 'Nghỉ ngơi thật đã 🛋️', emoji: '🌙' },
};

const Timer = {
  state: Store.get('timer', null) || { phase: 'focus', running: false, endAt: 0, remaining: null, done: 0 },
  els: {},

  duration(phase = this.state.phase) {
    return Settings.data[phase] * MIN;
  },

  remaining() {
    const s = this.state;
    if (s.running) return Math.max(0, s.endAt - Date.now());
    return s.remaining ?? this.duration();
  },

  isFresh() {
    return !this.state.running && (this.state.remaining == null || this.state.remaining === this.duration());
  },

  save() { Store.set('timer', this.state); },

  start() {
    Sound.unlock();
    const s = this.state;
    if (s.running) return;
    s.endAt = Date.now() + this.remaining();
    s.running = true;
    this.save();
    this.emit('timer:start');
    this.render();
  },

  pause() {
    const s = this.state;
    if (!s.running) return;
    s.remaining = this.remaining();
    s.running = false;
    this.save();
    this.emit('timer:pause');
    this.render();
  },

  toggle() { this.state.running ? this.pause() : this.start(); },

  reset() {
    Object.assign(this.state, { running: false, remaining: null, endAt: 0 });
    this.save();
    this.emit('timer:reset');
    this.render();
  },

  setPhase(phase, { autoStart = false } = {}) {
    Object.assign(this.state, { phase, running: false, remaining: null, endAt: 0 });
    this.save();
    if (autoStart) this.start();
    this.render();
  },

  // Kết thúc phiên hiện tại và chuyển sang phiên tiếp theo
  complete({ skipped = false, silent = false } = {}) {
    const s = this.state;
    const from = s.phase;
    let to;
    if (from === 'focus') {
      if (!skipped) {
        Stats.add('pomos');
        Stats.add('minutes', Settings.data.focus);
      }
      s.done += 1;
      to = s.done >= Settings.data.longEvery ? 'long' : 'short';
    } else {
      if (from === 'long') s.done = 0;
      to = 'focus';
    }
    const wasRunning = s.running;
    this.setPhase(to, { autoStart: !silent && wasRunning && Settings.data.autoStart });
    this.emit('timer:phaseend', { from, to, skipped, silent });
  },

  skip() { this.complete({ skipped: true }); },

  tick() {
    if (this.state.running && this.remaining() <= 0) this.complete();
    this.render();
  },

  emit(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail: { ...detail, phase: this.state.phase, running: this.state.running } }));
  },

  init() {
    const $ = (id) => document.getElementById(id);
    this.els = {
      card: $('study'), time: $('timeText'), sub: $('timeSub'), ring: $('ringFg'),
      chip: $('phaseChip'), start: $('startBtn'), dots: $('cycleDots'),
      tabs: document.querySelectorAll('#study .phase-tab'), hint: $('timerHint'),
    };
    const r = this.els.ring.r.baseVal.value;
    this.circ = 2 * Math.PI * r;
    this.els.ring.style.strokeDasharray = this.circ;

    // Hết giờ trong lúc đóng trang: tự chuyển phiên, không tự chạy tiếp
    if (this.state.running && this.state.endAt <= Date.now()) this.complete({ silent: true });

    this.els.start.addEventListener('click', () => this.toggle());
    $('resetBtn').addEventListener('click', () => this.reset());
    $('skipBtn').addEventListener('click', () => this.skip());
    this.els.tabs.forEach((tab) => tab.addEventListener('click', () => {
      if (tab.dataset.phase === this.state.phase) return;
      this.setPhase(tab.dataset.phase);
      this.emit('timer:reset');
    }));
    document.addEventListener('settings:changed', () => {
      this.render();
    });

    setInterval(() => this.tick(), 500);
    this.render();
  },

  render() {
    const s = this.state;
    const left = this.remaining();
    const total = this.duration();
    const info = PHASES[s.phase];
    const e = this.els;

    e.time.textContent = fmtTime(left);
    e.ring.style.strokeDashoffset = this.circ * (1 - Math.min(1, left / total));
    e.card.dataset.phase = s.phase;
    e.card.classList.toggle('running', s.running);
    e.chip.textContent = info.label;
    e.sub.textContent = s.running ? info.sub : (this.isFresh() ? 'Sẵn sàng chưa nè?' : 'Đang tạm dừng ⏸');
    e.start.textContent = s.running ? '⏸ Tạm dừng'
      : this.isFresh() ? (s.phase === 'focus' ? '▶ Bắt đầu học' : '▶ Bắt đầu nghỉ') : '▶ Tiếp tục';
    e.tabs.forEach((t) => t.classList.toggle('active', t.dataset.phase === s.phase));

    const n = Settings.data.longEvery;
    if (e.dots.childElementCount !== n) {
      e.dots.innerHTML = Array.from({ length: n }, () => '<span>🍅</span>').join('');
    }
    [...e.dots.children].forEach((d, i) => d.classList.toggle('done', i < s.done));

    const st = Settings.data;
    e.hint.textContent = `Pomodoro: ${st.focus} phút học • ${st.short} phút nghỉ • sau ${st.longEvery} phiên nghỉ dài ${st.long} phút 🍅`;

    document.title = s.running ? `${fmtTime(left)} ${info.emoji} ${info.label}` : `Góc Học Của ${Me.myName} 💕`;
    document.body.classList.toggle('is-studying', s.running && s.phase === 'focus');
  },
};
