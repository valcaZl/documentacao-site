/* =========================================================================
   config.js — repositório de origem, metadados e ícones
   ========================================================================= */
/* global window */

window.CONFIG = {
  repo: {
    owner: 'valcaZl',
    name: 'Documentacao',
    branch: 'main'
  },

  site: {
    title: 'Documentação',
    subtitle: 'Scripts, fontes dinâmicas e relatórios',
    description:
      'Guia prático e centralizado de scripts, casos de uso, funções utilitárias e ' +
      'tutoriais em BFC-Script e Groovy para desenvolvedores e analistas.'
  },

  /* tempo de vida do cache em sessão (ms) */
  cacheTTL: 30 * 60 * 1000,

  /* arquivos que o site sabe renderizar */
  renderable: {
    markdown: ['md', 'markdown', 'mdown', 'txt', ''],
    code: ['py', 'js', 'groovy', 'java', 'json', 'sql', 'sh', 'yml', 'yaml', 'xml', 'css', 'html'],
    image: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']
  },

  /* linguagem usada no realce quando o bloco não declara nenhuma */
  autoLanguages: ['groovy', 'python', 'json', 'bash', 'sql', 'xml'],

  /* apelidos de linguagem usados nos documentos */
  languageAliases: {
    'bfc-script': 'groovy',
    'bfc': 'groovy',
    'bfcscript': 'groovy'
  },

  /* metadados de apresentação das pastas de primeiro nível */
  categories: {
    'Arrecadação': {
      icon: 'receipt',
      description: 'Scripts e casos de uso de arrecadação tributária: extrações, integrações via API REST, CDA, habite-se e o pacote do TCE.'
    },
    'Contratos': {
      icon: 'file-signature',
      description: 'Automação de contratos e compras: exportação e exclusão de materiais, conversões e históricos de alteração.'
    },
    'Contábil': {
      icon: 'calculator',
      description: 'Rotinas contábeis: anulação de arrecadações, encerramento, equivalência contábil e integração de credores.'
    },
    'Funções': {
      icon: 'function',
      description: 'Funções utilitárias em Groovy para formatação de CPF/CNPJ, CEP, telefone, inscrição, valores e número por extenso.'
    },
    'Pessoal': {
      icon: 'users',
      description: 'Conteúdos técnicos da área de Pessoal.'
    },
    'Tutorias Básicos': {
      icon: 'graduation',
      description: 'Tutoriais de extensões: criar fonte dinâmica, mapas, múltiplas fontes, CSV, TXT e estruturas condicionais.'
    },
    'Utilidades JasperSoft': {
      icon: 'chart',
      description: 'Utilidades e dicas para a construção de relatórios no JasperSoft.'
    }
  }
};

/* ícones (SVG inline) ------------------------------------------------------ */
window.ICONS = {
  chevron: '<svg class="caret" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  folder: '<svg class="folder" viewBox="0 0 24 24"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h9A1.5 1.5 0 0 1 21 10v7.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/></svg>',
  doc: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
  docDot: '<svg class="doticon" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
  home: '<svg class="doticon" viewBox="0 0 24 24"><path d="M4 11.5 12 5l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/></svg>',
  code: '<svg viewBox="0 0 24 24"><path d="m9 17-5-5 5-5M15 7l5 5-5 5"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="m4 17 5-4.5 4.5 4 3-2.5L20 18"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  github: '<svg class="icon-filled" viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.93.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.85-2.34 4.7-4.57 4.94.36.31.68.92.68 1.85l-.01 2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2z"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10.5 13.5a4 4 0 0 0 5.66 0l2.83-2.83a4 4 0 0 0-5.66-5.66l-1.4 1.4"/><path d="M13.5 10.5a4 4 0 0 0-5.66 0L5 13.33a4 4 0 0 0 5.66 5.66l1.4-1.4"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  enter: '<svg viewBox="0 0 24 24"><path d="M20 6v5a3 3 0 0 1-3 3H5"/><path d="m9 10-4 4 4 4"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24"><path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9z"/><path d="M18.5 16.2 19.2 18l1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-13.7-5.2L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 13.7 5.2L20 16"/><path d="M20 20v-4h-4"/></svg>',
  alert: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16h.01"/></svg>',
  folderOpen: '<svg viewBox="0 0 24 24"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h9A1.5 1.5 0 0 1 21 10v7.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>',
  receipt: '<svg viewBox="0 0 24 24"><path d="M6 3.5h12v17l-2.5-1.6-2.5 1.6-2.5-1.6L8 20.5l-2 1.3z"/><path d="M9 8h6M9 12h6"/></svg>',
  'file-signature': '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/><path d="M14 3v5h5"/><path d="m21 8-6.5 6.5-3 .6.6-3L18.6 5.4a1.7 1.7 0 0 1 2.4 2.4z"/></svg>',
  calculator: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v3M8 18h4"/></svg>',
  function: '<svg viewBox="0 0 24 24"><path d="M14 4h-1.5A2.5 2.5 0 0 0 10 6.5V20"/><path d="M7 12h7"/><path d="m16 10 4 8M20 10l-4 8"/></svg>',
  users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.4"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6"/><path d="M17.5 14.6a5.5 5.5 0 0 1 3 4.9"/></svg>',
  graduation: '<svg viewBox="0 0 24 24"><path d="M12 4 2.5 8.5 12 13l9.5-4.5z"/><path d="M6.5 11v5c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3v-5"/><path d="M21.5 8.5V15"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path d="M4 20V4"/><path d="M4 20h16"/><rect x="7.5" y="12" width="3" height="5"/><rect x="13" y="8" width="3" height="9"/><rect x="18" y="14" width="3" height="3"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M5 4.5h9a4 4 0 0 1 4 4V19H8a3 3 0 0 0-3 3z"/><path d="M5 4.5V19"/></svg>'
};
