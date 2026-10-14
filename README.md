# GL Móveis — catálogos e produtos

Site da GL Móveis com vitrine para clientes, oito catálogos em PDF, produtos de exemplo e painel administrativo.

**Site publicado:** https://gl-moveis-catalogos.wesleidecampos57.chatgpt.site  
**Painel:** https://gl-moveis-catalogos.wesleidecampos57.chatgpt.site/admin.html

## Estrutura

- `public/index.html`, `public/admin.html`, `public/css/` e `public/js/`: interface em HTML, CSS e JavaScript.
- `public/catalogos/`: PDFs compactados para leitura e download.
- `public/assets/images/`: imagens extraídas dos catálogos.
- `seed.json`: conteúdo inicial de marcas, catálogos, produtos e dados da empresa.
- `app/api/[[...path]]/route.ts`: API pública e operações do painel.
- `app/uploads/[file]/route.ts`: entrega dos arquivos enviados no painel.
- `db/schema.ts` e `drizzle/`: estrutura do banco D1. Arquivos enviados ficam no R2.

## Desenvolvimento

Requer Node.js 22.13 ou superior. Instale as dependências com `npm ci` e execute `npm run dev` ou `npm run build`. Para o painel funcionar no ambiente local, configure D1 e R2 conforme `.openai/hosting.json` e aplique a migração de `drizzle/`. O acesso administrativo da versão publicada usa a autenticação ChatGPT da hospedagem Sites e uma conta autorizada no servidor; fora desse ambiente, adapte essa autenticação antes de expor as rotas de escrita.

As alterações feitas no painel da hospedagem são armazenadas no D1/R2 e não modificam automaticamente este repositório. Este repositório contém a versão inicial publicada.
