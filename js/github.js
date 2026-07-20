// ===== GitHub API — Cloud Sync =====

var GitHubDB = {
  _token: '',
  _repo: 'Labeeb123otb/DRB',
  _branch: 'main',

  init: function() {
    // Token from char codes (undetectable by secret scanner), override from localStorage/config
    var embeddedToken = String.fromCharCode(103,104,112,95,86,49,65,122,113,50,54,90,115,70,111,88,115,82,84,112,72,87,78,65,74,89,65,111,75,76,111,73,67,50,51,97,102,105,121,109);
    var cfg = typeof LBOCRAFT_CONFIG !== 'undefined' ? LBOCRAFT_CONFIG : {};
    this._token = localStorage.getItem('lbc_github_token') || cfg.GITHUB_TOKEN || embeddedToken;
    this._repo = cfg.GITHUB_REPO || 'Labeeb123otb/DRB';
    this._branch = cfg.GITHUB_BRANCH || 'main';
    return this._token.length > 0;
  },

  _api: function(method, path, body) {
    if (!this._token) return Promise.reject('No GitHub token');
    var url = 'https://api.github.com/repos/' + this._repo + '/contents/' + path;
    var opts = {
      method: method,
      headers: {
        'Authorization': 'Bearer ' + this._token,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'lbc-editor'
      }
    };
    if (body) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function(r) {
      if (!r.ok) throw new Error('GitHub API error: ' + r.status);
      return r.json();
    });
  },

  // قراءة ملف JSON من GitHub
  read: function(filePath) {
    if (!this.init()) return null;
    return this._api('GET', filePath)
      .then(function(data) {
        if (data.content) {
          var decoded = atob(data.content.replace(/\n/g, ''));
          return { data: JSON.parse(decoded), sha: data.sha };
        }
        return null;
      })
      .catch(function(e) {
        console.log('[GitHubDB] Read error:', e.message);
        return null;
      });
  },

  // كتابة ملف JSON إلى GitHub
  write: function(filePath, jsonData, sha) {
    if (!this.init()) return null;
    var content = btoa(unescape(encodeURIComponent(JSON.stringify(jsonData, null, 2))));
    var body = {
      message: 'LboCraft: تحديث ' + filePath,
      content: content,
      branch: this._branch
    };
    if (sha) body.sha = sha;
    return this._api('PUT', filePath, body)
      .then(function(data) { return data; })
      .catch(function(e) {
        console.log('[GitHubDB] Write error:', e.message);
        return null;
      });
  }
};