/* Trình phát nhạc YouTube (IFrame Player API) */

// Nhận diện link YouTube: watch?v=, youtu.be/, /live/, /shorts/, /embed/, playlist?list=
function parseYouTube(input) {
  const text = input.trim();
  if (/^[\w-]{11}$/.test(text)) return { id: text };
  let url;
  try { url = new URL(text.startsWith('http') ? text : 'https://' + text); } catch { return null; }
  if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/.test(url.hostname)) return null;
  const list = url.searchParams.get('list');
  let id = url.searchParams.get('v');
  if (!id && url.hostname.endsWith('youtu.be')) id = url.pathname.slice(1, 12);
  if (!id) id = url.pathname.match(/\/(?:live|shorts|embed)\/([\w-]{11})/)?.[1];
  if (!id && !list) return null;
  return { id: id || null, list: list || null };
}

const Music = {
  player: null,
  ready: false,
  playing: false,
  current: Store.get('music', null),
  custom: Store.get('musicCustom', []),
  volume: Store.get('volume', 50),

  // Nhạc mẫu lấy từ server (Content), mỗi mục có src là ID hoặc link YouTube
  presets() {
    return Content.data.preset
      .map((p) => ({ name: p.name, ...parseYouTube(p.src || '') }))
      .filter((p) => p.id || p.list);
  },

  init() {
    const $ = (id) => document.getElementById(id);
    if (!this.current) this.current = this.presets()[0] || { id: null, list: null };
    document.addEventListener('content:changed', () => this.renderPresets());
    this.els = { status: $('musicStatus'), play: $('playBtn'), hint: $('musicHint'), frame: document.querySelector('.player-frame'), fallback: $('playerFallback') };
    $('volume').value = this.volume;

    $('playBtn').addEventListener('click', () => this.toggle());
    $('nextBtn').addEventListener('click', () => this.ready && this.player.nextVideo());
    $('prevBtn').addEventListener('click', () => this.ready && this.player.previousVideo());
    $('volume').addEventListener('input', (e) => {
      this.volume = +e.target.value;
      Store.set('volume', this.volume);
      if (this.ready) this.player.setVolume(this.volume);
    });
    $('urlForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('urlInput');
      const parsed = parseYouTube(input.value);
      if (!parsed) { this.hint('Link chưa đúng rồi, em dán link YouTube nha 🥺', true); return; }
      this.addCustom(parsed);
      this.load(parsed, true);
      input.value = '';
    });

    this.renderPresets();
    this.loadApi();
  },

  loadApi() {
    if (location.protocol === 'file:') {
      this.els.fallback.innerHTML = '⚠️ YouTube không chạy khi mở file trực tiếp.<br>Hãy chạy bằng <b>npx serve .</b> hoặc Live Server nha.';
    }
    window.onYouTubeIframeAPIReady = () => this.createPlayer();
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => { this.els.fallback.textContent = 'Không tải được YouTube, kiểm tra mạng giúp anh nha 📶'; };
    document.head.appendChild(tag);
  },

  createPlayer() {
    const c = this.current;
    const playerVars = { autoplay: 0, rel: 0, modestbranding: 1, playsinline: 1 };
    if (c.list) Object.assign(playerVars, { listType: 'playlist', list: c.list });
    this.player = new YT.Player('ytPlayer', {
      videoId: c.id || undefined,
      playerVars,
      events: {
        onReady: () => {
          this.ready = true;
          this.els.frame.classList.add('ready');
          this.player.setVolume(this.volume);
          this.renderState();
        },
        onStateChange: (e) => {
          this.playing = e.data === YT.PlayerState.PLAYING;
          if (this.playing) this.hint('Đang phát nhạc, tập trung học thôi nào 🎶');
          this.renderState();
        },
        onError: (e) => {
          const msg = [101, 150, 153].includes(e.data)
            ? 'Video này không phát được ở đây (bị chặn nhúng hoặc đã gỡ), em thử link khác nha 🥲'
            : 'Không phát được video này, em thử link khác nha 🥲';
          this.hint(msg, true);
          this.playing = false;
          this.renderState();
        },
      },
    });
  },

  load(item, play = false) {
    this.current = { id: item.id || null, list: item.list || null };
    Store.set('music', this.current);
    this.renderPresets();
    if (!this.ready) return;
    const method = play ? 'loadPlaylist' : 'cuePlaylist';
    if (item.list) {
      this.player[method]({ listType: 'playlist', list: item.list });
    } else {
      this.player[play ? 'loadVideoById' : 'cueVideoById'](item.id);
    }
    this.hint(play ? 'Đang mở bài mới… 💿' : 'Đã chọn xong, bấm Phát nha ▶');
  },

  toggle() {
    if (!this.ready) { this.hint('Trình phát đang tải, đợi xíu nha ⏳'); return; }
    this.playing ? this.player.pauseVideo() : this.player.playVideo();
  },

  addCustom(item) {
    const key = item.list || item.id;
    if (this.presets().some((p) => (p.list || p.id) === key) || this.custom.some((c) => (c.list || c.id) === key)) return;
    this.custom.unshift({ ...item, name: item.list ? '📀 Playlist của em' : '💿 Bài của em' });
    this.custom = this.custom.slice(0, 6);
    Store.set('musicCustom', this.custom);
  },

  renderPresets() {
    const box = document.getElementById('presets');
    box.innerHTML = '';
    const curKey = this.current.list || this.current.id;
    const add = (item, removable) => {
      const b = document.createElement('button');
      b.className = 'preset' + ((item.list || item.id) === curKey ? ' active' : '');
      b.textContent = item.name;
      b.title = removable ? 'Bấm để phát • nhấp đúp để xoá' : 'Bấm để phát';
      b.addEventListener('click', () => this.load(item, true));
      if (removable) {
        b.addEventListener('dblclick', () => {
          this.custom = this.custom.filter((c) => c !== item);
          Store.set('musicCustom', this.custom);
          this.renderPresets();
        });
      }
      box.appendChild(b);
    };
    this.presets().forEach((p) => add(p, false));
    this.custom.forEach((c) => add(c, true));
  },

  renderState() {
    this.els.play.textContent = this.playing ? '⏸ Dừng' : '▶ Phát';
    this.els.status.textContent = this.playing ? '🎶 Đang phát' : (this.ready ? 'Đang dừng' : 'Chưa phát');
  },

  hint(text, warn = false) {
    this.els.hint.textContent = text;
    this.els.hint.style.color = warn ? 'var(--pink-deep)' : '';
  },
};
