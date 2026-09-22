/* =========================================================================
   github.js — acesso ao repositório (árvore de arquivos + conteúdo bruto)
   ========================================================================= */
/* global window, CONFIG */

(function () {
  'use strict';

  var repo = window.CONFIG.repo;
  var TTL = window.CONFIG.cacheTTL;

  var memory = { tree: null, files: {} };

  /* ---------- utilidades de caminho ---------- */

  function encodePath(path) {
    return String(path).split('/').map(encodeURIComponent).join('/');
  }

  function rawUrl(path) {
    return 'https://raw.githubusercontent.com/' + repo.owner + '/' + repo.name +
      '/' + repo.branch + '/' + encodePath(path);
  }

  function blobUrl(path) {
    return 'https://github.com/' + repo.owner + '/' + repo.name +
      '/blob/' + repo.branch + '/' + encodePath(path);
  }

  function extOf(name) {
    var i = name.lastIndexOf('.');
    return i > 0 ? name.slice(i + 1).toLowerCase() : '';
  }

  function baseName(path) {
    var parts = String(path).split('/');
    return parts[parts.length - 1];
  }

  function titleOf(path) {
    var name = baseName(path);
    var ext = extOf(name);
    if (ext) name = name.slice(0, -(ext.length + 1));
    return name.trim();
  }

  function kindOf(path) {
    var ext = extOf(baseName(path));
    var r = window.CONFIG.renderable;
    if (r.image.indexOf(ext) !== -1) return 'image';
    if (r.code.indexOf(ext) !== -1) return 'code';
    if (r.markdown.indexOf(ext) !== -1) return 'markdown';
    return 'other';
  }

  function isReadme(path) {
    return /^readme(\.[a-z]+)?$/i.test(baseName(path));
  }

  /* ---------- cache em sessão ---------- */

  function cacheGet(key) {
    try {
      var raw = window.sessionStorage.getItem(key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || Date.now() - obj.t > TTL) return null;
      return obj.v;
    } catch (e) { return null; }
  }

  function cacheSet(key, value) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value }));
    } catch (e) { /* cota cheia: segue sem cache */ }
  }

  /* ---------- árvore ---------- */

  function sortEntries(a, b) {
    var aReadme = a.type === 'file' && isReadme(a.path);
    var bReadme = b.type === 'file' && isReadme(b.path);
    if (aReadme !== bReadme) return aReadme ? -1 : 1;
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' });
  }

  function buildTree(entries) {
    var root = { type: 'dir', name: '', path: '', children: [] };
    var dirs = { '': root };

    function ensureDir(path) {
      if (dirs[path]) return dirs[path];
      var parts = path.split('/');
      var name = parts.pop();
      var parent = ensureDir(parts.join('/'));
      var node = { type: 'dir', name: name, path: path, children: [] };
      dirs[path] = node;
      parent.children.push(node);
      return node;
    }

    entries.forEach(function (entry) {
      if (entry.type === 'tree') { ensureDir(entry.path); return; }
      if (entry.type !== 'blob') return;

      var parts = entry.path.split('/');
      parts.pop();
      var parent = ensureDir(parts.join('/'));
      parent.children.push({
        type: 'file',
        name: baseName(entry.path),
        path: entry.path,
        ext: extOf(baseName(entry.path)),
        kind: kindOf(entry.path),
        title: titleOf(entry.path),
        size: entry.size || 0,
        isReadme: isReadme(entry.path)
      });
    });

    (function sortRec(node) {
      node.children.sort(sortEntries);
      node.children.forEach(function (c) { if (c.type === 'dir') sortRec(c); });
    })(root);

    return root;
  }

  /* lista ordenada (profundidade) apenas com arquivos exibíveis */
  function flatten(node, out) {
    out = out || [];
    node.children.forEach(function (child) {
      if (child.type === 'file') {
        if (child.kind !== 'other') out.push(child);
      } else {
        flatten(child, out);
      }
    });
    return out;
  }

  function countFiles(node) {
    var n = 0;
    node.children.forEach(function (c) {
      if (c.type === 'file') { if (c.kind !== 'other') n += 1; }
      else n += countFiles(c);
    });
    return n;
  }

  /* ---------- requisições ---------- */

  function httpError(res) {
    if (res.status === 403 || res.status === 429) {
      return new Error('RATE_LIMIT');
    }
    if (res.status === 404) return new Error('NOT_FOUND');
    return new Error('HTTP_' + res.status);
  }

  function getTree(force) {
    var key = 'doc:tree:' + repo.owner + '/' + repo.name + '@' + repo.branch;

    if (!force && memory.tree) return Promise.resolve(memory.tree);
    if (!force) {
      var cached = cacheGet(key);
      if (cached) {
        memory.tree = buildTree(cached);
        memory.tree.updatedAt = null;
        return Promise.resolve(memory.tree);
      }
    }

    var url = 'https://api.github.com/repos/' + repo.owner + '/' + repo.name +
      '/git/trees/' + encodeURIComponent(repo.branch) + '?recursive=1';

    return fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (res) {
        if (!res.ok) throw httpError(res);
        return res.json();
      })
      .then(function (data) {
        var entries = (data.tree || []).map(function (e) {
          return { path: e.path, type: e.type, size: e.size };
        });
        cacheSet(key, entries);
        memory.tree = buildTree(entries);
        return memory.tree;
      });
  }

  function getText(path) {
    if (memory.files[path] != null) return Promise.resolve(memory.files[path]);

    var key = 'doc:file:' + path;
    var cached = cacheGet(key);
    if (cached != null) { memory.files[path] = cached; return Promise.resolve(cached); }

    return fetch(rawUrl(path))
      .then(function (res) {
        if (!res.ok) throw httpError(res);
        return res.text();
      })
      .then(function (text) {
        memory.files[path] = text;
        cacheSet(key, text);
        return text;
      });
  }

  /* metadados do repositório (descrição, última atualização) */
  function getRepoInfo() {
    var key = 'doc:repo:' + repo.owner + '/' + repo.name;
    var cached = cacheGet(key);
    if (cached) return Promise.resolve(cached);

    return fetch('https://api.github.com/repos/' + repo.owner + '/' + repo.name)
      .then(function (res) {
        if (!res.ok) throw httpError(res);
        return res.json();
      })
      .then(function (data) {
        var info = {
          description: data.description,
          pushedAt: data.pushed_at,
          stars: data.stargazers_count,
          htmlUrl: data.html_url
        };
        cacheSet(key, info);
        return info;
      })
      .catch(function () { return null; });
  }

  function clearCache() {
    memory.tree = null;
    memory.files = {};
    try {
      var keys = [];
      for (var i = 0; i < window.sessionStorage.length; i++) {
        var k = window.sessionStorage.key(i);
        if (k && k.indexOf('doc:') === 0) keys.push(k);
      }
      keys.forEach(function (k) { window.sessionStorage.removeItem(k); });
    } catch (e) { /* ignora */ }
  }

  window.GH = {
    repo: repo,
    encodePath: encodePath,
    rawUrl: rawUrl,
    blobUrl: blobUrl,
    extOf: extOf,
    baseName: baseName,
    titleOf: titleOf,
    kindOf: kindOf,
    isReadme: isReadme,
    getTree: getTree,
    getText: getText,
    getRepoInfo: getRepoInfo,
    flatten: flatten,
    countFiles: countFiles,
    clearCache: clearCache
  };
})();
