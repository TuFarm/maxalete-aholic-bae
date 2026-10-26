/* Gọi backend (xác thực bằng cookie đăng nhập). Không có server thì app vẫn chạy bằng dữ liệu trong máy. */

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function goLogin() {
  location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search);
}

const Api = {
  online: false,

  async request(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch(path, {
        method,
        headers: body ? { 'content-type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, 'Không kết nối được server');
    }
    const data = await res.json().catch(() => null);
    // Hết phiên đăng nhập: quay về trang đăng nhập, giữ nguyên đường dẫn hiện tại
    if (res.status === 401 && path !== '/api/login') { goLogin(); throw new ApiError(401, 'Cần đăng nhập lại'); }
    if (!res.ok || !data) throw new ApiError(res.status, data?.error || 'Server không phản hồi đúng');
    return data;
  },

  bootstrap() { return this.request('/api/bootstrap'); },
  saveSettings(patch) { return this.request('/api/settings', { method: 'PUT', body: patch }); },
  messages() { return this.request('/api/messages'); },
  unlock(id, pin) { return this.request(`/api/messages/${id}/unlock`, { method: 'POST', body: { pin } }); },
  markRead(id) { return this.request(`/api/messages/${id}/read`, { method: 'POST' }); },
  sendLetter(body) { return this.request('/api/messages', { method: 'POST', body }); },
  sentLetters() { return this.request('/api/messages/sent'); },
  deleteLetter(id) { return this.request(`/api/messages/${id}`, { method: 'DELETE' }); },
  saveWritten(kind, items) { return this.request(`/api/items/${kind}`, { method: 'PUT', body: { items } }); },
  together(body) { return this.request('/api/together', { method: 'POST', body }); },
  planAdd(text) { return this.request('/api/plan', { method: 'POST', body: { text } }); },
  planUpdate(id, patch) { return this.request(`/api/plan/${id}`, { method: 'PATCH', body: patch }); },
  planDelete(id) { return this.request(`/api/plan/${id}`, { method: 'DELETE' }); },
  cheer() { return this.request('/api/cheer', { method: 'POST' }); },
  async logout() {
    await this.request('/api/logout', { method: 'POST' }).catch(() => {});
    location.href = '/login';
  },
};
