# Quiet Folk

Live website: https://claire-13-huang.github.io/quiet-folk-site/

Editable source repository: https://github.com/claire-13-huang/quiet-folk-site

A cinematic invitation for Colette. The existing opening film, interactive envelope and invitation lead into the approved celebration video, then a meeting confirmation. No food question is implemented. Answers are not stored or transmitted.

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

`public/media/` contains the opening/scene assets and the H.264 celebration delivery video with its first-frame poster. Original high-resolution artwork and reference sheets remain outside the public source tree. No visual assets are regenerated. The opening file retains the existing web video stream and the original embedded AAC audio stream, both copied without re-encoding.

The opening waits on its poster for Enter. A click or tap starts the same inline video from zero with its original embedded audio, without a separate soundtrack. Playback restrictions keep the entry available for another gesture. Leaving the tab pauses playback; Resume continues the same video at its existing position. Device volume remains under the visitor’s control. Scene 02 images decode in advance. The envelope opens using layered imagery and card extraction; copy appears line by line. YES stays fixed. NO moves within the viewport for mouse and touch users; keyboard and reduced-motion users can decline normally.

The optional audio channels in `src/audio.ts` remain silent when no sound files are configured. Audio unlocks only after user interaction.

YES starts the already-preloaded celebration video with its original embedded AAC audio. Its HEVC master remains untouched; only the picture is converted to H.264 at 1920×1080, 30 fps, CRF 20 and yuv420p with faststart. The AAC stream is copied unchanged. The media owner in `src/audio.ts` pauses other sources before video playback, preventing overlapping audio and reserving the same rule for future sound channels.

Celebration text follows the video clock at duration minus 4.5 seconds and 700 ms later, then fades near the end. The actual final video frame remains mounted for 400 ms before becoming a shallow-focus background. The meeting card reuses the existing paper artwork and shows the exact airport/date confirmation. Its two choices give local selection feedback and remain on that card; no response is transmitted.

Portrait celebration framing contains the entire 16:9 picture, with a soft fill outside it. The title is centered above the portrait picture. The meeting card reuses the original invitation dimensions at each viewport and is centered horizontally and vertically over the held celebration frame.

Verification evidence is summarized in QA.md. Local screenshots and tooling output are excluded from publication.
