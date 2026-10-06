# Quiet Folk

Live website: https://claire-13-huang.github.io/quiet-folk-site/

Editable source repository: https://github.com/claire-13-huang/quiet-folk-site

A cinematic invitation for Colette. The existing opening film, interactive envelope and invitation lead into the approved celebration video, then meeting confirmation, food choice, a travel-note summary and the final farewell. Choices are kept in page state for the summary and are not transmitted or saved after leaving the page.

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

Celebration text follows the video clock at duration minus 4.5 seconds and 700 ms later, then fades near the end. The actual final video frame remains mounted for 400 ms before becoming a shallow-focus background. The meeting card reuses the existing paper artwork and shows the exact airport/date confirmation. Confirming saves the meeting choice; adjusting briefly shows the reassuring two-line response. Both lead to food choice, using the identical centered card geometry and celebration-room background.

Portrait celebration framing contains the entire 16:9 picture, with a soft fill outside it. The title is centered above the portrait picture. The meeting card reuses the original invitation dimensions at each viewport and is centered horizontally and vertically over the held celebration frame.

Verification evidence is summarized in QA.md. Local screenshots and tooling output are excluded from publication.

Food choice offers five text options, in two columns on desktop and one on mobile. Selection locks the choices, reveals the dessert line, then continues after one second. The summary combines the confirmed or flexible airport time with the selected first stop; choosing for her shows the exact personal alternative. After three seconds, the card fades away, the same final celebration frame gradually clears, and three centered farewell lines appear in sequence. No extra audio, media, question, form or Replay control is added.
