# Painel de Treino — como publicar

Este é um projeto completo, pronto a publicar. Segue os passos consoante a
plataforma que preferires (ambas são gratuitas).

## Opção A — Vercel (mais simples, recomendada)

1. Cria uma conta em https://vercel.com (podes usar o GitHub para entrar).
2. Cria um repositório novo no GitHub e envia esta pasta para lá:
   ```
   git init
   git add .
   git commit -m "Painel de treino inicial"
   git branch -M main
   git remote add origin <URL_DO_TEU_REPOSITORIO>
   git push -u origin main
   ```
3. Em vercel.com, clica em "Add New Project", escolhe o repositório e clica
   em "Deploy". O Vercel deteta automaticamente que é um projeto Vite —
   não precisas de configurar nada.
4. Em ~1 minuto tens um URL tipo `painel-treino.vercel.app`.

## Opção B — Netlify (arrastar e largar, sem GitHub)

1. No teu computador, dentro desta pasta, corre:
   ```
   npm install
   npm run build
   ```
   Isto cria uma pasta `dist/` com o site já compilado.
2. Vai a https://app.netlify.com/drop e arrasta a pasta `dist/` para lá.
3. Pronto — tens logo um URL público.

## A correr localmente (para testares antes de publicar)

```
npm install
npm run dev
```
Abre o link que aparecer no terminal (normalmente http://localhost:5173).

## Estrutura

- `src/PainelTreino.jsx` — o dashboard todo (dados, gráficos, zonas de FC)
- `src/main.jsx` — só liga o dashboard à página
- `index.html` — página base
- Os teus dados de treino estão dentro de `PainelTreino.jsx`, na constante
  `SEED_RUNS` — podes editar diretamente ali, ou usar o botão de importar
  CSV/adicionar manualmente já incluído no site.
