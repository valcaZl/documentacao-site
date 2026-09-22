/* =========================================================================
   app.js — roteamento, navegação, renderização e busca
   ========================================================================= */
/* global window, document, localStorage, CONFIG, ICONS, GH, MD, Search */

(function () {
  'use strict';

  var CFG = window.CONFIG;
  var I = window.ICONS;

  function $(id) { return document.getElementById(id); }

  var els = {
    view: $('view'),
    content: $('content'),
    navTree: $('navTree'),
    sidebar: $('sidebar'),
    scrim: $('scrim'),
    toc: $('tocPanel'),
    tocList: $('tocList'),
    progress: $('progressBar'),
    palette: $('palette'),
    paletteInput: $('paletteInput'),
    paletteResults: $('paletteResults'),
    paletteState: $('paletteIndexState'),
    toast: $('toast'),
    repoStats: $('repoStats')
  };

  var state = {
    tree: null,
    files: [],
    byPath: {},
    dirNodes: {},
    current: '',
    headings: [],
    tocLinks: [],
    expanded: {},
    repoInfo: null,
    paletteItems: [],
    paletteSel: 0,
    indexStarted: false,
    searchQuery: '',
    searchKind: 'todos',
    searchCategory: 'todas',
    searchResults: []
  };

  var SEARCH_ROUTE = 'busca';
  var SUGGESTIONS = ['imóvel', 'CSV', 'API REST', 'contrato', 'CPF', 'relatório', 'habite-se', 'TCE'];

  /* =======================================================================
     utilidades
     ======================================================================= */

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return ''; }
  }

  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* ignora */ }
    return null;
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-on');
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(function () { els.toast.classList.remove('is-on'); }, 1900);
  }

  function copyText(text) {
    var done = function (ok) {
      toast(ok ? 'Copiado para a área de transferência' : 'Não foi possível copiar');
      return ok;
    };
    if (window.navigator.clipboard && window.isSecureContext) {
      return window.navigator.clipboard.writeText(text).then(function () { return done(true); })
        .catch(function () { return done(fallbackCopy(text)); });
    }
    return Promise.resolve(done(fallbackCopy(text)));
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function openLightbox(src, alt) {
    var box = document.createElement('div');
    box.className = 'lightbox';
    box.innerHTML = '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '" />';
    box.addEventListener('click', function () { box.remove(); });
    document.body.appendChild(box);
    var onKey = function (ev) {
      if (ev.key === 'Escape') { box.remove(); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);
  }

  /* =======================================================================
     tema
     ======================================================================= */

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    store('doc:theme', theme);
  }

  function initTheme() {
    var saved = store('doc:theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));
  }

  /* =======================================================================
     rotas
     ======================================================================= */

  function routeFor(path, section) {
    if (!path) return '/';
    var route = '/' + GH.encodePath(path);
    if (section) route += '#' + section;
    return route;
  }

  function parseHash() {
    var raw = window.location.hash.replace(/^#/, '');
    if (!raw || raw === '/') return { path: '', section: '', query: '' };

    var cut = raw.indexOf('#');
    var pathPart = cut === -1 ? raw : raw.slice(0, cut);
    var section = cut === -1 ? '' : raw.slice(cut + 1);

    var query = '';
    var qmark = pathPart.indexOf('?');
    if (qmark !== -1) {
      var params = pathPart.slice(qmark + 1);
      pathPart = pathPart.slice(0, qmark);
      params.split('&').forEach(function (pair) {
        var eq = pair.indexOf('=');
        if (eq !== -1 && pair.slice(0, eq) === 'q') {
          try { query = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' ')); }
          catch (e) { query = pair.slice(eq + 1); }
        }
      });
    }

    pathPart = pathPart.replace(/^\//, '');
    try { pathPart = decodeURIComponent(pathPart); } catch (e) { /* mantém */ }
    try { section = decodeURIComponent(section); } catch (e) { /* mantém */ }

    return { path: pathPart, section: section, query: query };
  }

  function navigate(path, section) {
    window.location.hash = routeFor(path, section);
  }

  /* =======================================================================
     navegação lateral
     ======================================================================= */

  function iconFor(file) {
    if (file.isReadme) return I.home;
    if (file.kind === 'image') return '<svg class="doticon" viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="m4 17 5-4.5 4.5 4 3-2.5L20 18"/></svg>';
    if (file.kind === 'code') return '<svg class="doticon" viewBox="0 0 24 24"><path d="m9 17-5-5 5-5M15 7l5 5-5 5"/></svg>';
    return I.docDot;
  }

  function labelFor(file) {
    return file.isReadme ? 'Visão geral' : file.title;
  }

  function fileLink(file) {
    var a = document.createElement('a');
    a.className = 'nav-link';
    a.href = '#' + routeFor(file.path);
    a.setAttribute('data-path', file.path);
    a.innerHTML = iconFor(file) + '<span>' + esc(labelFor(file)) + '</span>';
    a.title = file.path;
    return a;
  }

  function isExpanded(path, depth) {
    if (Object.prototype.hasOwnProperty.call(state.expanded, path)) return !!state.expanded[path];
    return depth === 0;
  }

  function renderNode(node, depth) {
    if (node.type === 'file') return fileLink(node);

    var group = document.createElement('div');
    group.className = 'nav-group';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-group__btn';
    btn.innerHTML = I.chevron + I.folder +
      '<span class="label">' + esc(node.name) + '</span>' +
      '<span class="count">' + GH.countFiles(node) + '</span>';

    var kids = document.createElement('div');
    kids.className = 'nav-children';

    var open = isExpanded(node.path, depth);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    kids.hidden = !open;

    node.children.forEach(function (child) { kids.appendChild(renderNode(child, depth + 1)); });

    btn.addEventListener('click', function () {
      var willOpen = kids.hidden;
      kids.hidden = !willOpen;
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      state.expanded[node.path] = willOpen;
      store('doc:expanded', state.expanded);
    });

    state.dirNodes[node.path] = { btn: btn, kids: kids };

    group.appendChild(btn);
    group.appendChild(kids);
    return group;
  }

  function searchNavLink() {
    var a = document.createElement('a');
    a.className = 'nav-link nav-link--search';
    a.href = '#' + searchRoute('');
    a.setAttribute('data-path', SEARCH_ROUTE);
    a.innerHTML = '<svg class="doticon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '<span>Pesquisar documentos</span>';
    return a;
  }

  function renderNav() {
    state.expanded = store('doc:expanded') || {};
    state.dirNodes = {};
    var frag = document.createDocumentFragment();
    frag.appendChild(searchNavLink());
    state.tree.children.forEach(function (node) { frag.appendChild(renderNode(node, 0)); });
    els.navTree.innerHTML = '';
    els.navTree.appendChild(frag);
  }

  function expandAncestors(path) {
    var parts = path.split('/');
    parts.pop();
    var acc = [];
    parts.forEach(function (part) {
      acc.push(part);
      var dir = state.dirNodes[acc.join('/')];
      if (dir && dir.kids.hidden) {
        dir.kids.hidden = false;
        dir.btn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  function setActiveLink(path) {
    Array.prototype.forEach.call(els.navTree.querySelectorAll('.nav-link'), function (a) {
      a.classList.toggle('is-active', a.getAttribute('data-path') === path);
    });
    if (path) expandAncestors(path);
  }

  function collapseAll() {
    Object.keys(state.dirNodes).forEach(function (key) {
      var dir = state.dirNodes[key];
      dir.kids.hidden = true;
      dir.btn.setAttribute('aria-expanded', 'false');
      state.expanded[key] = false;
    });
    store('doc:expanded', state.expanded);
  }

  function updateStats() {
    var docs = state.files.filter(function (f) { return f.kind === 'markdown'; }).length;
    var cats = state.tree ? state.tree.children.filter(function (n) { return n.type === 'dir'; }).length : 0;
    var updated = state.repoInfo && state.repoInfo.pushedAt ? formatDate(state.repoInfo.pushedAt) : '';
    els.repoStats.innerHTML =
      esc(docs + ' documentos · ' + cats + ' categorias') +
      (updated ? '<br />Atualizado em ' + esc(updated) : '') +
      ' <button class="chip-btn" id="refreshBtn" title="Buscar a versão mais recente no GitHub">atualizar</button>';

    var btn = $('refreshBtn');
    if (btn) {
      btn.addEventListener('click', function () {
        GH.clearCache();
        window.location.reload();
      });
    }

    var stat = $('statUpdated');
    if (stat && updated) stat.textContent = updated;
  }

  /* =======================================================================
     home
     ======================================================================= */

  function entryDocFor(dirNode) {
    var files = GH.flatten(dirNode);
    if (!files.length) return null;
    var readme = files.filter(function (f) { return f.isReadme; })[0];
    return readme || files[0];
  }

  function renderHome() {
    document.title = CFG.site.title + ' · ' + CFG.site.subtitle;
    state.current = '';

    var dirs = state.tree.children.filter(function (n) { return n.type === 'dir'; });
    var rootReadme = state.tree.children.filter(function (n) { return n.type === 'file' && n.isReadme; })[0];
    var docs = state.files.filter(function (f) { return f.kind === 'markdown'; }).length;
    var scripts = state.files.filter(function (f) { return f.kind === 'code'; }).length;
    var images = state.files.filter(function (f) { return f.kind === 'image'; }).length;

    var cards = dirs.map(function (dir) {
      var meta = CFG.categories[dir.name] || {};
      var icon = I[meta.icon] || I.folderOpen;
      var entry = entryDocFor(dir);
      var count = GH.countFiles(dir);
      return '' +
        '<a class="card" href="#' + esc(entry ? routeFor(entry.path) : '/') + '">' +
          '<span class="card__icon">' + icon + '</span>' +
          '<h3>' + esc(dir.name) + '</h3>' +
          '<p>' + esc(meta.description || 'Documentos técnicos desta área.') + '</p>' +
          '<span class="card__foot">' + I.doc + count + (count === 1 ? ' documento' : ' documentos') + '</span>' +
        '</a>';
    }).join('');

    var recentPaths = (store('doc:recent') || []).filter(function (p) { return state.byPath[p]; }).slice(0, 6);
    var quickTitle = recentPaths.length ? 'Visitados recentemente' : 'Comece por aqui';
    var quickFiles = recentPaths.length
      ? recentPaths.map(function (p) { return state.byPath[p]; })
      : dirs.map(entryDocFor).filter(Boolean).slice(0, 6);

    var quick = quickFiles.map(function (file) {
      return '' +
        '<a class="recent-item" href="#' + esc(routeFor(file.path)) + '">' +
          '<span class="recent-item__icon">' + I.doc + '</span>' +
          '<span class="recent-item__body">' +
            '<span class="recent-item__title">' + esc(file.isReadme ? file.path.split('/').slice(0, -1).join(' / ') || 'Visão geral do repositório' : file.title) + '</span>' +
            '<span class="recent-item__path">' + esc(file.path) + '</span>' +
          '</span>' +
          '<span class="recent-item__go">' + I.arrowRight + '</span>' +
        '</a>';
    }).join('');

    els.view.innerHTML = '' +
      '<section class="hero">' +
        '<span class="hero__badge">' + I.sparkles + 'Conteúdo sincronizado com o GitHub</span>' +
        '<h1>Documentação de <span class="grad">scripts e fontes dinâmicas</span></h1>' +
        '<p>' + esc(CFG.site.description) + '</p>' +
        '<div class="hero__actions">' +
          (rootReadme ? '<a class="btn btn--primary" href="#' + esc(routeFor(rootReadme.path)) + '">' + I.book + 'Ler a visão geral</a>' : '') +
          '<a class="btn btn--ghost" href="#' + esc(searchRoute('')) + '">' + I.search + 'Pesquisar documentos</a>' +
          '<a class="btn btn--ghost" href="https://github.com/' + esc(GH.repo.owner) + '/' + esc(GH.repo.name) + '" target="_blank" rel="noopener">' + I.github + 'Repositório</a>' +
        '</div>' +
        '<div class="stats">' +
          '<div class="stat"><div class="stat__num">' + docs + '</div><div class="stat__label">documentos</div></div>' +
          '<div class="stat"><div class="stat__num">' + dirs.length + '</div><div class="stat__label">categorias</div></div>' +
          '<div class="stat"><div class="stat__num">' + scripts + '</div><div class="stat__label">scripts</div></div>' +
          '<div class="stat"><div class="stat__num">' + images + '</div><div class="stat__label">imagens</div></div>' +
          '<div class="stat"><div class="stat__num" id="statUpdated" style="font-size:16px;padding-top:6px">' +
            esc(state.repoInfo && state.repoInfo.pushedAt ? formatDate(state.repoInfo.pushedAt) : '—') +
          '</div><div class="stat__label">última atualização</div></div>' +
        '</div>' +
      '</section>' +

      '<section>' +
        '<div class="section-title"><h2>Categorias</h2><p>' + dirs.length + ' áreas documentadas</p></div>' +
        '<div class="card-grid">' + cards + '</div>' +
      '</section>' +

      '<section>' +
        '<div class="section-title"><h2>' + esc(quickTitle) + '</h2><p>Atalhos rápidos</p></div>' +
        '<div class="recent-list">' + quick + '</div>' +
      '</section>';

    renderToc([]);
    window.scrollTo(0, 0);
    updateProgress();
  }

  /* =======================================================================
     tela de pesquisa
     ======================================================================= */

  function searchRoute(query) {
    return '/' + SEARCH_ROUTE + (query ? '?q=' + encodeURIComponent(query) : '');
  }

  function kindLabel(kind) {
    return { markdown: 'Documento', code: 'Script', image: 'Imagem' }[kind] || 'Arquivo';
  }

  function resultRow(item) {
    return '' +
      '<a class="sr-item" href="#' + esc(routeFor(item.path)) + '">' +
        '<span class="sr-item__icon">' + resultIcon(item.kind) + '</span>' +
        '<span class="sr-item__body">' +
          '<span class="sr-item__title">' + Search.highlight(item.title, item.ranges) + '</span>' +
          '<span class="sr-item__path">' + esc(item.folder || 'raiz do repositório') + '</span>' +
        '</span>' +
        '<span class="sr-item__tags">' +
          '<span class="sr-tag">' + esc(item.category) + '</span>' +
          '<span class="sr-tag sr-tag--soft">' + esc(kindLabel(item.kind)) + '</span>' +
        '</span>' +
        '<span class="sr-item__go">' + I.arrowRight + '</span>' +
      '</a>';
  }

  function contentRow(item) {
    return '' +
      '<a class="sr-item sr-item--content" href="#' + esc(routeFor(item.path)) + '">' +
        '<span class="sr-item__icon">' + I.search + '</span>' +
        '<span class="sr-item__body">' +
          '<span class="sr-item__title">' + esc(item.title) + '</span>' +
          '<span class="sr-item__snippet">' + item.snippet + '</span>' +
        '</span>' +
        '<span class="sr-item__go">' + I.arrowRight + '</span>' +
      '</a>';
  }

  function updateCategoryCounts() {
    var counts = Search.countByCategory(state.searchQuery, state.searchKind);
    var total = 0;
    Object.keys(counts).forEach(function (k) { total += counts[k]; });

    Array.prototype.forEach.call(els.view.querySelectorAll('[data-cat]'), function (chip) {
      var cat = chip.getAttribute('data-cat');
      var n = cat === 'todas' ? total : (counts[cat] || 0);
      var badge = chip.querySelector('.filter-chip__n');
      if (badge) badge.textContent = n;
      chip.classList.toggle('is-empty', n === 0 && cat !== 'todas');
      chip.classList.toggle('is-on', cat === state.searchCategory);
    });

    Array.prototype.forEach.call(els.view.querySelectorAll('[data-kind]'), function (chip) {
      chip.classList.toggle('is-on', chip.getAttribute('data-kind') === state.searchKind);
    });
  }

  function renderSearchResults() {
    var q = state.searchQuery.trim();
    var results = Search.byName(q, { kind: state.searchKind, category: state.searchCategory });
    state.searchResults = results;

    var countEl = $('srCount');
    if (countEl) {
      countEl.innerHTML = q
        ? '<strong>' + results.length + '</strong> ' + (results.length === 1 ? 'documento encontrado para' : 'documentos encontrados para') + ' <em>' + esc(q) + '</em>'
        : '<strong>' + results.length + '</strong> ' + (results.length === 1 ? 'documento disponível' : 'documentos disponíveis');
    }

    var listEl = $('srList');
    if (!listEl) return;

    if (results.length) {
      listEl.innerHTML = results.map(resultRow).join('');
    } else {
      var filtered = state.searchCategory !== 'todas' || state.searchKind !== 'todos';
      listEl.innerHTML = '' +
        '<div class="state">' + I.search +
          '<h2>Nenhum documento com esse nome</h2>' +
          '<p>Nada encontrado para <strong>' + esc(q) + '</strong> nos nomes dos arquivos' +
            (filtered ? ', com os filtros atuais' : '') +
          '. Tente um termo mais curto' + (filtered ? ' ou volte a ver todas as áreas.' : '.') + '</p>' +
          (filtered ? '<button type="button" class="btn btn--ghost" data-reset>' + I.refresh + 'Limpar filtros</button>' : '') +
        '</div>';
    }

    renderContentMatches(q, results);
    updateCategoryCounts();
  }

  function renderContentMatches(q, nameResults) {
    var box = $('srContent');
    if (!box) return;

    if (q.length < 2) { box.innerHTML = ''; return; }

    var taken = {};
    nameResults.forEach(function (r) { taken[r.path] = true; });

    var extra = Search.search(q, 40).filter(function (item) {
      if (taken[item.path]) return false;
      if (state.searchKind !== 'todos' && item.kind !== state.searchKind) return false;
      if (state.searchCategory !== 'todas') {
        var cat = item.path.indexOf('/') === -1 ? 'Raiz' : item.path.split('/')[0];
        if (cat !== state.searchCategory) return false;
      }
      return true;
    }).slice(0, 8);

    if (!extra.length) {
      box.innerHTML = Search.progress.ready ? '' :
        '<p class="sr-note">' + I.clock + 'Indexando o conteúdo dos documentos (' +
        Search.progress.done + '/' + Search.progress.total + ') para ampliar a busca…</p>';
      return;
    }

    box.innerHTML = '' +
      '<div class="section-title"><h2>Também aparece no conteúdo</h2>' +
        '<p>' + extra.length + ' ' + (extra.length === 1 ? 'documento cita' : 'documentos citam') + ' o termo</p></div>' +
      '<div class="sr-list">' + extra.map(contentRow).join('') + '</div>';
  }

  function applyQuery(value, updateInput) {
    state.searchQuery = value;
    var input = $('srInput');
    if (input && updateInput) input.value = value;

    var clear = $('srClear');
    if (clear) clear.hidden = !value;

    try {
      window.history.replaceState(null, '', '#' + searchRoute(value));
    } catch (e) {
      /* navegadores que bloqueiam replaceState: a URL apenas não acompanha */
    }
    document.title = (value ? 'Pesquisa: ' + value : 'Pesquisar documentos') + ' · ' + CFG.site.title;
    renderSearchResults();
  }

  function renderSearchPage(query) {
    state.current = SEARCH_ROUTE;
    state.searchQuery = query || '';
    setActiveLink(SEARCH_ROUTE);
    closeSidebar();
    renderToc([]);

    var cats = state.tree.children
      .filter(function (n) { return n.type === 'dir'; })
      .map(function (n) { return n.name; });

    var catChips = ['todas'].concat(cats).map(function (cat) {
      return '<button type="button" class="filter-chip' + (cat === state.searchCategory ? ' is-on' : '') + '" data-cat="' + esc(cat) + '">' +
        esc(cat === 'todas' ? 'Todas as áreas' : cat) +
        '<span class="filter-chip__n">0</span></button>';
    }).join('');

    var kindChips = [
      { id: 'todos', label: 'Todos os tipos' },
      { id: 'markdown', label: 'Documentos' },
      { id: 'code', label: 'Scripts' },
      { id: 'image', label: 'Imagens' }
    ].map(function (k) {
      return '<button type="button" class="filter-chip' + (k.id === state.searchKind ? ' is-on' : '') + '" data-kind="' + k.id + '">' +
        esc(k.label) + '</button>';
    }).join('');

    var suggestions = SUGGESTIONS.map(function (term) {
      return '<button type="button" class="sugg" data-term="' + esc(term) + '">' + esc(term) + '</button>';
    }).join('');

    els.view.innerHTML = '' +
      '<section class="searchpage">' +
        '<h1>Pesquisar documentos</h1>' +
        '<p class="searchpage__lead">Digite parte do nome do relatório, script ou tutorial. ' +
          'A busca ignora acentos e entende plural e singular — <em>imóvel</em> encontra <em>Imóveis</em>.</p>' +

        '<div class="bigsearch">' +
          I.search +
          '<input id="srInput" type="search" autocomplete="off" spellcheck="false" ' +
            'placeholder="Ex.: imóvel, CSV, API REST, contrato…" value="' + esc(state.searchQuery) + '" />' +
          '<button type="button" class="bigsearch__clear" id="srClear"' + (state.searchQuery ? '' : ' hidden') + ' aria-label="Limpar busca">' +
            '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
        '</div>' +

        '<div class="sugg-row"><span class="sugg-row__label">Sugestões:</span>' + suggestions + '</div>' +

        '<div class="filters">' +
          '<div class="filter-row">' + catChips + '</div>' +
          '<div class="filter-row">' + kindChips + '</div>' +
        '</div>' +

        '<div class="sr-head"><span id="srCount"></span></div>' +
        '<div class="sr-list" id="srList"></div>' +
        '<div id="srContent"></div>' +
      '</section>';

    var input = $('srInput');
    var debounce;

    input.addEventListener('input', function () {
      window.clearTimeout(debounce);
      var value = input.value;
      debounce = window.setTimeout(function () { applyQuery(value, false); }, 110);
    });

    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        window.clearTimeout(debounce);
        applyQuery(input.value, false);
        if (state.searchResults.length) navigate(state.searchResults[0].path);
      } else if (ev.key === 'Escape' && input.value) {
        ev.preventDefault();
        applyQuery('', true);
      }
    });

    $('srClear').addEventListener('click', function () {
      applyQuery('', true);
      input.focus();
    });

    els.view.querySelector('.searchpage').addEventListener('click', function (ev) {
      var target = ev.target.closest ? ev.target.closest('[data-cat], [data-kind], [data-term], [data-reset]') : null;
      if (!target) return;
      ev.preventDefault();

      if (target.hasAttribute('data-reset')) {
        state.searchCategory = 'todas';
        state.searchKind = 'todos';
        applyQuery(state.searchQuery, false);
        return;
      }
      if (target.hasAttribute('data-term')) {
        applyQuery(target.getAttribute('data-term'), true);
        input.focus();
        return;
      }
      if (target.hasAttribute('data-cat')) state.searchCategory = target.getAttribute('data-cat');
      else state.searchKind = target.getAttribute('data-kind');
      applyQuery(state.searchQuery, false);
    });

    ensureIndex();
    applyQuery(state.searchQuery, true);
    window.scrollTo(0, 0);
    updateProgress();
    if (window.matchMedia && !window.matchMedia('(max-width: 900px)').matches) input.focus();
  }

  /* =======================================================================
     documento
     ======================================================================= */

  function skeleton() {
    els.view.innerHTML = '' +
      '<div class="skeleton-doc">' +
        '<span class="title"></span>' +
        '<span class="w80"></span><span></span><span class="w65"></span>' +
        '<span class="block"></span>' +
        '<span class="w80"></span><span></span><span class="w65"></span>' +
      '</div>';
  }

  function breadcrumbs(path) {
    var parts = path.split('/');
    var html = '<a href="#/">Início</a>';
    var acc = [];
    parts.forEach(function (part, i) {
      acc.push(part);
      html += '<span class="sep">/</span>';
      if (i === parts.length - 1) {
        html += '<span class="current">' + esc(part) + '</span>';
      } else {
        html += '<span>' + esc(part) + '</span>';
      }
    });
    return '<nav class="breadcrumbs" aria-label="Trilha de navegação">' + html + '</nav>';
  }

  function docMeta(file) {
    var folder = file.path.split('/').slice(0, -1).join(' / ');
    var kindLabel = { markdown: 'Documento', code: 'Script', image: 'Imagem' }[file.kind] || 'Arquivo';
    return '' +
      '<div class="doc-meta">' +
        (folder ? '<span class="tag">' + I.folderOpen + esc(folder) + '</span>' : '') +
        '<span class="tag">' + I.doc + esc(kindLabel) + (file.ext ? ' · ' + esc(file.ext.toUpperCase()) : '') + '</span>' +
        '<a href="' + esc(GH.blobUrl(file.path)) + '" target="_blank" rel="noopener">' + I.github + 'Ver no GitHub</a>' +
        '<a href="' + esc(GH.rawUrl(file.path)) + '" target="_blank" rel="noopener">' + I.code + 'Arquivo bruto</a>' +
        '<a href="#" id="copyLink">' + I.link + 'Copiar link</a>' +
      '</div>';
  }

  function pager(file) {
    var idx = state.files.indexOf(file);
    if (idx === -1) return '';
    var prev = state.files[idx - 1];
    var next = state.files[idx + 1];
    var html = '';
    if (prev) {
      html += '<a class="pager__item" href="#' + esc(routeFor(prev.path)) + '">' +
        '<span class="pager__label">Anterior</span>' +
        '<span class="pager__title">' + esc(prev.isReadme ? prev.path.split('/').slice(0, -1).pop() || 'Visão geral' : prev.title) + '</span></a>';
    }
    if (next) {
      html += '<a class="pager__item is-next" href="#' + esc(routeFor(next.path)) + '">' +
        '<span class="pager__label">Próximo</span>' +
        '<span class="pager__title">' + esc(next.isReadme ? next.path.split('/').slice(0, -1).pop() || 'Visão geral' : next.title) + '</span></a>';
    }
    return html ? '<nav class="pager">' + html + '</nav>' : '';
  }

  function rememberVisit(path) {
    var list = store('doc:recent') || [];
    list = list.filter(function (p) { return p !== path; });
    list.unshift(path);
    store('doc:recent', list.slice(0, 12));
  }

  function shell(file, bodyHtml) {
    return breadcrumbs(file.path) +
      '<header class="doc-head"><h1 id="docTitle">' + esc(file.title) + '</h1>' + docMeta(file) + '</header>' +
      bodyHtml +
      pager(file);
  }

  function afterRender(file, section) {
    var link = $('copyLink');
    if (link) {
      link.addEventListener('click', function (ev) {
        ev.preventDefault();
        copyText(window.location.href);
      });
    }
    rememberVisit(file.path);
    state.headings = Array.prototype.slice.call(els.view.querySelectorAll('.prose h2, .prose h3, .prose h4'));
    if (section) {
      window.setTimeout(function () { scrollToSection(section); }, 40);
    } else {
      window.scrollTo(0, 0);
    }
    updateProgress();
  }

  function renderMarkdownDoc(file, text, section) {
    els.view.innerHTML = shell(file, '<article class="prose" id="prose"></article>');
    var prose = $('prose');
    prose.innerHTML = MD.toHtml(text);

    var result = MD.enhance(prose, file.path);
    var title = result.title || file.title;
    $('docTitle').textContent = title;
    document.title = title + ' · ' + CFG.site.title;

    renderToc(result.toc);
    afterRender(file, section);
  }

  function renderCodeDoc(file, text, section) {
    var lang = { py: 'python', js: 'javascript', groovy: 'groovy', java: 'java', json: 'json', sql: 'sql', sh: 'bash', yml: 'yaml', yaml: 'yaml', xml: 'xml', css: 'css', html: 'xml' }[file.ext] || '';
    var fence = '```' + lang + '\n' + text.replace(/```/g, '`​``') + '\n```';
    els.view.innerHTML = shell(file, '<article class="prose" id="prose"></article>');
    var prose = $('prose');
    prose.innerHTML = MD.toHtml(fence);
    MD.enhance(prose, file.path);
    document.title = file.title + ' · ' + CFG.site.title;
    renderToc([]);
    afterRender(file, section);
  }

  function renderImageDoc(file, section) {
    var url = GH.rawUrl(file.path);
    els.view.innerHTML = shell(file,
      '<article class="prose" id="prose"><p><img src="' + esc(url) + '" alt="' + esc(file.title) + '" loading="lazy" /></p></article>');
    var img = els.view.querySelector('img');
    if (img) img.addEventListener('click', function () { openLightbox(url, file.title); });
    document.title = file.title + ' · ' + CFG.site.title;
    renderToc([]);
    afterRender(file, section);
  }

  function renderDoc(path, section) {
    var file = state.byPath[path];
    state.current = path;
    setActiveLink(path);
    closeSidebar();

    if (!file) { renderMissing(path); return; }

    if (file.kind === 'image') { renderImageDoc(file, section); return; }

    skeleton();
    GH.getText(path)
      .then(function (text) {
        if (state.current !== path) return;
        if (file.kind === 'code') renderCodeDoc(file, text, section);
        else renderMarkdownDoc(file, text, section);
      })
      .catch(function (err) { renderError(err, path); });
  }

  /* =======================================================================
     estados de erro
     ======================================================================= */

  function renderMissing(path) {
    document.title = 'Documento não encontrado · ' + CFG.site.title;
    els.view.innerHTML = '' +
      '<div class="state">' + I.alert +
        '<h2>Documento não encontrado</h2>' +
        '<p>Não existe <code>' + esc(path) + '</code> no repositório. Ele pode ter sido movido ou renomeado.</p>' +
        '<a class="btn btn--primary" href="#/">' + I.arrowRight + 'Voltar ao início</a>' +
      '</div>';
    renderToc([]);
  }

  function renderError(err, path) {
    var message = err && err.message ? err.message : '';
    var title = 'Não foi possível carregar o conteúdo';
    var body = 'Verifique sua conexão e tente novamente.';

    if (message === 'RATE_LIMIT') {
      title = 'Limite da API do GitHub atingido';
      body = 'O GitHub permite 60 requisições por hora sem autenticação. Aguarde alguns minutos e recarregue a página — o conteúdo já visitado continua em cache.';
    } else if (message === 'NOT_FOUND') {
      title = 'Arquivo não encontrado';
      body = 'O arquivo ' + (path || '') + ' não está mais disponível no repositório.';
    }

    document.title = title + ' · ' + CFG.site.title;
    els.view.innerHTML = '' +
      '<div class="state">' + I.alert +
        '<h2>' + esc(title) + '</h2>' +
        '<p>' + esc(body) + '</p>' +
        '<button class="btn btn--primary" id="retryBtn">' + I.refresh + 'Tentar novamente</button>' +
      '</div>';

    var btn = $('retryBtn');
    if (btn) btn.addEventListener('click', function () { window.location.reload(); });
    renderToc([]);
  }

  /* =======================================================================
     índice da página (TOC) e rolagem
     ======================================================================= */

  function renderToc(toc) {
    if (!toc || !toc.length) {
      els.tocList.innerHTML = '';
      els.toc.classList.add('is-empty');
      state.tocLinks = [];
      return;
    }
    els.toc.classList.remove('is-empty');
    els.tocList.innerHTML = toc.map(function (item) {
      return '<a class="lvl-' + item.level + '" href="#' + esc(routeFor(state.current, item.id)) + '" data-id="' + esc(item.id) + '">' +
        esc(item.text) + '</a>';
    }).join('');
    state.tocLinks = Array.prototype.slice.call(els.tocList.querySelectorAll('a'));
  }

  function scrollToSection(id) {
    var target = document.getElementById(id);
    if (!target) return;
    var top = target.getBoundingClientRect().top + window.pageYOffset - 80;
    window.scrollTo({ top: top, behavior: 'smooth' });
  }

  function updateProgress() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var pct = max > 0 ? Math.min(100, (window.pageYOffset / max) * 100) : 0;
    els.progress.style.width = pct + '%';
  }

  function updateTocActive() {
    if (!state.tocLinks.length || !state.headings.length) return;
    var current = null;
    state.headings.forEach(function (h) {
      if (h.getBoundingClientRect().top <= 120) current = h.id;
    });
    if (!current) current = state.headings[0].id;
    state.tocLinks.forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('data-id') === current);
    });
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      updateProgress();
      updateTocActive();
      ticking = false;
    });
  }

  /* =======================================================================
     paleta de busca
     ======================================================================= */

  function ensureIndex() {
    if (state.indexStarted) return;
    state.indexStarted = true;
    Search.build(state.files);
  }

  function paletteStateText(progress) {
    if (!els.paletteState) return;
    if (progress.ready) els.paletteState.textContent = 'busca em todo o conteúdo';
    else if (progress.total) els.paletteState.textContent = 'indexando ' + progress.done + '/' + progress.total + '…';
    else els.paletteState.textContent = '';
  }

  function resultIcon(kind) {
    if (kind === 'image') return I.image;
    if (kind === 'code') return I.code;
    return I.doc;
  }

  function renderPaletteItems(items, groupLabel) {
    state.paletteItems = items;
    state.paletteSel = 0;

    if (!items.length) {
      var typed = els.paletteInput.value.trim();
      els.paletteResults.innerHTML = '' +
        '<div class="palette__empty">' +
          '<p>Nenhum documento encontrado' + (typed ? ' para <strong>' + esc(typed) + '</strong>' : '') + '.</p>' +
          '<a class="btn btn--ghost" href="#' + esc(searchRoute(typed)) + '" data-search-page>' +
            I.search + 'Abrir a tela de pesquisa</a>' +
        '</div>';
      var full = els.paletteResults.querySelector('[data-search-page]');
      if (full) full.addEventListener('click', closePalette);
      return;
    }

    els.paletteResults.innerHTML =
      (groupLabel ? '<div class="palette__group">' + esc(groupLabel) + '</div>' : '') +
      items.map(function (item, i) {
        return '' +
          '<a class="presult' + (i === 0 ? ' is-sel' : '') + '" href="#' + esc(routeFor(item.path)) + '" data-i="' + i + '">' +
            '<span class="presult__icon">' + resultIcon(item.kind) + '</span>' +
            '<span class="presult__body">' +
              '<span class="presult__title">' + esc(item.title) + '</span>' +
              '<span class="presult__path">' + esc(item.folder || 'raiz') + '</span>' +
              (item.snippet ? '<span class="presult__snippet">' + item.snippet + '</span>' : '') +
            '</span>' +
            '<span class="presult__enter">' + I.enter + '</span>' +
          '</a>';
      }).join('');

    Array.prototype.forEach.call(els.paletteResults.querySelectorAll('.presult'), function (el) {
      el.addEventListener('mousemove', function () {
        selectPaletteItem(parseInt(el.getAttribute('data-i'), 10));
      });
      el.addEventListener('click', function (ev) {
        ev.preventDefault();
        openResult(parseInt(el.getAttribute('data-i'), 10));
      });
    });
  }

  function selectPaletteItem(i) {
    if (i === state.paletteSel) return;
    state.paletteSel = i;
    Array.prototype.forEach.call(els.paletteResults.querySelectorAll('.presult'), function (el, idx) {
      el.classList.toggle('is-sel', idx === i);
      if (idx === i) {
        var box = els.paletteResults.getBoundingClientRect();
        var r = el.getBoundingClientRect();
        if (r.top < box.top) els.paletteResults.scrollTop -= (box.top - r.top) + 8;
        else if (r.bottom > box.bottom) els.paletteResults.scrollTop += (r.bottom - box.bottom) + 8;
      }
    });
  }

  function openResult(i) {
    var item = state.paletteItems[i];
    if (!item) return;
    closePalette();
    navigate(item.path);
  }

  function defaultPaletteItems() {
    var recent = (store('doc:recent') || []).filter(function (p) { return state.byPath[p]; }).slice(0, 5);
    var files = recent.length
      ? recent.map(function (p) { return state.byPath[p]; })
      : state.files.filter(function (f) { return f.isReadme; }).slice(0, 8);

    return {
      label: recent.length ? 'Visitados recentemente' : 'Visões gerais',
      items: files.map(function (f) {
        return {
          path: f.path,
          title: f.isReadme ? (f.path.split('/').slice(0, -1).join(' / ') || 'Visão geral do repositório') : f.title,
          folder: f.path,
          kind: f.kind,
          snippet: ''
        };
      })
    };
  }

  function runSearch(query) {
    if (!query.trim()) {
      var def = defaultPaletteItems();
      renderPaletteItems(def.items, def.label);
      return;
    }
    var results = Search.search(query, 30);
    renderPaletteItems(results, results.length + (results.length === 1 ? ' resultado' : ' resultados'));
  }

  function openPalette() {
    if (!els.palette.hidden) return;
    els.palette.hidden = false;
    document.body.style.overflow = 'hidden';
    els.paletteInput.value = '';
    var def = defaultPaletteItems();
    renderPaletteItems(def.items, def.label);
    els.paletteInput.focus();
    ensureIndex();
  }

  function closePalette() {
    els.palette.hidden = true;
    document.body.style.overflow = '';
  }

  /* =======================================================================
     menu móvel
     ======================================================================= */

  function openSidebar() {
    els.sidebar.classList.add('is-open');
    els.scrim.hidden = false;
    $('menuToggle').setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    els.sidebar.classList.remove('is-open');
    els.scrim.hidden = true;
    $('menuToggle').setAttribute('aria-expanded', 'false');
  }

  /* =======================================================================
     eventos
     ======================================================================= */

  function bindUI() {
    $('themeToggle').addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });

    $('searchTrigger').addEventListener('click', openPalette);
    $('searchTriggerMobile').addEventListener('click', openPalette);
    $('collapseAll').addEventListener('click', collapseAll);

    $('menuToggle').addEventListener('click', function () {
      if (els.sidebar.classList.contains('is-open')) closeSidebar();
      else openSidebar();
    });
    els.scrim.addEventListener('click', closeSidebar);

    Array.prototype.forEach.call(document.querySelectorAll('[data-close-palette]'), function (el) {
      el.addEventListener('click', closePalette);
    });

    var paletteFull = $('paletteFull');
    if (paletteFull) paletteFull.addEventListener('click', closePalette);

    var debounce;
    els.paletteInput.addEventListener('input', function () {
      window.clearTimeout(debounce);
      var value = els.paletteInput.value;
      if (paletteFull) paletteFull.setAttribute('href', '#' + searchRoute(value.trim()));
      debounce = window.setTimeout(function () { runSearch(value); }, 90);
    });

    els.paletteInput.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        selectPaletteItem(Math.min(state.paletteSel + 1, state.paletteItems.length - 1));
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        selectPaletteItem(Math.max(state.paletteSel - 1, 0));
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        openResult(state.paletteSel);
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        closePalette();
      }
    });

    document.addEventListener('keydown', function (ev) {
      var key = (ev.key || '').toLowerCase();
      var typing = /^(input|textarea|select)$/i.test((ev.target && ev.target.tagName) || '');

      if ((ev.ctrlKey || ev.metaKey) && key === 'k') {
        ev.preventDefault();
        if (els.palette.hidden) openPalette(); else closePalette();
        return;
      }
      if (key === '/' && !typing && els.palette.hidden) {
        ev.preventDefault();
        openPalette();
        return;
      }
      if (key === 'escape' && !els.palette.hidden) closePalette();
    });

    els.navTree.addEventListener('click', function (ev) {
      var link = ev.target.closest ? ev.target.closest('.nav-link') : null;
      if (link) closeSidebar();
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateProgress);
    window.addEventListener('hashchange', route);

    Search.onProgress(function (progress) {
      paletteStateText(progress);
      if (progress.ready && state.current === SEARCH_ROUTE) renderSearchResults();
    });
  }

  /* =======================================================================
     roteador + boot
     ======================================================================= */

  function route() {
    if (!state.tree) return;
    var r = parseHash();

    if (!r.path) {
      setActiveLink('');
      renderHome();
      return;
    }
    if (r.path === SEARCH_ROUTE) {
      if (state.current === SEARCH_ROUTE) applyQuery(r.query || '', true);
      else renderSearchPage(r.query);
      return;
    }
    if (r.path === state.current) {
      if (r.section) scrollToSection(r.section);
      return;
    }
    renderDoc(r.path, r.section);
  }

  function scheduleIndex() {
    var start = function () { ensureIndex(); };
    if (window.requestIdleCallback) window.requestIdleCallback(start, { timeout: 4000 });
    else window.setTimeout(start, 2500);
  }

  function init() {
    initTheme();
    bindUI();
    skeleton();

    GH.getTree()
      .then(function (tree) {
        state.tree = tree;
        state.files = GH.flatten(tree);
        state.files.forEach(function (f) { state.byPath[f.path] = f; });

        renderNav();
        Search.seed(state.files);
        updateStats();
        route();
        scheduleIndex();

        return GH.getRepoInfo();
      })
      .then(function (info) {
        if (!info) return;
        state.repoInfo = info;
        updateStats();
      })
      .catch(function (err) {
        els.navTree.innerHTML = '';
        els.repoStats.textContent = 'Falha ao carregar o índice.';
        renderError(err);
      });
  }

  /* API usada pelos outros módulos */
  window.App = {
    routeFor: routeFor,
    navigate: navigate,
    copyText: copyText,
    openLightbox: openLightbox,
    hasFile: function (path) { return !!state.byPath[path]; },
    openPalette: openPalette
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
