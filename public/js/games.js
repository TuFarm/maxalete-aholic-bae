/* Góc giải trí — thêm trò chơi mới bằng cách thêm 1 phần tử vào GAMES.
   Trò chơi có hàm play() sẽ mở được; không có thì hiện "Sắp ra mắt". */

const GAMES = [
  {
    id: 'love-jar',
    emoji: '🫙',
    name: 'Hũ lời yêu',
    desc: 'Lắc hũ để nhận một lời nhắn bí mật',
    play() {
      const pick = () => personalize(pickRandom(Content.data.note, Me.isEm ? '{his} thương {her} nhiều 💗'
        : `${Me.peerName} chưa bỏ lời nhắn nào vào hũ, nhắc ${Me.they} viết đi 😚`));
      Popup.show({
        emoji: '🫙',
        title: 'Hũ lời yêu',
        html: '<div class="love-jar"><span class="jar" id="jar">🫙</span><div class="love-note" id="loveNote">Bấm vào hũ để lắc nè!</div></div>',
        actions: [{ label: 'Đóng hũ lại 💕', primary: true }],
      });
      const jar = document.getElementById('jar');
      jar.addEventListener('click', () => {
        jar.classList.remove('shake');
        void jar.offsetWidth;
        jar.classList.add('shake');
        Sound.play('soft');
        setTimeout(() => { document.getElementById('loveNote').textContent = pick(); }, 350);
      });
    },
  },
  { id: 'memory', emoji: '🃏', name: 'Lật thẻ cặp đôi', desc: 'Tìm các cặp hình giống nhau' },
  { id: 'quiz', emoji: '💭', name: 'Hiểu nhau bao nhiêu?', desc: 'Câu đố về hai đứa mình' },
  {
    id: 'catch',
    emoji: '🧺',
    name: 'Hứng tim',
    desc: 'Hứng thật nhiều trái tim rơi',
    play() { CatchHearts.open(); },
  },
  { id: 'wheel', emoji: '🎡', name: 'Vòng quay hẹn hò', desc: 'Quay xem cuối tuần đi đâu' },
];

const Games = {
  init() {
    const grid = document.getElementById('gameGrid');
    GAMES.forEach((g) => {
      const card = document.createElement(g.play ? 'button' : 'div');
      card.className = 'game' + (g.play ? '' : ' soon');
      card.innerHTML = `<span class="game-emoji">${g.emoji}</span><h3>${g.name}</h3><p>${g.desc}</p>`
        + `<span class="badge">${g.play ? 'Chơi ngay ✨' : 'Sắp ra mắt 💕'}</span>`;
      if (g.play) card.addEventListener('click', () => g.play());
      grid.appendChild(card);
    });
  },
};

/* Hứng tim: kéo giỏ hứng tim rơi trong 45 giây, né tim vỡ (có 3 mạng) */
const CATCH_ITEMS = [
  { emoji: '💗', points: 1, weight: 60 },
  { emoji: '💕', points: 1, weight: 20 },
  { emoji: '💖', points: 3, weight: 8 },
  { emoji: '💔', points: 0, weight: 12, bad: true },
];
const CATCH_SECONDS = 45;

