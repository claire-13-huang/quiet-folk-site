# Quiet Folk

Live website: https://claire-13-huang.github.io/quiet-folk-site/

Editable source repository: https://github.com/claire-13-huang/quiet-folk-site

A cinematic invitation for Colette. The existing opening film, interactive envelope, invitation and temporary “You said yes.” ending are preserved. No later scene is implemented. Answers are not stored or transmitted.

## Local development

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

Open the printed address under `/quiet-folk-site/`.

```sh
npm run typecheck
npm run build
npm run preview
```

## Source and publishing

The public repository's `main` branch contains `src/`, `public/media/`, package manifests, TypeScript/Vite configuration and `.github/workflows/pages.yml`. It stores editable source rather than copied build output.

Each push to `main` runs GitHub Actions: install locked dependencies, typecheck and build, then publish only `dist/` to GitHub Pages. Pages uses GitHub Actions as its publishing source. The Vite base is `/quiet-folk-site/`, preserving the existing public address. No secrets or environment variables are required.

## Media and interaction

`public/media/` contains the six runtime delivery assets. Original high-resolution artwork and reference sheets remain in the private archive and are not part of the public source tree. No visual assets were regenerated during this migration.

The opening video plays silently inline with a poster and preloading. Scene 02 images decode in advance. The envelope opens using layered imagery and card extraction; copy appears line by line. YES stays fixed. NO moves within the viewport for mouse and touch users; keyboard and reduced-motion users can decline normally.

The optional audio channels in `src/audio.ts` remain silent when no sound files are configured. Audio unlocks only after user interaction.

Verification evidence is summarized in QA.md. Local screenshots and tooling output are excluded from publication.
