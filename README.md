# Portal de Documentação

Site estático que lê o repositório [valcaZl/Documentacao](https://github.com/valcaZl/Documentacao)
em tempo real e apresenta o conteúdo de cada arquivo em tela, no estilo dos portais de
documentação técnica (sidebar com a árvore de pastas, busca por atalho, índice da página,
tema claro/escuro).

Não há build, framework nem dependência instalada: são apenas HTML, CSS e JavaScript.
O conteúdo nunca fica desatualizado, porque é buscado direto do GitHub a cada visita.

## Como executar

Qualquer servidor estático serve. Com Python (já disponível na máquina):

```bash
python -m http.server 4173
```

Depois abra <http://localhost:4173>.

Durante o desenvolvimento, prefira o servidor sem cache — assim o navegador nunca
serve uma versão antiga dos arquivos editados:

```bash
python .claude/devserver.py 4174
```

Alternativa com Node:

```bash
npx serve .
```

> Abrir o `index.html` com dois cliques costuma funcionar, mas alguns navegadores
> restringem requisições feitas a partir de `file://`. Se a lista de documentos não
> carregar, use um dos comandos acima.

## Como publicar

Por ser 100% estático, basta enviar a pasta para qualquer hospedagem:

- **GitHub Pages** — suba os arquivos em um repositório e ative Pages na branch escolhida.
- **Netlify / Vercel / Cloudflare Pages** — arraste a pasta; não há comando de build.
- **Servidor interno (IIS, Apache, nginx)** — copie a pasta para o diretório publicado.

## Estrutura

```
index.html                 estrutura da página e carregamento das bibliotecas
assets/css/styles.css      design system (tokens, tema claro/escuro, layout, tipografia)
assets/js/config.js        repositório de origem, textos das categorias e ícones
assets/js/github.js        API do GitHub, árvore de arquivos e cache de sessão
assets/js/markdown.js      Markdown → HTML, realce de código, tabelas, imagens e links
assets/js/search.js        índice de busca em memória (título, caminho e conteúdo)
assets/js/app.js           rotas, navegação, páginas (início, documento, pesquisa) e paleta
.claude/launch.json        configuração do preview local
.claude/devserver.py       servidor estático sem cache, para desenvolvimento
```

## Recursos

- **Árvore de navegação** gerada automaticamente a partir das pastas do repositório,
  com contagem de documentos, seções recolhíveis e destaque do item atual.
- **Tela de pesquisa** (`#/busca`) — busca pelo **nome** do documento, com filtros por área
  e por tipo, contagem por categoria e destaque do trecho que casou. Detalhes em
  [Tela de pesquisa](#tela-de-pesquisa).
- **Busca rápida (`Ctrl` + `K` ou `/`)** por título, caminho e conteúdo completo, com trecho
  do texto encontrado em destaque. O índice é montado em segundo plano após o carregamento.
- **Renderização completa de Markdown**: tabelas, citações, listas, imagens e blocos de
  código com realce de sintaxe (Groovy, BFC-Script, Python, JSON, SQL…) e botão de copiar.
- **Outros formatos**: arquivos `.py` são exibidos como código e imagens (`.png`) abrem
  em tela cheia ao clicar.
- **Índice da página** à direita com rolagem sincronizada, além de navegação
  anterior/próximo ao fim de cada documento.
- **Links internos corrigidos**: referências para outros arquivos do repositório passam a
  navegar dentro do site, e imagens apontadas para `github.com/.../blob/...` são
  convertidas para o endereço que realmente renderiza.
- **Tema claro/escuro** com preferência salva no navegador e respeito ao tema do sistema.
- Endereço de cada documento é compartilhável (`#/Funções/formatarCEP.md`), inclusive
  com âncora de seção.

## Tela de pesquisa

Endereço: `#/busca` (ou `#/busca?q=imóvel` para já abrir com o termo pesquisado).
Chega-se a ela pelo item **Pesquisar documentos** no topo da barra lateral, pelo botão da
página inicial ou pelo rodapé da busca rápida.

A busca é feita **no nome do arquivo** e na pasta em que ele está:

- ignora acentos e maiúsculas — `imovel` encontra `Imóveis`;
- entende plural e singular — `imóvel` encontra `Imóveis - Filtro por Metragem`,
  `[PMX] - Listagem de Imóveis V2` e `Relatório de Imóveis (CSV)…`;
- reconhece nomes em camelCase — `cpf` encontra `formatarCpfCnpj`;
- aceita vários termos, que precisam aparecer todos (`csv imóvel`);
- só considera uma variação da palavra quando ela começa um nome, para não trazer
  coincidências no meio de outra palavra (`contrato` não traz `encontrarDuplicatas`).

Com o campo vazio, a tela lista os documentos disponíveis em ordem alfabética, servindo
também como catálogo. Os filtros de **área** e **tipo** (documento, script, imagem) mostram
quantos resultados existem em cada categoria e podem ser limpos com um clique.

Quando nenhum arquivo tem o termo no nome, a tela ainda exibe **“Também aparece no
conteúdo”** com os documentos que citam o termo no texto — útil para termos como `encoding`
ou `API REST`, que aparecem dentro dos scripts e não nos títulos.

Para mudar as sugestões exibidas abaixo do campo, edite `SUGGESTIONS` em
[`assets/js/app.js`](assets/js/app.js).

## Apontar para outro repositório

Edite `assets/js/config.js`:

```js
repo: {
  owner: 'valcaZl',
  name: 'Documentacao',
  branch: 'main'
}
```

No mesmo arquivo, `categories` define o ícone e a descrição exibidos no cartão de cada
pasta de primeiro nível da página inicial. Pastas sem configuração aparecem com um ícone
e um texto genéricos.

## Cache e limites da API

- A árvore de arquivos e os documentos já abertos ficam em `sessionStorage` por 30 minutos
  (ajustável em `cacheTTL`), então a navegação entre páginas é instantânea.
- O site faz apenas **duas** chamadas à API do GitHub por sessão (árvore + dados do
  repositório); o conteúdo dos arquivos vem de `raw.githubusercontent.com`, que não entra
  na cota. O limite anônimo da API é de 60 requisições por hora e, se for atingido, a tela
  explica o motivo.
- O botão **atualizar**, no rodapé da barra lateral, limpa o cache e recarrega o índice
  quando o repositório receber alterações novas.
