// ===== LboCraft CMS - PHP API Backend =====

const LboCraft = {
  STORAGE_KEY: 'lbocraft_data',

  defaultData: {
    pages: {},
    blog: [
      { id: 1, title: 'كيف تبني استراتيجية تسويق رقمي فعّالة في 2026', excerpt: 'الدليل الشامل لبناء استراتيجية تسويقية تحقق نتائج ملموسة.', category: 'استراتيجية', date: '2026-07-10', content: 'التسويق الرقمي في 2026 يتطلب نهجاً استراتيجياً شاملاً...' },
      { id: 2, title: 'أسرار تصميم المواقع الإلكترونية', excerpt: 'كيف يُصمَّم موقع إلكتروني أداة تحويل فعلية.', category: 'تصميم مواقع', date: '2026-07-05', content: 'تصميم الموقع الإلكتروني هو البوابة الأولى...' },
      { id: 3, title: 'إدارة حملات جوجل إعلانات', excerpt: 'استراتيجيات متقدمة لتحقيق أعلى عائد إعلاني.', category: 'إعلانات جوجل', date: '2026-06-28', content: 'الإعلانات على جوجل ليست مجرد ضغط على زر...' }
    ],
    social: { whatsapp: '', instagram: '', tiktok: '', snapchat: '', facebook: '' },
    contact_info: { email: 'info@darbalnajah.com', phone: '', location: 'الرياض، السعودية' }
  },

  _data: null,
  _apiBase: '',

  // ===== HELPERS =====
  _isLocalhost() {
    var h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '';
  },

  _fetchWithTimeout(url, opts, ms) {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, ms || 4000);
    return fetch(url, Object.assign({}, opts || {}, { signal: controller.signal }))
      .finally(function() { clearTimeout(timer); });
  },

  // ===== API HELPERS =====
  _getUrl(endpoint) {
    var base = (typeof LBOCRAFT_CONFIG !== 'undefined' && LBOCRAFT_CONFIG.API_BASE) ? LBOCRAFT_CONFIG.API_BASE : 'api';
    var isSubdir = window.location.pathname.includes('/services/') || window.location.pathname.includes('/blog/');
    var prefix = isSubdir ? '../' : '';
    return prefix + base + '/' + endpoint + '.php';
  },

  _getPasscode() {
    return (typeof LBOCRAFT_CONFIG !== 'undefined' && LBOCRAFT_CONFIG.PASSCODE) ? LBOCRAFT_CONFIG.PASSCODE : '0099';
  },

  async _apiGet(endpoint) {
    if (this._isLocalhost()) return null;
    try {
      var r = await this._fetchWithTimeout(this._getUrl(endpoint), {}, 4000);
      if (!r.ok) return null;
      return await r.json();
    } catch(e) { return null; }
  },

  async _apiPost(endpoint, data) {
    if (this._isLocalhost()) return false;
    try {
      var r = await this._fetchWithTimeout(this._getUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Passcode': this._getPasscode()
        },
        body: JSON.stringify(data)
      }, 4000);
      return r.ok;
    } catch(e) { return false; }
  },

  // ===== LOCAL STORAGE =====
  _localLoad() {
    try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || this.defaultData; }
    catch(e) { return this.defaultData; }
  },

  _localSave(data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },

  // ===== PUBLIC API =====
  getData() {
    return this._data || this._localLoad();
  },

  async saveData(data) {
    this._data = data;
    this._localSave(data);
    await this._apiPost('data', data);
  },

  // ===== INIT =====
  async init() {
    // Always have local data ready FIRST (synchronously)
    if (!localStorage.getItem(this.STORAGE_KEY)) {
      this._localSave(this.defaultData);
    }
    this._data = this._localLoad();
    console.log('[LboCraft] Local data loaded:', (this._data.blog || []).length, 'blog posts');

    // Try fetching from server (non-blocking, updates cache for next time)
    try {
      var remote = await this._apiGet('data');
      if (remote && remote.blog) {
        this._data = remote;
        this._localSave(remote);
        console.log('[LboCraft] Cloud data loaded:', remote.blog.length, 'blog posts');
      }
    } catch(e) {}

    return this._data;
  },

  // ===== CRUD =====
  verifyPasscode(code) { return code === this._getPasscode(); },

  updatePage(pageKey, content) {
    var data = this.getData();
    if (!data.pages) data.pages = {};
    data.pages[pageKey] = { ...data.pages[pageKey], ...content };
    this.saveData(data);
  },

  addBlogPost(post) {
    var data = this.getData();
    if (!data.blog) data.blog = [];
    post.id = Date.now();
    post.date = new Date().toISOString().split('T')[0];
    data.blog.unshift(post);
    this.saveData(data);
    return post;
  },

  updateBlogPost(id, updates) {
    var data = this.getData();
    var idx = data.blog.findIndex(p => p.id === id);
    if (idx !== -1) {
      data.blog[idx] = { ...data.blog[idx], ...updates };
      this.saveData(data);
      return data.blog[idx];
    }
    return null;
  },

  deleteBlogPost(id) {
    var data = this.getData();
    data.blog = (data.blog || []).filter(p => p.id !== id);
    this.saveData(data);
  },

  getBlogPosts() { return (this.getData().blog || []); },

  updateSocial(links) {
    var data = this.getData();
    data.social = { ...data.social, ...links };
    this.saveData(data);
  },

  updateContactInfo(info) {
    var data = this.getData();
    data.contact_info = { ...data.contact_info, ...info };
    this.saveData(data);
  },

  reset() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.defaultData));
  }
};

// Auto-init — sets _data synchronously from localStorage, then fetches cloud in background
LboCraft.init();
