# Quiet Folk

Live website: https://claire-13-huang.github.io/quiet-folk-site/

Editable source: https://github.com/claire-13-huang/quiet-folk-site

A private invitation for Colette, from the cinematic entry and original opening film through envelope, getaway invitation, celebration, meeting confirmation, food choice, itinerary note and a hidden personal letter. Choices stay in page state and are not transmitted or persisted after leaving the page.

## Development and publishing

Requires Node.js 20.19+ or 22.12+. Run `npm ci`, then `npm run dev`. The app is served under `/quiet-folk-site/`. `npm run build` runs TypeScript checks and creates the production build; `npm run preview` serves it locally.

The public main branch stores editable source, runtime media, package manifests and configuration. Each push runs GitHub Actions to install locked dependencies, build and publish only dist to GitHub Pages. The Vite base preserves the public address. No application secrets or environment variables are required. Original masters and reference artwork remain outside the public tree.

## Experience

Come in starts the inline opening video from zero with its unchanged embedded audio, while entry text fades and the initial blur clears. The final half-second introduces the existing sealed-envelope artwork as the bridge into the desk scene. The understated prompt opens the envelope; the card stays blank throughout extraction, then reveals the revised getaway invitation line by line. The second choice retains its bounded evasive behavior.

Two quiet CC0 paper recordings accompany envelope opening and card sliding. They preload, decode after the entry gesture and use the browser's native Web Audio API without an added library. A single audio owner stops paper sources before either video starts. Both videos keep their original embedded audio; leaving the tab pauses playback and Resume continues the same position. Source and reuse details are in AUDIO_SOURCES.md.

Celebration title timing follows video duration minus 4.5 seconds, with the second line 700 ms later and a final 300 ms fade. The video is unchanged. After its ending hold, a stable source frame from 10.9 seconds replaces the ended video for subsequent cards, with shallow blur, brightness 0.72 and a slow scale to 1.015. Portrait framing preserves all four faces.

Meeting and food retain the approved centered stationery geometry. Food heading and option rows reveal progressively. Selection shows the dessert line and proceeds after one second. The smaller itinerary note summarizes confirmed or flexible meeting time and selected food; Let's decide later resolves to We'll decide together ♡.

After 1.2 seconds, a small existing-style envelope peeks from behind the itinerary's lower-right edge. The summary stays until it is opened. The note moves to center and opens into an HTML letter, revealed paragraph by paragraph. A quiet See you soon. ♡ follows the signature. The letter supports contained scrolling when needed. No large ending message, extra question or Replay control is added.

Cormorant Garamond and EB Garamond are self-hosted with their SIL Open Font License notices and serif fallbacks. Visuals are existing artwork or direct frame extractions; no artwork is regenerated.

Acceptance evidence is recorded in QA.md. Screenshots, raw downloads and local tooling remain excluded from publication.
