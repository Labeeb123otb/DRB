// ===== LBOCRAFT Inline Editor v11 =====
// Elementor-style: left sidebar, top bar, drag & drop, inline editing
// Auth-gated: visitors see NOTHING, admin controls everything

(function(){
  var EDIT_STORAGE = 'lbc_edits';
  var editMode = false;
  var dragEl = null;
  var idCounter = 0;
  var selectedEl = null;

  function getEdits() {
    try { return JSON.parse(localStorage.getItem(EDIT_STORAGE)) || {}; } catch(e) { return {}; }
  }
  function setEdits(d) { localStorage.setItem(EDIT_STORAGE, JSON.stringify(d)); }
  function isAuth() { return localStorage.getItem('lbc_auth') === '1'; }

  // ===== CLOUD SYNC FOR PAGE EDITS (PHP API) =====
  function _isLocalhost() {
    var h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '';
  }

  function _getEditsUrl() {
    var base = (typeof LBOCRAFT_CONFIG !== 'undefined' && LBOCRAFT_CONFIG.API_BASE) ? LBOCRAFT_CONFIG.API_BASE : 'api';
    var isSubdir = window.location.pathname.includes('/services/') || window.location.pathname.includes('/blog/');
    var prefix = isSubdir ? '../' : '';
    return prefix + base + '/edits.php';
  }

  function _getPasscode() {
    return (typeof LBOCRAFT_CONFIG !== 'undefined' && LBOCRAFT_CONFIG.PASSCODE) ? LBOCRAFT_CONFIG.PASSCODE : '0099';
  }

  function _fetchWithTimeout(url, opts, ms) {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, ms || 4000);
    return fetch(url, Object.assign({}, opts || {}, { signal: controller.signal }))
      .finally(function() { clearTimeout(timer); });
  }

  async function fetchEditsFromCloud() {
    // Try GitHub API first (cross-device sync)
    if (typeof GitHubDB !== 'undefined') {
      try {
        var ghResult = await GitHubDB.read('api/data/edits.json');
        if (ghResult && ghResult.data && typeof ghResult.data === 'object' && Object.keys(ghResult.data).length > 0) {
          localStorage.setItem(EDIT_STORAGE, JSON.stringify(ghResult.data));
          console.log('[LBOCRAFT] GitHub edits fetched:', Object.keys(ghResult.data).join(', '));
          loadEdits(); // Re-apply edits now that cloud data is in localStorage
          return;
        }
      } catch(e) {}
    }

    // Fall back to PHP API
    if (_isLocalhost()) { return; }
    try {
      var url = _getEditsUrl();
      var r = await _fetchWithTimeout(url, {}, 4000);
      if (r.ok) {
        var data = await r.json();
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          localStorage.setItem(EDIT_STORAGE, JSON.stringify(data));
          console.log('[LBOCRAFT] Cloud edits fetched:', Object.keys(data).join(', '));
          loadEdits();
        }
      }
    } catch(e) {}
  }

  async function pushEditsToCloud(data) {
    // Push to GitHub API
    if (typeof GitHubDB !== 'undefined') {
      try {
        var existing = await GitHubDB.read('api/data/edits.json');
        var sha = existing ? existing.sha : null;
        var result = await GitHubDB.write('api/data/edits.json', data, sha);
        if (result) console.log('[LBOCRAFT] GitHub push OK');
      } catch(e) { console.log('[LBOCRAFT] GitHub push failed:', e.message); }
    }

    // Also push to PHP API
    if (_isLocalhost()) return;
    try {
      await _fetchWithTimeout(_getEditsUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Passcode': _getPasscode() },
        body: JSON.stringify(data)
      }, 4000);
    } catch(e) {}
  }

  // ===================== LOAD STATUS =====================
  function showLoadStatus(pageKey, snapshotCount) {
    var el = document.createElement('div');
    el.id = 'lbcDebugPanel';
    el.style.cssText = 'position:fixed;bottom:1rem;right:1rem;padding:0.8rem 1.2rem;border-radius:12px;font-size:0.75rem;font-weight:600;z-index:99999;font-family:IBM Plex Sans Arabic,sans-serif;transition:all 0.3s;backdrop-filter:blur(10px);cursor:pointer;max-width:320px;line-height:1.6;';
    var keys = [];
    try { keys = Object.keys(JSON.parse(localStorage.getItem(EDIT_STORAGE) || '{}')); } catch(e) {}
    var info = 'صفحة: ' + pageKey + ' | Snapshots: ' + snapshotCount + ' | صفحات محفوظة: ' + keys.join(', ');
    if (snapshotCount > 0) {
      el.style.background = 'rgba(0,230,118,0.12)';
      el.style.border = '1px solid rgba(0,230,118,0.3)';
      el.style.color = '#00e676';
      el.innerHTML = '✅ تم تحميل ' + snapshotCount + ' تعديل (' + pageKey + ')<br><span style="font-size:0.65rem;opacity:0.7">' + info + '</span>';
    } else {
      el.style.background = 'rgba(255,255,255,0.05)';
      el.style.border = '1px solid rgba(255,255,255,0.1)';
      el.style.color = '#5a6278';
      el.innerHTML = '— لا تعديلات (' + pageKey + ') | اضغط Ctrl+S للحفظ<br><span style="font-size:0.65rem;opacity:0.7">' + info + '</span>';
    }
    document.body.appendChild(el);
    el.addEventListener('click', function() { el.remove(); });
    // Auto-hide after 10s
    setTimeout(function() { el.style.opacity = '0'; setTimeout(function() { if (el.parentNode) el.remove(); }, 500); }, 10000);
  }

  // ===================== TOAST =====================
  function toast(msg) {
    var t = document.getElementById('lbcToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'lbcToast';
      t.style.cssText = 'position:fixed;bottom:2rem;right:50%;transform:translateX(50%) translateY(80px);padding:0.8rem 1.8rem;background:rgba(10,14,30,0.95);backdrop-filter:blur(20px);border:1px solid #00e676;border-radius:12px;color:#00e676;font-size:0.85rem;font-weight:600;z-index:100001;opacity:0;transition:all 0.35s cubic-bezier(.4,0,.2,1);font-family:IBM Plex Sans Arabic,sans-serif;pointer-events:none;box-shadow:0 8px 32px rgba(0,230,118,0.15);';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.transform = 'translateX(50%) translateY(0)';
    t.style.opacity = '1';
    clearTimeout(t._t);
    t._t = setTimeout(function(){ t.style.transform='translateX(50%) translateY(80px)'; t.style.opacity='0'; }, 2500);
  }

  // ===================== STYLES =====================
  function injectStyles() {
    if (document.getElementById('lbc-editor-styles')) return;
    var s = document.createElement('style');
    s.id = 'lbc-editor-styles';
    s.textContent =
      // Sidebar
      '#lbcSidebar{position:fixed;top:0;right:0;width:280px;height:100vh;background:#1a1f35;border-left:1px solid rgba(255,255,255,0.08);z-index:100000;display:none;flex-direction:column;font-family:IBM Plex Sans Arabic,sans-serif;box-shadow:-4px 0 24px rgba(0,0,0,0.3);}' +
      '#lbcSidebarHeader{padding:1rem 1.2rem;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;}' +
      '#lbcSidebarHeader .logo{display:flex;align-items:center;gap:0.6rem;}' +
      '#lbcSidebarHeader .logo-icon{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#00d4ff,#7c3aed);display:flex;align-items:center;justify-content:center;}' +
      '#lbcSidebarHeader .logo-icon svg{width:16px;height:16px;}' +
      '#lbcSidebarHeader .logo-text{font-size:0.85rem;font-weight:700;color:#e8edf5;}' +
      '#lbcSidebarHeader .close-btn{width:28px;height:28px;border-radius:6px;background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.2);color:#ff4757;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;transition:all 0.2s;}' +
      '#lbcSidebarHeader .close-btn:hover{background:rgba(255,71,87,0.25);}' +
      // Tabs
      '.lbc-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,0.08);}' +
      '.lbc-tab{flex:1;padding:0.7rem;text-align:center;font-size:0.78rem;font-weight:600;color:#5a6278;cursor:pointer;transition:all 0.2s;border-bottom:2px solid transparent;}' +
      '.lbc-tab:hover{color:#8892a8;}' +
      '.lbc-tab.active{color:#00d4ff;border-bottom-color:#00d4ff;}' +
      // Panels
      '.lbc-panel{flex:1;overflow-y:auto;padding:1rem;}' +
      '.lbc-panel::-webkit-scrollbar{width:4px;}' +
      '.lbc-panel::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px;}' +
      '.lbc-panel-title{font-size:0.7rem;font-weight:700;color:#5a6278;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.8rem;}' +
      '.lbc-elements-grid{display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;}' +
      '.lbc-el-item{display:flex;flex-direction:column;align-items:center;gap:0.4rem;padding:0.8rem 0.5rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;cursor:grab;color:#8892a8;font-size:0.7rem;font-weight:600;transition:all 0.2s;user-select:none;}' +
      '.lbc-el-item:hover{border-color:rgba(0,212,255,0.3);background:rgba(0,212,255,0.06);color:#e8edf5;transform:translateY(-1px);}' +
      '.lbc-el-item:active{cursor:grabbing;transform:scale(0.96);}' +
      '.lbc-el-item .el-icon{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.9rem;}' +
      // Properties
      '.lbc-props{display:none;padding:1rem;overflow-y:auto;flex:1;}' +
      '.lbc-props.active{display:block;}' +
      '.lbc-prop-group{margin-bottom:1rem;}' +
      '.lbc-prop-label{display:block;font-size:0.75rem;font-weight:600;color:#5a6278;margin-bottom:0.4rem;}' +
      '.lbc-prop-input{width:100%;padding:0.6rem 0.8rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8edf5;font-size:0.85rem;font-family:IBM Plex Sans Arabic,sans-serif;outline:none;transition:border-color 0.2s;box-sizing:border-box;}' +
      '.lbc-prop-input:focus{border-color:#00d4ff;}' +
      '.lbc-prop-textarea{min-height:80px;resize:vertical;}' +
      '.lbc-prop-select{cursor:pointer;appearance:auto;}' +
      '.lbc-prop-color{height:36px;padding:4px;cursor:pointer;}' +
      '.lbc-prop-back{display:flex;align-items:center;gap:0.4rem;padding:0.6rem;margin-bottom:1rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;color:#8892a8;font-size:0.8rem;font-weight:600;cursor:pointer;transition:all 0.2s;width:100%;}' +
      '.lbc-prop-back:hover{background:rgba(255,255,255,0.06);color:#e8edf5;}' +
      // Sidebar footer
      '#lbcSidebarFooter{padding:0.8rem 1rem;border-top:1px solid rgba(255,255,255,0.08);display:flex;gap:0.5rem;}' +
      '.lbc-side-btn{flex:1;padding:0.6rem;border-radius:8px;font-size:0.8rem;font-weight:600;cursor:pointer;font-family:IBM Plex Sans Arabic,sans-serif;border:none;transition:all 0.2s;text-align:center;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:0.4rem;}' +
      '.lbc-side-btn.save{background:linear-gradient(135deg,#00d4ff,#7c3aed);color:#fff;}' +
      '.lbc-side-btn.save:hover{box-shadow:0 4px 20px rgba(0,212,255,0.3);transform:translateY(-1px);}' +
      '.lbc-side-btn.exit{background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.2);color:#ff4757;}' +
      '.lbc-side-btn.exit:hover{background:rgba(255,71,87,0.2);}' +
      // Top bar
      '#lbcTopBar{position:fixed;top:0;right:280px;left:0;height:52px;background:rgba(10,14,30,0.92);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,0.06);z-index:99999;display:none;align-items:center;justify-content:space-between;padding:0 1.5rem;font-family:IBM Plex Sans Arabic,sans-serif;}' +
      '#lbcTopBar .bar-left{display:flex;align-items:center;gap:1rem;}' +
      '#lbcTopBar .bar-title{font-size:0.9rem;font-weight:700;color:#e8edf5;}' +
      '#lbcTopBar .bar-badge{padding:0.25rem 0.7rem;background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.2);border-radius:50px;font-size:0.68rem;color:#00d4ff;font-weight:600;}' +
      '#lbcTopBar .bar-hint{font-size:0.72rem;color:#5a6278;}' +
      '#lbcTopBar .bar-right{display:flex;align-items:center;gap:0.5rem;}' +
      // Canvas
      '#lbcCanvas{display:none;margin-right:280px;margin-top:52px;min-height:100vh;transition:margin 0.3s ease;}' +
      // Editing elements
      '.lbc-editable{outline:none!important;transition:box-shadow 0.2s;cursor:text;position:relative;}' +
      '.lbc-editable:hover{box-shadow:inset 0 0 0 2px rgba(0,212,255,0.25);border-radius:4px;}' +
      '.lbc-editable:focus{box-shadow:inset 0 0 0 2px #00d4ff;background:rgba(0,212,255,0.02)!important;border-radius:4px;}' +
      '.lbc-link-editable{outline:none!important;transition:box-shadow 0.2s;cursor:pointer;position:relative;}' +
      '.lbc-link-editable:hover{box-shadow:inset 0 0 0 2px rgba(124,58,237,0.4);border-radius:4px;}' +
      '.lbc-link-editable:focus{box-shadow:inset 0 0 0 2px #7c3aed;background:rgba(124,58,237,0.05)!important;border-radius:4px;}' +
      '.lbc-del-btn{position:absolute;top:-8px;left:-8px;width:22px;height:22px;border-radius:50%;background:#ff4757;border:2px solid #1a1f35;color:#fff;font-size:11px;display:none;align-items:center;justify-content:center;cursor:pointer;z-index:10;transition:transform 0.15s;line-height:1;}' +
      '.lbc-del-btn:hover{transform:scale(1.2);}' +
      '.lbc-editable:hover>.lbc-del-btn,.lbc-link-editable:hover>.lbc-del-btn{display:flex;}' +
      '.lbc-editable:focus>.lbc-del-btn{display:none!important;}' +
      '.lbc-hint-tag{position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);background:rgba(10,14,26,0.9);border:1px solid rgba(124,58,237,0.3);border-radius:6px;padding:2px 8px;font-size:0.6rem;color:#7c3aed;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity 0.15s;font-family:IBM Plex Sans Arabic,sans-serif;}' +
      '.lbc-link-editable:hover>.lbc-hint-tag{opacity:1;}' +
      // Selected element
      '.lbc-selected{box-shadow:0 0 0 2px #00d4ff!important;border-radius:4px;}' +
      // Drop zones
      '.lbc-drop-zone{min-height:60px;border:2px dashed rgba(0,212,255,0.3);border-radius:8px;margin:0.5rem 0;transition:all 0.2s;display:none;align-items:center;justify-content:center;color:#5a6278;font-size:0.75rem;font-weight:600;}' +
      '.lbc-drop-zone.visible{display:flex;}' +
      '.lbc-drop-zone.over{border-color:#00d4ff;background:rgba(0,212,255,0.05);color:#00d4ff;transform:scale(1.01);}' +
      // Drag handle on elements
      '.lbc-drag-handle{position:absolute;top:50%;right:-32px;transform:translateY(-50%);width:24px;height:24px;border-radius:6px;background:rgba(0,212,255,0.15);border:1px solid rgba(0,212,255,0.3);display:none;align-items:center;justify-content:center;cursor:grab;z-index:10;color:#00d4ff;font-size:10px;}' +
      '.lbc-drag-handle:active{cursor:grabbing;background:rgba(0,212,255,0.3);}' +
      '.lbc-editable:hover>.lbc-drag-handle,.lbc-link-editable:hover>.lbc-drag-handle{display:flex;}' +
      // Element being dragged
      '.lbc-dragging{opacity:0.4!important;transform:scale(0.98)!important;}' +
      '.lbc-drag-over-el{box-shadow:0 0 0 3px #00d4ff!important;border-radius:4px;}' +
      // No-edit guard for visitors
      '[contenteditable]{cursor:default!important;}' +
      '@media(max-width:768px){#lbcSidebar{width:100%;}#lbcTopBar{right:0;}#lbcCanvas{margin-right:0;}}';
    document.head.appendChild(s);
  }

  // ===================== SIDEBAR =====================
  function createSidebar() {
    var sb = document.createElement('div');
    sb.id = 'lbcSidebar';
    sb.innerHTML =
      '<div id="lbcSidebarHeader">' +
        '<div class="logo">' +
          '<div class="logo-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>' +
          '<span class="logo-text">LBOCRAFT</span>' +
        '</div>' +
        '<div class="close-btn" id="lbcCloseBtn" title="إنهاء التحرير">✕</div>' +
      '</div>' +
      '<div class="lbc-tabs">' +
        '<div class="lbc-tab active" data-tab="elements">العناصر</div>' +
        '<div class="lbc-tab" data-tab="settings">الخصائص</div>' +
      '</div>' +
      '<div class="lbc-panel" id="lbcElementsPanel">' +
        '<div class="lbc-panel-title">اسحب العنصر إلى الصفحة</div>' +
        '<div class="lbc-elements-grid">' +
          '<div class="lbc-el-item" draggable="true" data-type="h1"><div class="el-icon" style="background:rgba(0,212,255,0.1);color:#00d4ff;">H1</div>عنوان رئيسي</div>' +
          '<div class="lbc-el-item" draggable="true" data-type="h2"><div class="el-icon" style="background:rgba(0,212,255,0.1);color:#00d4ff;">H2</div>عنوان فرعي</div>' +
          '<div class="lbc-el-item" draggable="true" data-type="h3"><div class="el-icon" style="background:rgba(0,212,255,0.1);color:#00d4ff;">H3</div>عنوان صغير</div>' +
          '<div class="lbc-el-item" draggable="true" data-type="p"><div class="el-icon" style="background:rgba(124,58,237,0.1);color:#7c3aed;">P</div>نص فقرة</div>' +
          '<div class="lbc-el-item" draggable="true" data-type="btn"><div class="el-icon" style="background:rgba(0,230,118,0.1);color:#00e676;">▶</div>زر</div>' +
          '<div class="lbc-el-item" draggable="true" data-type="img"><div class="el-icon" style="background:rgba(255,159,67,0.1);color:#ff9f43;">◻</div>صورة</div>' +
          '<div class="lbc-el-item" draggable="true" data-type="divider"><div class="el-icon" style="background:rgba(255,255,255,0.05);color:#5a6278;">—</div>فاصل</div>' +
          '<div class="lbc-el-item" draggable="true" data-type="card"><div class="el-icon" style="background:rgba(224,64,251,0.1);color:#e040fb;">□</div>بطاقة</div>' +
          '<div class="lbc-el-item" draggable="true" data-type="list"><div class="el-icon" style="background:rgba(255,159,67,0.1);color:#ff9f43;">☰</div>قائمة</div>' +
          '<div class="lbc-el-item" draggable="true" data-type="spacer"><div class="el-icon" style="background:rgba(255,255,255,0.03);color:#5a6278;">↕</div>مسافة</div>' +
        '</div>' +
      '</div>' +
      '<div class="lbc-props" id="lbcPropsPanel">' +
        '<button class="lbc-prop-back" id="lbcPropBack">← العودة للعناصر</button>' +
        '<div id="lbcPropsContent"></div>' +
      '</div>' +
      '<div id="lbcSidebarFooter">' +
        '<button class="lbc-side-btn save" id="lbcSaveBtn">💾 حفظ</button>' +
        '<button class="lbc-side-btn exit" id="lbcExitBtn">✕ إنهاء</button>' +
      '</div>';
    document.body.appendChild(sb);

    // Tabs
    sb.querySelectorAll('.lbc-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        sb.querySelectorAll('.lbc-tab').forEach(function(t){ t.classList.remove('active'); });
        this.classList.add('active');
        document.getElementById('lbcElementsPanel').style.display = this.dataset.tab === 'elements' ? 'block' : 'none';
        document.getElementById('lbcPropsPanel').style.display = this.dataset.tab === 'settings' ? 'block' : 'none';
      });
    });

    document.getElementById('lbcCloseBtn').addEventListener('click', exitEditor);
    document.getElementById('lbcSaveBtn').addEventListener('click', saveEdits);
    document.getElementById('lbcExitBtn').addEventListener('click', exitEditor);
    document.getElementById('lbcPropBack').addEventListener('click', switchToElements);

    // Sidebar drag items
    sb.querySelectorAll('.lbc-el-item').forEach(function(item) {
      item.addEventListener('dragstart', function(e) {
        dragEl = { type: this.dataset.type, source: 'sidebar' };
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', this.dataset.type);
        this.style.opacity = '0.5';
        showDropZones();
      });
      item.addEventListener('dragend', function() {
        this.style.opacity = '1';
        dragEl = null;
        hideDropZones();
      });
    });
  }

  function exitEditor() {
    if (confirm('هل تريد إنهاء التحرير والعودة للوحة التحكم؟')) {
      deactivateEditMode();
      var isSub = location.pathname.indexOf('/services/') !== -1 || location.pathname.indexOf('/blog/') !== -1;
      location.href = isSub ? '../../dashboard/panel.html' : 'dashboard/panel.html';
    }
  }

  // ===================== TOP BAR =====================
  function createTopBar() {
    var bar = document.createElement('div');
    bar.id = 'lbcTopBar';
    bar.innerHTML =
      '<div class="bar-left">' +
        '<span class="bar-title">LBOCRAFT</span>' +
        '<span class="bar-badge">وضع التحرير</span>' +
        '<span class="bar-hint">انقر للتعديل — dblclick للرابط/الصورة — اسحب لإعادة الترتيب — Ctrl+S للحفظ</span>' +
      '</div>' +
      '<div class="bar-right">' +
        '<div style="padding:0.3rem 0.8rem;background:rgba(0,230,118,0.1);border:1px solid rgba(0,230,118,0.2);border-radius:6px;font-size:0.72rem;color:#00e676;font-weight:600;" id="lbcSaveStatus">● محفوظ</div>' +
      '</div>';
    document.body.appendChild(bar);
  }

  // ===================== CANVAS =====================
  function createCanvas() {
    var canvas = document.createElement('div');
    canvas.id = 'lbcCanvas';
    document.body.appendChild(canvas);
  }

  // ===================== DROP ZONES =====================
  function showDropZones() {
    document.querySelectorAll('section .container,.container,main,section,.hero,.cta-section').forEach(function(el) {
      if (el.closest('#lbcSidebar') || el.closest('#lbcTopBar') || el.closest('#lbcCanvas')) return;
      if (!el.querySelector('.lbc-drop-zone')) {
        var dz = document.createElement('div');
        dz.className = 'lbc-drop-zone';
        dz.textContent = 'أفلت العنصر هنا';
        el.appendChild(dz);
      }
    });
    document.querySelectorAll('.lbc-drop-zone').forEach(function(dz) { dz.classList.add('visible'); });
  }

  function hideDropZones() {
    document.querySelectorAll('.lbc-drop-zone').forEach(function(dz) { dz.classList.remove('visible', 'over'); });
  }

  // ===================== ELEMENT IDS =====================
  function ensureIds() {
    getEditableElements().forEach(function(el) {
      if (!el.hasAttribute('data-lbc-id')) {
        el.setAttribute('data-lbc-id', 'e' + (++idCounter));
      }
    });
  }

  function getEditableElements() {
    var all = [];
    document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,li,strong,b,a,.btn,.card-link,.nav-cta,img').forEach(function(el) {
      if (isExcluded(el)) return;
      if (el.closest('nav') || el.closest('.navbar') || el.closest('#lbcSidebar') || el.closest('#lbcTopBar')) return;
      if (!el.textContent.trim() && el.tagName !== 'IMG') return;
      all.push(el);
    });
    return all;
  }

  function isExcluded(el) {
    return el.closest('#lbcSidebar') || el.closest('#lbcTopBar') ||
           el.closest('#lbcToast') || el.closest('#lbcCanvas') ||
           el.closest('.bg-grid') || el.closest('.bg-particles') ||
           el.closest('.lbc-drop-zone') || el.closest('#lbcEditorGuard');
  }

  // ===================== EDITABLE =====================
  function addDelBtn(el) {
    if (el.querySelector('.lbc-del-btn')) return;
    if (['SPAN','LI','B','STRONG'].indexOf(el.tagName) !== -1) return;
    var b = document.createElement('button');
    b.className = 'lbc-del-btn';
    b.innerHTML = '✕';
    b.title = 'حذف';
    b.addEventListener('click', function(e) {
      e.stopPropagation(); e.preventDefault();
      if (confirm('حذف هذا العنصر؟')) {
        el.style.transition = 'opacity 0.2s, transform 0.2s';
        el.style.opacity = '0';
        el.style.transform = 'scale(0.95)';
        setTimeout(function() { el.remove(); }, 200);
        toast('تم الحذف');
      }
    });
    el.appendChild(b);
  }

  function addDragHandle(el) {
    if (['SPAN','LI','B','STRONG','IMG'].indexOf(el.tagName) !== -1) return;
    if (el.querySelector('.lbc-drag-handle')) return;
    var h = document.createElement('div');
    h.className = 'lbc-drag-handle';
    h.innerHTML = '⠿';
    h.title = 'اسحب لإعادة الترتيب';
    h.draggable = true;
    h.addEventListener('dragstart', function(e) {
      e.stopPropagation();
      dragEl = { type: 'existing', element: el, source: 'reorder' };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'reorder');
      el.classList.add('lbc-dragging');
      showDropZones();
    });
    h.addEventListener('dragend', function() {
      el.classList.remove('lbc-dragging');
      dragEl = null;
      hideDropZones();
      document.querySelectorAll('.lbc-drag-over-el').forEach(function(e){ e.classList.remove('lbc-drag-over-el'); });
    });
    el.appendChild(h);
  }

  function makeEditable(el) {
    if (!editMode || !isAuth()) return;
    if (!el || isExcluded(el)) return;
    if (el.closest('#lbcSidebar') || el.closest('#lbcTopBar')) return;
    if (el.closest('nav') || el.closest('.navbar')) return;

    var isLink = el.tagName === 'A';
    var isBtn = el.classList.contains('btn') || el.classList.contains('card-link') || el.classList.contains('nav-cta');
    var isImg = el.tagName === 'IMG';

    if (isLink || isBtn) {
      el.setAttribute('contenteditable', 'true');
      el.classList.add('lbc-link-editable');
      addDelBtn(el);
      addDragHandle(el);
      if (!el.querySelector('.lbc-hint-tag')) {
        var h = document.createElement('span');
        h.className = 'lbc-hint-tag';
        h.textContent = 'dblclick لتغيير الرابط';
        el.appendChild(h);
      }
      el.addEventListener('dblclick', function(e) {
        e.preventDefault(); e.stopPropagation();
        var u = prompt('رابط جديد:', this.href);
        if (u) { this.href = u; toast('تم تغيير الرابط'); }
      });
    } else if (isImg) {
      el.setAttribute('draggable', 'false');
      el.style.cursor = 'pointer';
      addDelBtn(el);
      el.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        var u = prompt('رابط الصورة الجديد:', this.src);
        if (u && u !== this.src) { this.src = u; toast('تم تغيير الصورة'); }
      });
    } else if (el.textContent.trim()) {
      el.setAttribute('contenteditable', 'true');
      el.classList.add('lbc-editable');
      addDelBtn(el);
      addDragHandle(el);
    }

    el.addEventListener('click', function(e) {
      if (!editMode) return;
      e.stopPropagation();
      selectElement(this);
    });
  }

  function makeAllEditable() {
    if (!editMode || !isAuth()) return;
    ensureIds();
    getEditableElements().forEach(makeEditable);

    // Containers get delete buttons
    document.querySelectorAll('.card,.why-card,.svc-sub-card,.value-card,.mv-card,.approach-step,.tech-item,.av-card,.brand-item,.blog-featured-card,.blog-side-item,.blog-card,.contact-info-card,.service-hero-banner,.service-feature-card,.footer-col,.footer-brand,.newsletter-box,.cta-box,.cta-section,.hero,.page-header').forEach(function(el) {
      if (isExcluded(el)) return;
      if (el.closest('#lbcSidebar') || el.closest('#lbcTopBar') || el.closest('nav')) return;
      addDelBtn(el);
      addDragHandle(el);
      el.addEventListener('click', function(e) {
        if (!editMode) return;
        e.stopPropagation();
        selectElement(this);
      });
    });

    setupReorderDrop();
  }

  function removeAllEditable() {
    document.querySelectorAll('.lbc-editable,.lbc-link-editable').forEach(function(el) {
      el.removeAttribute('contenteditable');
      el.classList.remove('lbc-editable');
      el.classList.remove('lbc-link-editable');
    });
    document.querySelectorAll('.lbc-del-btn,.lbc-hint-tag,.lbc-drag-handle').forEach(function(el) { el.remove(); });
    document.querySelectorAll('.lbc-selected').forEach(function(el) { el.classList.remove('lbc-selected'); });
    document.querySelectorAll('.lbc-drop-zone').forEach(function(el) { el.remove(); });
    document.querySelectorAll('.lbc-dragging').forEach(function(el) { el.classList.remove('lbc-dragging'); });
  }

  // ===================== REORDER DRAG =====================
  function setupReorderDrop() {
    // Allow dropping on any section/container
    document.addEventListener('dragover', function(e) {
      if (!editMode) return;
      var target = e.target.closest('section,.container,.why-us-grid,.services-grid,.process-steps,.features-row,.blog-grid,.footer-grid');
      if (!target || target.closest('#lbcSidebar') || target.closest('#lbcTopBar')) return;
      if (!dragEl) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = dragEl.source === 'reorder' ? 'move' : 'copy';

      // Highlight drop target
      document.querySelectorAll('.lbc-drag-over-el').forEach(function(el){ el.classList.remove('lbc-drag-over-el'); });
      target.classList.add('lbc-drag-over-el');

      // Show drop indicator on children
      var children = Array.from(target.children).filter(function(c) { return !c.classList.contains('lbc-drop-zone') && !c.classList.contains('lbc-drag-over-el'); });
      children.forEach(function(c) {
        var rect = c.getBoundingClientRect();
        var midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          c.style.borderTop = '3px solid #00d4ff';
          c.style.borderBottom = '';
        } else {
          c.style.borderBottom = '3px solid #00d4ff';
          c.style.borderTop = '';
        }
      });
    });

    document.addEventListener('dragleave', function(e) {
      var target = e.target.closest('section,.container,.why-us-grid,.services-grid,.process-steps,.features-row,.blog-grid,.footer-grid');
      if (target) {
        target.classList.remove('lbc-drag-over-el');
        Array.from(target.children).forEach(function(c) {
          c.style.borderTop = '';
          c.style.borderBottom = '';
        });
      }
    });

    document.addEventListener('drop', function(e) {
      if (!editMode || !dragEl) return;
      var target = e.target.closest('section,.container,.why-us-grid,.services-grid,.process-steps,.features-row,.blog-grid,.footer-grid');
      if (!target || target.closest('#lbcSidebar') || target.closest('#lbcTopBar')) return;
      e.preventDefault();
      target.classList.remove('lbc-drag-over-el');

      // Clean borders
      Array.from(target.children).forEach(function(c) {
        c.style.borderTop = '';
        c.style.borderBottom = '';
      });

      var type = dragEl.type;
      var source = dragEl.source;
      var dropEl = dragEl.element;
      dragEl = null;
      hideDropZones();

      if (source === 'reorder' && dropEl) {
        // Reorder: find insertion point
        var insertBefore = null;
        var children = Array.from(target.children).filter(function(c) { return !c.classList.contains('lbc-drop-zone'); });
        for (var i = 0; i < children.length; i++) {
          var rect = children[i].getBoundingClientRect();
          if (e.clientY < rect.top + rect.height / 2) {
            insertBefore = children[i];
            break;
          }
        }
        if (insertBefore) {
          target.insertBefore(dropEl, insertBefore);
        } else {
          target.appendChild(dropEl);
        }
        dropEl.classList.remove('lbc-dragging');
        toast('تم إعادة الترتيب');
      } else if (source === 'sidebar' && type) {
        // New element from sidebar
        var newEl = createNewElement(type);
        if (!newEl) return;
        // Find insertion point
        var insertBefore2 = null;
        var children2 = Array.from(target.children).filter(function(c) { return !c.classList.contains('lbc-drop-zone'); });
        for (var j = 0; j < children2.length; j++) {
          var rect2 = children2[j].getBoundingClientRect();
          if (e.clientY < rect2.top + rect2.height / 2) {
            insertBefore2 = children2[j];
            break;
          }
        }
        if (insertBefore2) {
          target.insertBefore(newEl, insertBefore2);
        } else {
          target.appendChild(newEl);
        }
        makeEditable(newEl);
        newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        selectElement(newEl);
        toast('تمت الإضافة');
      }
    });
  }

  // ===================== CREATE NEW ELEMENTS =====================
  function createNewElement(type) {
    var el;
    switch(type) {
      case 'h1': el = document.createElement('h1'); el.textContent = 'عنوان رئيسي جديد'; break;
      case 'h2': el = document.createElement('h2'); el.textContent = 'عنوان فرعي جديد'; break;
      case 'h3': el = document.createElement('h3'); el.textContent = 'عنوان صغير جديد'; break;
      case 'p': el = document.createElement('p'); el.textContent = 'نص جديد'; break;
      case 'btn':
        el = document.createElement('a');
        el.href = '#';
        el.className = 'btn btn-primary';
        el.textContent = 'زر جديد';
        break;
      case 'img':
        var url = prompt('رابط الصورة (URL):');
        if (!url) return null;
        el = document.createElement('img');
        el.src = url;
        el.alt = 'صورة جديدة';
        el.style.cssText = 'max-width:100%;border-radius:12px;margin:1rem 0;';
        break;
      case 'divider':
        el = document.createElement('hr');
        el.style.cssText = 'border:none;border-top:1px solid rgba(255,255,255,0.08);margin:2rem 0;';
        break;
      case 'card':
        el = document.createElement('div');
        el.className = 'card';
        el.style.cssText = 'background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:2rem;margin:1rem 0;';
        el.innerHTML = '<h3 style="font-size:1.2rem;font-weight:700;margin-bottom:0.5rem;">عنوان البطاقة</h3><p style="color:#8892a8;line-height:1.9;font-size:0.9rem;">وصف البطاقة هنا</p>';
        break;
      case 'list':
        el = document.createElement('ul');
        el.style.cssText = 'list-style:disc;padding-right:1.5rem;margin:1rem 0;color:#8892a8;line-height:2;';
        el.innerHTML = '<li>عنصر القائمة الأول</li><li>عنصر القائمة الثاني</li><li>عنصر القائمة الثالث</li>';
        break;
      case 'spacer':
        el = document.createElement('div');
        el.style.cssText = 'height:3rem;';
        break;
    }
    if (el) el.setAttribute('data-lbc-new', 'true');
    return el;
  }

  // ===================== PROPERTIES PANEL =====================
  function selectElement(el) {
    document.querySelectorAll('.lbc-selected').forEach(function(s){ s.classList.remove('lbc-selected'); });
    el.classList.add('lbc-selected');
    selectedEl = el;
    showProperties(el);
    var settingsTab = document.querySelector('.lbc-tab[data-tab="settings"]');
    if (settingsTab) settingsTab.click();
  }

  function showProperties(el) {
    var content = document.getElementById('lbcPropsContent');
    var html = '';
    var tag = el.tagName.toLowerCase();
    var isImg = el.tagName === 'IMG';
    var isLink = el.tagName === 'A';

    if (!isImg) {
      html += '<div class="lbc-prop-group"><label class="lbc-prop-label">المحتوى</label>' +
        '<textarea class="lbc-prop-input lbc-prop-textarea" id="lbcPropContent">' + (el.innerText || '').replace(/</g, '&lt;') + '</textarea></div>';
    }
    if (isImg) {
      html += '<div class="lbc-prop-group"><label class="lbc-prop-label">رابط الصورة</label><input class="lbc-prop-input" id="lbcPropSrc" value="' + (el.src || '') + '"></div>' +
        '<div class="lbc-prop-group"><label class="lbc-prop-label">النص البديل</label><input class="lbc-prop-input" id="lbcPropAlt" value="' + (el.alt || '') + '"></div>';
    }
    if (isLink) {
      html += '<div class="lbc-prop-group"><label class="lbc-prop-label">الرابط</label><input class="lbc-prop-input" id="lbcPropHref" value="' + (el.href || '') + '"></div>';
    }

    html += '<div class="lbc-prop-group"><label class="lbc-prop-label">النوع</label><select class="lbc-prop-input lbc-prop-select" id="lbcPropTag">' +
      '<option value="h1"' + (tag === 'h1' ? ' selected' : '') + '>H1</option>' +
      '<option value="h2"' + (tag === 'h2' ? ' selected' : '') + '>H2</option>' +
      '<option value="h3"' + (tag === 'h3' ? ' selected' : '') + '>H3</option>' +
      '<option value="p"' + (tag === 'p' ? ' selected' : '') + '>P</option>' +
      '<option value="div"' + (tag === 'div' ? ' selected' : '') + '>DIV</option>' +
    '</select></div>';

    var curSize = window.getComputedStyle(el).fontSize;
    html += '<div class="lbc-prop-group"><label class="lbc-prop-label">حجم الخط</label><input class="lbc-prop-input" id="lbcPropFontSize" type="text" value="' + curSize + '"></div>';
    var curColor = window.getComputedStyle(el).color;
    html += '<div class="lbc-prop-group"><label class="lbc-prop-label">لون النص</label><input class="lbc-prop-input lbc-prop-color" id="lbcPropColor" type="color" value="' + rgbToHex(curColor) + '"></div>';
    var curAlign = window.getComputedStyle(el).textAlign;
    html += '<div class="lbc-prop-group"><label class="lbc-prop-label">المحاذاة</label><select class="lbc-prop-input lbc-prop-select" id="lbcPropAlign">' +
      '<option value="right"' + (curAlign === 'right' ? ' selected' : '') + '>يمين</option>' +
      '<option value="center"' + (curAlign === 'center' ? ' selected' : '') + '>وسط</option>' +
      '<option value="left"' + (curAlign === 'left' ? ' selected' : '') + '>يسار</option>' +
    '</select></div>';

    html += '<div style="margin-top:1rem;"><button class="lbc-side-btn exit" id="lbcPropDelete" style="width:100%;">🗑️ حذف العنصر</button></div>';
    content.innerHTML = html;

    // Bind
    var ci = document.getElementById('lbcPropContent');
    if (ci) ci.addEventListener('input', function() { el.innerText = this.value; });
    var si = document.getElementById('lbcPropSrc');
    if (si) si.addEventListener('input', function() { if (el.tagName === 'IMG') el.src = this.value; });
    var ai = document.getElementById('lbcPropAlt');
    if (ai) ai.addEventListener('input', function() { if (el.tagName === 'IMG') el.alt = this.value; });
    var hi = document.getElementById('lbcPropHref');
    if (hi) hi.addEventListener('input', function() { if (el.tagName === 'A') el.href = this.value; });
    var ts = document.getElementById('lbcPropTag');
    if (ts) ts.addEventListener('change', function() {
      var n = document.createElement(this.value);
      n.innerHTML = el.innerHTML;
      for (var i = 0; i < el.attributes.length; i++) { try { n.setAttribute(el.attributes[i].name, el.attributes[i].value); } catch(ex) {} }
      el.parentNode.replaceChild(n, el);
      makeEditable(n);
      selectElement(n);
    });
    var fs = document.getElementById('lbcPropFontSize');
    if (fs) fs.addEventListener('change', function() { el.style.fontSize = this.value; });
    var cl = document.getElementById('lbcPropColor');
    if (cl) cl.addEventListener('input', function() { el.style.color = this.value; });
    var al = document.getElementById('lbcPropAlign');
    if (al) al.addEventListener('change', function() { el.style.textAlign = this.value; });
    var db = document.getElementById('lbcPropDelete');
    if (db) db.addEventListener('click', function() {
      if (confirm('حذف هذا العنصر؟')) {
        el.style.transition = 'opacity 0.2s, transform 0.2s';
        el.style.opacity = '0'; el.style.transform = 'scale(0.95)';
        setTimeout(function() { el.remove(); }, 200);
        switchToElements();
        toast('تم الحذف');
      }
    });
  }

  function switchToElements() {
    document.querySelectorAll('.lbc-tab').forEach(function(t){ t.classList.remove('active'); });
    document.querySelector('.lbc-tab[data-tab="elements"]').classList.add('active');
    document.getElementById('lbcElementsPanel').style.display = 'block';
    document.getElementById('lbcPropsPanel').style.display = 'none';
    document.querySelectorAll('.lbc-selected').forEach(function(s){ s.classList.remove('lbc-selected'); });
    selectedEl = null;
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb.charAt(0) === '#') return rgb || '#000000';
    var m = rgb.match(/\d+/g);
    if (!m) return '#000000';
    return '#' + ((1 << 24) + (parseInt(m[0]) << 16) + (parseInt(m[1]) << 8) + parseInt(m[2])).toString(16).slice(1);
  }

  // ===================== SAVE / LOAD =====================
  function pageKey() {
    var fullPath = location.pathname.replace(/\/+$/, '');
    // Remove repo base (first segment if it's not the domain root)
    var parts = fullPath.split('/').filter(Boolean);
    // Check if first part looks like a repo name (no dot, not a known root)
    // Normal GitHub Pages: https://user.github.io/repo/ → parts[0]='repo', parts[1]='about.html'
    // If there are at least 2 parts, the first is likely the repo name
    if (parts.length > 1 && parts[0].indexOf('.') === -1) {
      parts = parts.slice(1); // remove repo name
    }
    var joined = parts.join('/');
    if (!joined || joined.indexOf('.') === -1) return 'index';
    var key = joined.replace('.html', '');
    var params = new URLSearchParams(location.search);
    var id = params.get('id');
    // For blog articles, include id in key
    if (id && key.indexOf('article') !== -1) key += '_' + id;
    return key;
  }

  function isEditorNode(node) {
    if (node.nodeType !== 1) return true; // skip text nodes
    if (node.tagName === 'SCRIPT') return true;
    if (node.id === 'lbcSidebar' || node.id === 'lbcTopBar' || node.id === 'lbcCanvas' || node.id === 'lbcToast') return true;
    if (node.classList && (node.classList.contains('lbc-drop-zone') || node.id === 'lbcDropHint')) return true;
    return false;
  }

  function saveEdits() {
    var data = getEdits();
    var snapshots = [];

    Array.from(document.body.childNodes).forEach(function(node) {
      if (!isEditorNode(node)) snapshots.push(node.outerHTML);
    });

    var pk = pageKey();
    data[pk] = { snapshots: snapshots };
    setEdits(data);
    pushEditsToCloud(data);

    // Verify the save worked
    var verify = getEdits();
    var verifyOk = verify[pk] && verify[pk].snapshots && verify[pk].snapshots.length === snapshots.length;

    console.log('[LBOCRAFT] Save "' + pk + '":', snapshots.length, 'snapshots, verify:', verifyOk ? 'OK' : 'FAIL', 'keys:', Object.keys(verify).join(', '));
    toast(verifyOk ? '✅ تم حفظ التعديلات (' + snapshots.length + ' عنصر)' : '⚠️ فشل الحفظ!');

    var indicator = document.getElementById('lbcSaveStatus');
    if (indicator) {
      indicator.textContent = verifyOk ? '● محفوظ' : '● فشل';
      indicator.style.background = verifyOk ? 'rgba(0,230,118,0.1)' : 'rgba(255,71,87,0.1)';
      indicator.style.color = verifyOk ? '#00e676' : '#ff4757';
    }

    // Show debug panel update
    var panel = document.getElementById('lbcDebugPanel');
    if (panel) {
      panel.style.background = 'rgba(0,230,118,0.12)';
      panel.style.border = '1px solid rgba(0,230,118,0.3)';
      panel.style.color = '#00e676';
      panel.innerHTML = '✅ تم الحفظ: ' + pk + ' (' + snapshots.length + ' عنصر)<br><span style="font-size:0.65rem;opacity:0.7">Verify: ' + (verifyOk ? 'OK' : 'FAIL') + ' | Ctrl+R للتحقق</span>';
    }

    // Commit the actual HTML file to GitHub (permanent)
    commitHTMLToGitHub(pk, snapshots);
  }

  function commitHTMLToGitHub(pk) {
    if (!GitHubDB.init()) {
      console.log('[LBOCRAFT] GitHub token not configured — edit saved locally only');
      return;
    }
    // Clean pk for file path: strip _id suffix (blog articles)
    var filePath = pk.replace(/_\d+$/, '') + '.html';
    console.log('[LBOCRAFT] Committing to GitHub:', filePath);

    // Get the full current page HTML (with user edits applied)
    var fullHtml = document.documentElement.outerHTML;

    // Parse and clean using DOMParser (reliable, handles nesting)
    var parser = new DOMParser();
    var doc = parser.parseFromString(fullHtml, 'text/html');

    // Remove editor UI elements by ID
    var removeIds = ['lbcSidebar', 'lbcTopBar', 'lbcCanvas', 'lbcToast', 'lbcDropHint', 'lbcDebugPanel', 'lbcSaveStatus'];
    removeIds.forEach(function(id) {
      var el = doc.getElementById(id);
      if (el) el.remove();
    });

    // Strip contenteditable and editor artifact classes
    doc.querySelectorAll('[contenteditable]').forEach(function(el) {
      el.removeAttribute('contenteditable');
      el.classList.remove('lbc-editable', 'lbc-link-editable', 'lbc-selected');
    });

    // Remove empty class attributes
    doc.querySelectorAll('[class=""]').forEach(function(el) {
      el.removeAttribute('class');
    });

    // Serialize back
    var doctype = '<!DOCTYPE html>\n';
    var cleaned = doctype + doc.documentElement.outerHTML;

    // Read current file from GitHub to get its SHA, then commit
    GitHubDB._api('GET', filePath)
      .then(function(data) {
        if (!data || !data.content) {
          console.log('[LBOCRAFT] File not found on GitHub:', filePath);
          return;
        }
        var encoded = btoa(unescape(encodeURIComponent(cleaned)));
        return GitHubDB._api('PUT', filePath, {
          message: 'LboCraft: تحديث ' + pk,
          content: encoded,
          sha: data.sha,
          branch: GitHubDB._branch
        });
      })
      .then(function(res) {
        if (res) console.log('[LBOCRAFT] GitHub commit success:', filePath);
      })
      .catch(function(e) {
        console.log('[LBOCRAFT] GitHub commit error:', e.message || e);
      });
  }

  function loadEdits() {
    var data = getEdits();
    var pk = pageKey();
    var pageData = data[pk];
    var hasData = pageData && pageData.snapshots;
    console.log('[LBOCRAFT] Load edits for "' + pk + '" — keys in storage:', Object.keys(data).join(', '), hasData ? (pageData.snapshots.length + ' snapshots') : 'NONE');

    // Show brief status indicator
    showLoadStatus(pk, hasData ? pageData.snapshots.length : 0);

    if (!hasData) return;

    var snapshots = pageData.snapshots;

    // Remove old content nodes
    var toRemove = [];
    Array.from(document.body.childNodes).forEach(function(node) {
      if (!isEditorNode(node)) toRemove.push(node);
    });
    toRemove.forEach(function(node) { node.remove(); });

    // Insert saved snapshots before first script
    var firstScript = document.querySelector('body > script');
    snapshots.forEach(function(html) {
      var temp = document.createElement('div');
      temp.innerHTML = html;
      var el = temp.firstElementChild;
      if (el) {
        if (firstScript) {
          document.body.insertBefore(el, firstScript);
        } else {
          document.body.appendChild(el);
        }
      }
    });

    // Re-init main.js functions since DOM was replaced
    if (typeof initNavbar === 'function') initNavbar();
    if (typeof initMobileMenu === 'function') initMobileMenu();
    if (typeof initTheme === 'function') initTheme();
    if (typeof initScrollAnimations === 'function') initScrollAnimations();
    if (typeof initSmoothScroll === 'function') initSmoothScroll();

    // Notify pages that edits were loaded (so CMS content can re-render)
    document.dispatchEvent(new CustomEvent('lbc:editsLoaded'));
    console.log('[LBOCRAFT] Edits loaded and applied for "' + pk + '"');
  }

  // ===================== GUARD: REMOVE CONTENTEDITABLE FOR VISITORS =====================
  function guardAgainstVisitors() {
    // MutationObserver to instantly remove any contenteditable that appears without auth
    if (typeof MutationObserver === 'undefined') return;
    var obs = new MutationObserver(function(mutations) {
      if (editMode) return;
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType !== 1) return;
          if (node.getAttribute && node.getAttribute('contenteditable') === 'true') {
            node.removeAttribute('contenteditable');
            node.classList.remove('lbc-editable', 'lbc-link-editable');
          }
          if (node.querySelectorAll) {
            node.querySelectorAll('[contenteditable="true"]').forEach(function(el) {
              el.removeAttribute('contenteditable');
              el.classList.remove('lbc-editable', 'lbc-link-editable');
            });
          }
        });
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // ===================== ACTIVATE / DEACTIVATE =====================
  function activateEditMode() {
    editMode = true;
    document.body.classList.add('lbc-editor-active');
    document.getElementById('lbcSidebar').style.display = 'flex';
    document.getElementById('lbcTopBar').style.display = 'flex';
    document.getElementById('lbcCanvas').style.display = 'block';
    makeAllEditable();
    toast('وضع التحرير مفعّل — LBOCRAFT');
  }

  function deactivateEditMode() {
    editMode = false;
    document.body.classList.remove('lbc-editor-active');
    var sb = document.getElementById('lbcSidebar');
    var tb = document.getElementById('lbcTopBar');
    var cv = document.getElementById('lbcCanvas');
    if (sb) sb.style.display = 'none';
    if (tb) tb.style.display = 'none';
    if (cv) cv.style.display = 'none';
    removeAllEditable();
    dragEl = null;
    selectedEl = null;
  }

  // ===================== INIT =====================
  document.addEventListener('DOMContentLoaded', async function() {
    injectStyles();
    createSidebar();
    createTopBar();
    createCanvas();
    setupReorderDrop();
    guardAgainstVisitors();

    // Load edits from localStorage IMMEDIATELY (don't wait for cloud)
    ensureIds();
    loadEdits();

    // Cloud sync in background (non-blocking)
    fetchEditsFromCloud();

    // Click outside to deselect
    document.addEventListener('click', function(e) {
      if (!editMode) return;
      if (!e.target.closest('.lbc-editable') && !e.target.closest('.lbc-link-editable') &&
          !e.target.closest('.lbc-selected') && !e.target.closest('#lbcSidebar')) {
        document.querySelectorAll('.lbc-selected').forEach(function(s){ s.classList.remove('lbc-selected'); });
      }
    });

    // Only activate editor if authed + ?edit=true
    if (isAuth()) {
      var p = new URLSearchParams(window.location.search);
      if (p.get('edit') === 'true') {
        // Remove ?edit=true from URL for clean sharing (keep other params like ?id=)
        if (window.history && window.history.replaceState) {
          var cleanUrl = location.pathname;
          var params = new URLSearchParams(location.search);
          params.delete('edit');
          var remaining = params.toString();
          if (remaining) cleanUrl += '?' + remaining;
          window.history.replaceState({}, '', cleanUrl);
        }
        setTimeout(activateEditMode, 400);
      }
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'e') {
      e.preventDefault();
      if (!isAuth()) { toast('سجّل الدخول أولاً من لوحة التحكم'); return; }
      if (editMode) deactivateEditMode(); else activateEditMode();
    }
    if (editMode && e.ctrlKey && e.key === 's') {
      e.preventDefault();
      saveEdits();
    }
  });
})();
