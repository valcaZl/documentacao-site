/* =========================================================================
   markdown.js — conversão de Markdown em HTML + enriquecimento do conteúdo
   ========================================================================= */
/* global window, document, marked, DOMPurify, hljs, CONFIG, ICONS, GH */

(function () {
  'use strict';

  var CFG = window.CONFIG;

  /* ---------- helpers ---------- */

  function stripDiacritics(str) {
    return str.normalize ? str.normalize('NFD').replace(/[̀-ͯ]/g, '') : str;
  }

  function slugify(text) {
    var base = stripDiacritics(String(text))
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    return base || 'secao';
  }

  function dirOf(path) {
    var parts = String(path).split('/');
    parts.pop();
    return parts.join('/');
  }

  /* resolve "../imagens/x.png" em relação à pasta do documento */
  function resolvePath(baseDir, relative) {
    var stack = baseDir ? baseDir.split('/') : [];
    relative.split('/').forEach(function (part) {
      if (!part || part === '.') return;
      if (part === '..') stack.pop();
      else stack.push(part);
    });
    return stack.join('/');
  }

  /* extrai o caminho interno de uma URL do próprio repositório */
  function internalPathFromUrl(url) {
    var owner = GH.repo.owner, name = GH.repo.name;
    var patterns = [
      new RegExp('^https?://github\\.com/' + owner + '/' + name + '/(?:blob|tree|raw)/[^/]+/(.+)$', 'i'),
      new RegExp('^https?://raw\\.githubusercontent\\.com/' + owner + '/' + name + '/[^/]+/(.+)$', 'i')
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = url.match(patterns[i]);
      if (m) {
        var p = m[1].split('?')[0].split('#')[0];
        try { p = decodeURIComponent(p); } catch (e) { /* mantém */ }
        return p;
      }
    }
    return null;
  }

  /* ---------- conversão ---------- */

  function toHtml(markdown) {
    marked.setOptions({
      gfm: true,
      breaks: false,
      headerIds: false,
      mangle: false,
      smartypants: false
    });
    var raw = marked.parse(markdown || '');
    return DOMPurify.sanitize(raw, {
      ADD_ATTR: ['target', 'rel', 'loading', 'decoding', 'align'],
      FORBID_TAGS: ['style', 'form', 'input', 'button'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick']
    });
  }

  /* ---------- enriquecimento pós-render ---------- */

  function decorateHeadings(root, docPath) {
    var toc = [];
    var used = {};
    var headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6');

    Array.prototype.forEach.call(headings, function (h) {
      var text = h.textContent.trim();
      var slug = slugify(text);
      if (used[slug]) { used[slug] += 1; slug = slug + '-' + used[slug]; }
      else { used[slug] = 1; }
      h.id = slug;

      var anchor = document.createElement('a');
      anchor.className = 'heading-anchor';
      anchor.href = '#' + window.App.routeFor(docPath, slug);
      anchor.setAttribute('aria-label', 'Link para esta seção');
      anchor.innerHTML = ICONS.link;
      h.insertBefore(anchor, h.firstChild);

      var level = parseInt(h.tagName.slice(1), 10);
      if (level >= 2 && level <= 4) toc.push({ id: slug, text: text, level: level });
    });

    return toc;
  }

  function languageLabel(lang) {
    if (!lang) return 'código';
    var pretty = { groovy: 'Groovy', python: 'Python', json: 'JSON', bash: 'Bash', sql: 'SQL', xml: 'XML', javascript: 'JavaScript' };
    return pretty[lang] || lang;
  }

  function decorateCode(root) {
    var blocks = root.querySelectorAll('pre > code');

    Array.prototype.forEach.call(blocks, function (code) {
      var pre = code.parentNode;
      if (!pre || pre.parentNode && pre.parentNode.classList.contains('code-block')) return;

      var declared = (code.className.match(/language-([\w+#-]+)/) || [])[1] || '';
      var lang = CFG.languageAliases[declared.toLowerCase()] || declared.toLowerCase();
      var source = code.textContent;
      var label;

      try {
        if (lang && window.hljs && hljs.getLanguage(lang)) {
          code.innerHTML = hljs.highlight(source, { language: lang, ignoreIllegals: true }).value;
          label = languageLabel(lang);
        } else if (window.hljs) {
          var auto = hljs.highlightAuto(source, CFG.autoLanguages);
          code.innerHTML = auto.value;
          label = declared ? languageLabel(declared) : languageLabel(auto.language);
        } else {
          label = languageLabel(declared);
        }
      } catch (e) {
        label = languageLabel(declared);
      }
      code.classList.add('hljs');

      var wrap = document.createElement('div');
      wrap.className = 'code-block';

      var head = document.createElement('div');
      head.className = 'code-block__head';
      head.innerHTML = '<span class="code-block__lang">' + label + '</span>';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy';
      btn.innerHTML = ICONS.copy + '<span>Copiar</span>';
      btn.addEventListener('click', function () {
        window.App.copyText(source).then(function (ok) {
          if (!ok) return;
          btn.classList.add('is-done');
          btn.innerHTML = ICONS.check + '<span>Copiado</span>';
          window.setTimeout(function () {
            btn.classList.remove('is-done');
            btn.innerHTML = ICONS.copy + '<span>Copiar</span>';
          }, 1600);
        });
      });
      head.appendChild(btn);

      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(head);
      wrap.appendChild(pre);
    });
  }

  function decorateTables(root) {
    Array.prototype.forEach.call(root.querySelectorAll('table'), function (table) {
      if (table.parentNode && table.parentNode.classList.contains('table-wrap')) return;
      var wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  function decorateImages(root, docPath) {
    var baseDir = dirOf(docPath);

    Array.prototype.forEach.call(root.querySelectorAll('img'), function (img) {
      var src = img.getAttribute('src') || '';
      if (!src) return;

      var internal = internalPathFromUrl(src);
      if (internal) {
        img.src = GH.rawUrl(internal);
      } else if (!/^(https?:|data:)/i.test(src)) {
        var decoded = src;
        try { decoded = decodeURIComponent(src); } catch (e) { /* mantém */ }
        img.src = GH.rawUrl(resolvePath(baseDir, decoded.replace(/^\.?\//, '')));
      }

      img.loading = 'lazy';
      img.decoding = 'async';
      if (!img.alt || img.alt === 'image alt') img.alt = 'Imagem da documentação';
      img.addEventListener('click', function () { window.App.openLightbox(img.src, img.alt); });
      img.addEventListener('error', function () {
        img.style.display = 'none';
      });
    });
  }

  function decorateLinks(root, docPath) {
    var baseDir = dirOf(docPath);

    Array.prototype.forEach.call(root.querySelectorAll('a'), function (a) {
      if (a.classList.contains('heading-anchor')) return;
      var href = a.getAttribute('href') || '';
      if (!href) return;

      /* âncora interna do próprio documento: mantém a rota atual */
      if (href.charAt(0) === '#') {
        a.setAttribute('href', '#' + window.App.routeFor(docPath, href.slice(1)));
        return;
      }

      var internal = internalPathFromUrl(href);
      if (!internal && !/^(https?:|mailto:|data:)/i.test(href)) {
        var decoded = href;
        try { decoded = decodeURIComponent(href.split('#')[0]); } catch (e) { decoded = href.split('#')[0]; }
        internal = resolvePath(baseDir, decoded.replace(/^\.?\//, ''));
      }

      if (internal && window.App.hasFile(internal)) {
        var hashAt = href.indexOf('#');
        var frag = hashAt > 0 ? href.slice(hashAt + 1) : '';
        a.setAttribute('href', '#' + window.App.routeFor(internal, frag));
        a.removeAttribute('target');
        return;
      }

      if (/^https?:/i.test(href)) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  /* remove o primeiro H1 e devolve seu texto (vira o título da página) */
  function extractTitle(root) {
    var first = root.firstElementChild;
    while (first && first.tagName === 'P' && !first.textContent.trim() && !first.querySelector('img')) {
      var next = first.nextElementSibling;
      first.parentNode.removeChild(first);
      first = next;
    }
    if (first && first.tagName === 'H1') {
      var text = first.textContent.trim();
      first.parentNode.removeChild(first);
      return text;
    }
    return null;
  }

  function enhance(root, docPath) {
    var title = extractTitle(root);
    var toc = decorateHeadings(root, docPath);
    decorateCode(root);
    decorateTables(root);
    decorateImages(root, docPath);
    decorateLinks(root, docPath);
    return { title: title, toc: toc };
  }

  /* texto simples a partir do markdown (usado pela busca) */
  function toPlainText(markdown) {
    return String(markdown || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^[>\s]*[-*+]\s+/gm, '')
      .replace(/[#*_~|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  window.MD = {
    toHtml: toHtml,
    enhance: enhance,
    slugify: slugify,
    stripDiacritics: stripDiacritics,
    toPlainText: toPlainText,
    internalPathFromUrl: internalPathFromUrl
  };
})();
