/* =========================================================================
   search.js — índice de busca em memória (títulos, caminhos e conteúdo)
   ========================================================================= */
/* global window, GH, MD */

(function () {
  'use strict';

  var index = [];
  var byPath = {};
  var loaded = {};
  var building = false;
  var progress = { done: 0, total: 0, ready: false };
  var listeners = [];

  /* dobra acentos preservando o comprimento (índices continuam alinhados) */
  function fold(str) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i);
      var n = c.normalize ? c.normalize('NFD').replace(/[̀-ͯ]/g, '') : c;
      out += (n.length ? n.charAt(0) : c).toLowerCase();
    }
    return out;
  }

  function notify() {
    listeners.forEach(function (fn) { fn(progress); });
  }

  function onProgress(fn) {
    listeners.push(fn);
    fn(progress);
  }

  /* ---------- construção ---------- */

  function upsert(file, text) {
    var entry = byPath[file.path];
    if (!entry) {
      entry = {
        path: file.path,
        title: file.title,
        kind: file.kind,
        isReadme: !!file.isReadme,
        category: file.path.indexOf('/') === -1 ? 'Raiz' : file.path.split('/')[0],
        folder: file.path.split('/').slice(0, -1).join(' / '),
        titleFold: fold(file.title),
        titleStarts: wordStarts(file.title),
        pathFold: fold(file.path.replace(/\//g, ' ')),
        pathStarts: wordStarts(file.path.replace(/\//g, ' ')),
        text: '',
        textFold: ''
      };
      byPath[file.path] = entry;
      index.push(entry);
    }

    if (text != null && !loaded[file.path]) {
      var plain = MD.toPlainText(text);
      if (plain.length > 40000) plain = plain.slice(0, 40000);
      entry.text = plain;
      entry.textFold = fold(plain);
      loaded[file.path] = true;
    }
    return entry;
  }

  /* registra todos os arquivos (busca por nome funciona antes do índice completo) */
  function seed(files) {
    files.forEach(function (f) { upsert(f, null); });
    return index.length;
  }

  function build(files) {
    if (building || progress.ready) return Promise.resolve(index);
    building = true;

    var targets = files.filter(function (f) { return f.kind === 'markdown' || f.kind === 'code'; });
    progress.total = targets.length;
    progress.done = 0;
    notify();

    var queue = targets.slice();
    var CONCURRENCY = 6;

    function worker() {
      var file = queue.shift();
      if (!file) return Promise.resolve();
      return GH.getText(file.path)
        .catch(function () { return ''; })
        .then(function (text) {
          upsert(file, text || '');
          progress.done += 1;
          notify();
          return worker();
        });
    }

    var workers = [];
    for (var i = 0; i < CONCURRENCY; i++) workers.push(worker());

    return Promise.all(workers).then(function () {
      building = false;
      progress.ready = true;
      notify();
      return index;
    });
  }

  /* ---------- consulta ---------- */

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildSnippet(entry, terms) {
    if (!entry.text) return '';

    var pos = -1, term = '';
    for (var i = 0; i < terms.length; i++) {
      var p = entry.textFold.indexOf(terms[i]);
      if (p !== -1 && (pos === -1 || p < pos)) { pos = p; term = terms[i]; }
    }
    if (pos === -1) return escapeHtml(entry.text.slice(0, 150)) + '…';

    var start = Math.max(0, pos - 70);
    var end = Math.min(entry.text.length, pos + term.length + 110);
    var slice = entry.text.slice(start, end);
    var sliceFold = entry.textFold.slice(start, end);

    /* marca todas as ocorrências dos termos dentro do trecho */
    var marks = [];
    terms.forEach(function (t) {
      var from = 0;
      while (true) {
        var at = sliceFold.indexOf(t, from);
        if (at === -1) break;
        marks.push([at, at + t.length]);
        from = at + t.length;
      }
    });
    marks.sort(function (a, b) { return a[0] - b[0]; });

    var html = '';
    var cursor = 0;
    marks.forEach(function (m) {
      if (m[0] < cursor) return;
      html += escapeHtml(slice.slice(cursor, m[0])) + '<mark>' + escapeHtml(slice.slice(m[0], m[1])) + '</mark>';
      cursor = m[1];
    });
    html += escapeHtml(slice.slice(cursor));

    return (start > 0 ? '…' : '') + html + (end < entry.text.length ? '…' : '');
  }

  function search(query, limit) {
    limit = limit || 30;
    var q = fold(String(query).trim());
    if (!q) return [];

    var terms = q.split(/\s+/).filter(Boolean);
    var results = [];

    index.forEach(function (entry) {
      var score = 0;
      var allMatch = true;

      terms.forEach(function (t) {
        var inTitle = entry.titleFold.indexOf(t);
        var inPath = entry.pathFold.indexOf(t);
        var inText = entry.textFold.indexOf(t);

        if (inTitle === -1 && inPath === -1 && inText === -1) { allMatch = false; return; }

        if (inTitle !== -1) score += inTitle === 0 ? 48 : 30;
        if (inPath !== -1) score += 10;
        if (inText !== -1) {
          score += 6;
          var count = entry.textFold.split(t).length - 1;
          score += Math.min(count, 8);
        }
      });

      if (!allMatch) return;

      if (entry.titleFold.indexOf(q) !== -1) score += 60;
      if (entry.titleFold === q) score += 120;
      score -= Math.min(entry.path.split('/').length, 5);

      results.push({ entry: entry, score: score });
    });

    results.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.title.localeCompare(b.entry.title, 'pt-BR');
    });

    return results.slice(0, limit).map(function (r) {
      return {
        path: r.entry.path,
        title: r.entry.title,
        folder: r.entry.folder,
        kind: r.entry.kind,
        snippet: buildSnippet(r.entry, terms)
      };
    });
  }

  /* =======================================================================
     busca por nome — tolera acentos e variações de plural/singular
     ("imóvel" encontra "Imóveis", "função" encontra "Funções")
     ======================================================================= */

  /* posições que iniciam uma palavra — inclusive em nomes camelCase
     ("formatarCpfCnpj" abre palavra em f, C e C) */
  function wordStarts(str) {
    var marks = {};
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i);
      if (!/[a-z0-9]/i.test(c)) continue;
      if (i === 0) { marks[i] = true; continue; }
      var prev = str.charAt(i - 1);
      if (!/[a-z0-9]/i.test(prev)) marks[i] = true;
      else if (/[a-z0-9]/.test(prev) && /[A-Z]/.test(c)) marks[i] = true;
    }
    return marks;
  }

  /* Casa o termo com o texto. O termo inteiro vale em qualquer posição;
     um prefixo dele (para tolerar plural/singular) só vale no começo de uma
     palavra — assim "contrato" acha "Contratos" mas não "encontrarDuplicatas". */
  function bestMatch(hay, starts, term) {
    var at = hay.indexOf(term);
    if (at !== -1) {
      return { start: at, end: at + term.length, ratio: 1, boundary: !!starts[at] };
    }
    if (term.length < 5) return null;

    var min = Math.max(4, Math.ceil(term.length * 0.6));
    for (var len = term.length - 1; len >= min; len--) {
      var piece = term.slice(0, len);
      var from = 0;
      var pos = hay.indexOf(piece, from);
      while (pos !== -1) {
        if (starts[pos]) return { start: pos, end: pos + len, ratio: len / term.length, boundary: true };
        from = pos + 1;
        pos = hay.indexOf(piece, from);
      }
    }
    return null;
  }

  function mergeRanges(ranges) {
    if (!ranges.length) return [];
    var sorted = ranges.slice().sort(function (a, b) { return a[0] - b[0]; });
    var out = [sorted[0]];
    for (var i = 1; i < sorted.length; i++) {
      var last = out[out.length - 1];
      if (sorted[i][0] <= last[1]) last[1] = Math.max(last[1], sorted[i][1]);
      else out.push(sorted[i]);
    }
    return out;
  }

  function matchesFilters(entry, opts) {
    if (opts.kind && opts.kind !== 'todos' && entry.kind !== opts.kind) return false;
    if (opts.category && opts.category !== 'todas' && entry.category !== opts.category) return false;
    return true;
  }

  function byName(query, opts) {
    opts = opts || {};
    var q = fold(String(query || '').trim());
    var terms = q ? q.split(/\s+/).filter(Boolean) : [];
    var out = [];

    index.forEach(function (entry) {
      if (!matchesFilters(entry, opts)) return;

      if (!terms.length) {
        out.push({ entry: entry, score: 0, ranges: [] });
        return;
      }

      var score = 0;
      var ranges = [];
      var ok = true;

      terms.forEach(function (term) {
        if (!ok) return;

        var inTitle = bestMatch(entry.titleFold, entry.titleStarts, term);
        if (inTitle) {
          score += 40 * inTitle.ratio + (inTitle.boundary ? 10 : 0) + (inTitle.start === 0 ? 8 : 0);
          ranges.push([inTitle.start, inTitle.end]);
          return;
        }
        var inPath = bestMatch(entry.pathFold, entry.pathStarts, term);
        if (inPath) { score += 12 * inPath.ratio; return; }

        ok = false;
      });

      if (!ok) return;
      if (entry.titleFold === q) score += 60;
      score -= entry.path.split('/').length;

      out.push({ entry: entry, score: score, ranges: mergeRanges(ranges) });
    });

    out.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.title.localeCompare(b.entry.title, 'pt-BR', { numeric: true });
    });

    if (opts.limit) out = out.slice(0, opts.limit);

    return out.map(function (r) {
      return {
        path: r.entry.path,
        title: r.entry.title,
        kind: r.entry.kind,
        category: r.entry.category,
        folder: r.entry.folder,
        isReadme: r.entry.isReadme,
        ranges: r.ranges
      };
    });
  }

  /* destaca no título os trechos que casaram com a busca */
  function highlight(title, ranges) {
    if (!ranges || !ranges.length) return escapeHtml(title);
    var html = '';
    var cursor = 0;
    ranges.forEach(function (r) {
      html += escapeHtml(title.slice(cursor, r[0])) + '<mark>' + escapeHtml(title.slice(r[0], r[1])) + '</mark>';
      cursor = r[1];
    });
    return html + escapeHtml(title.slice(cursor));
  }

  /* contagem por categoria, respeitando o filtro de tipo */
  function countByCategory(query, kind) {
    var counts = {};
    byName(query, { kind: kind, category: 'todas' }).forEach(function (r) {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });
    return counts;
  }

  window.Search = {
    seed: seed,
    build: build,
    byName: byName,
    highlight: highlight,
    countByCategory: countByCategory,
    total: function () { return index.length; },
    search: search,
    onProgress: onProgress,
    fold: fold,
    get progress() { return progress; }
  };
})();