const CatchHearts = {
  open() {
    Popup.show({
      emoji: '🧺',
      title: 'Hứng tim',
      html: '<div class="catch-game">'
        + '<div class="catch-hud"><span id="catchScore"></span><span id="catchTime"></span><span id="catchLives"></span></div>'
        + '<canvas id="catchCanvas" width="360" height="420" aria-label="Khu vực chơi Hứng tim"></canvas>'
        + `<p class="hint">Kéo giỏ (hoặc phím ← →) để hứng tim. 💖 được 3 điểm, né 💔 nha! Kỷ lục: <b id="catchBest">${Store.get('catchBest', 0)}</b></p>`
        + '</div>',
      actions: [
        { label: 'Chơi lại 🔁', keepOpen: true, onClick: () => this.start() },
        { label: 'Thôi nghỉ 💕', primary: true, onClick: () => this.stop() },
      ],
      onShow: () => this.start(),
    });
  },

  start() {
    this.stop();
    const canvas = document.getElementById('catchCanvas');
    if (!canvas) return;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.flash = 0;
    this.state = {
      basketX: canvas.width / 2, score: 0, lives: 3, items: [], pops: [],
      left: CATCH_SECONDS * 1000, spawnIn: 0, keys: { left: false, right: false },
    };
    this.last = performance.now();

    const onPointer = (e) => {
      const rect = canvas.getBoundingClientRect();
      this.state.basketX = (e.clientX - rect.left) * (canvas.width / rect.width);
    };
    const onDown = (e) => { canvas.setPointerCapture?.(e.pointerId); onPointer(e); };
    const onKey = (e) => {
      const down = e.type === 'keydown';
      if (e.key === 'ArrowLeft') this.state.keys.left = down;
      else if (e.key === 'ArrowRight') this.state.keys.right = down;
      else return;
      e.preventDefault();
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onPointer);
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKey);
    this.cleanup = () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onPointer);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKey);
    };
    this.renderHud();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  },

  stop() {
    cancelAnimationFrame(this.raf);
    this.cleanup?.();
    this.cleanup = null;
  },

  pickItem() {
    let r = Math.random() * CATCH_ITEMS.reduce((n, it) => n + it.weight, 0);
    return CATCH_ITEMS.find((it) => (r -= it.weight) < 0) || CATCH_ITEMS[0];
  },

  frame(now) {
    // Popup bị đóng hoặc bị popup khác thay chỗ thì dừng vòng lặp
    if (!this.canvas.isConnected || document.getElementById('modal').hidden) return this.stop();
    const dt = Math.min(50, now - this.last);
    this.last = now;
    const s = this.state;
    const { width: W, height: H } = this.canvas;
    const progress = 1 - s.left / (CATCH_SECONDS * 1000); // 0 → 1: càng về cuối tim rơi càng nhanh, càng dày

    if (s.keys.left) s.basketX -= 0.45 * dt;
    if (s.keys.right) s.basketX += 0.45 * dt;
    s.basketX = Math.max(30, Math.min(W - 30, s.basketX));

    const secBefore = Math.ceil(s.left / 1000);
    s.left -= dt;
    s.spawnIn -= dt;
    if (s.spawnIn <= 0) {
      const it = this.pickItem();
      s.items.push({ ...it, x: 20 + Math.random() * (W - 40), y: -20, vy: 0.12 + progress * 0.16 + Math.random() * 0.06 });
      s.spawnIn = 650 - progress * 330;
    }

    const basketTop = H - 48;
    s.items = s.items.filter((it) => {
      it.y += it.vy * dt;
      if (it.y >= basketTop && it.y <= basketTop + 24 && Math.abs(it.x - s.basketX) < 38) {
        if (it.bad) { s.lives--; this.flash = 200; } else { s.score += it.points; Sound.play('pop'); }
        s.pops.push({ x: it.x, y: basketTop, text: it.bad ? '-❤️' : `+${it.points}`, bad: it.bad, life: 600 });
        this.renderHud();
        return false;
      }
      return it.y < H + 20;
    });
    s.pops = s.pops.filter((p) => (p.life -= dt) > 0);
    this.flash = Math.max(0, this.flash - dt);

    this.draw(basketTop);
    if (s.left <= 0 || s.lives <= 0) return this.finish();
    if (Math.ceil(s.left / 1000) !== secBefore) this.renderHud();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  },

  draw(basketTop) {
    const { ctx, state: s } = this;
    const { width: W, height: H } = this.canvas;
    ctx.clearRect(0, 0, W, H);
    if (this.flash > 0) {
      ctx.fillStyle = 'rgba(232, 77, 125, .15)';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '30px serif';
    s.items.forEach((it) => ctx.fillText(it.emoji, it.x, it.y));
    ctx.font = '52px serif';
    ctx.fillText('🧺', s.basketX, basketTop + 18);
    ctx.font = 'bold 20px Quicksand, sans-serif';
    s.pops.forEach((p) => {
      ctx.globalAlpha = p.life / 600;
      ctx.fillStyle = p.bad ? '#9a7a93' : '#e84d7d';
      ctx.fillText(p.text, p.x, p.y - (600 - p.life) / 12);
    });
    ctx.globalAlpha = 1;
  },

  renderHud() {
    const s = this.state;
    const lives = Math.max(0, s.lives);
    document.getElementById('catchScore').textContent = `💗 ${s.score}`;
    document.getElementById('catchTime').textContent = `⏱️ ${Math.max(0, Math.ceil(s.left / 1000))}s`;
    document.getElementById('catchLives').textContent = '❤️'.repeat(lives) + '🤍'.repeat(3 - lives);
  },

  finish() {
    this.stop();
    const s = this.state;
    this.renderHud();
    const best = Store.get('catchBest', 0);
    const record = s.score > best;
    if (record) Store.set('catchBest', s.score);
    document.getElementById('catchBest').textContent = Math.max(best, s.score);
    Sound.play(record ? 'done' : 'break');

    const { ctx } = this;
    const { width: W, height: H } = this.canvas;
    ctx.fillStyle = 'rgba(255, 244, 247, .92)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e84d7d';
    ctx.font = '34px "Patrick Hand", cursive';
    ctx.fillText(s.lives <= 0 ? 'Hết mạng rồi 🥺' : 'Hết giờ rồi! ⏰', W / 2, H / 2 - 60);
    ctx.fillStyle = '#5b3a55';
    ctx.font = '26px "Patrick Hand", cursive';
    ctx.fillText(`Hứng được ${s.score} điểm tim 💗`, W / 2, H / 2 - 15, W - 24);
    if (record) ctx.fillText('🏆 Kỷ lục mới luôn!', W / 2, H / 2 + 25);
    ctx.fillStyle = '#9a7a93';
    ctx.font = '20px "Patrick Hand", cursive';
    ctx.fillText(personalize('{his} còn nhiều tim hơn cho {her} nữa nè'), W / 2, H / 2 + 70, W - 24);
  },
};
