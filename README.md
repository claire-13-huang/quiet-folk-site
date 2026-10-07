# Quiet Folk

Live website: https://claire-13-huang.github.io/quiet-folk-site/

Editable source: https://github.com/claire-13-huang/quiet-folk-site

A private invitation for Colette, from the cinematic entry and original opening film through envelope, getaway invitation, celebration, meeting confirmation, food choice, itinerary note, an Olive dialogue and a private personal letter. Choices stay in page state and are not transmitted or persisted after leaving the page.

## Development and publishing

Requires Node.js 20.19+ or 22.12+. Run `npm ci`, then `npm run dev`. The app is served under `/quiet-folk-site/`. `npm run build` runs TypeScript checks and creates the production build; `npm run preview` serves it locally.

The public main branch stores editable source, runtime media, package manifests and configuration. Each push runs GitHub Actions to install locked dependencies, build and publish only dist to GitHub Pages. The Vite base preserves the public address. No application secrets or environment variables are required. Original masters and reference artwork remain outside the public tree.

## Experience

The restrained I made something for you, Colette. entry uses the existing artwork defocused behind a dark navy and amber treatment. Come in starts the inline opening video from zero with its unchanged embedded audio, while entry text fades and the initial blur clears. The final video frame holds for 350 ms; the already-mounted, decoded sealed-envelope artwork then moves into the desk scene over 1100 ms while the room crossfades underneath. The understated prompt opens the envelope; the card stays blank throughout extraction, then reveals the revised getaway invitation line by line. The second choice retains its bounded evasive behavior.

Two quiet CC0 paper recordings accompany envelope opening and card sliding. They preload, decode after the entry gesture and use the browser's native Web Audio API without an added library. A single audio owner stops paper sources before either video starts. Both videos keep their original embedded audio; leaving the tab pauses playback and Resume continues the same position. Source and reuse details are in AUDIO_SOURCES.md.

Celebration title timing follows video duration minus 4.5 seconds, with the second line 700 ms later and a final 300 ms fade. The video is unchanged. After its ending hold, a stable source frame from 10.9 seconds replaces the ended video for subsequent cards, with shallow blur, brightness 0.72 and a slow scale to 1.015. Portrait framing preserves all four faces.

Meeting and food retain the approved centered stationery geometry. Food heading and option rows reveal progressively. Selection shows the dessert line and proceeds after one second. The smaller itinerary note summarizes confirmed or flexible meeting time and selected food; We can decide later resolves to We'll decide together ♡.

After a three-second itinerary pause, the summary fades away and the camera moves gently toward Olive over 1.4 seconds. A translucent, old-gold-edged dialogue box advances through three lines by click or tap. After the last line, Olive reveals a small sealed envelope with a muted burgundy wax seal. Opening it fades the dialogue, recenters the room and moves the envelope to center; the seal releases, the paper opens and an HTML letter slides out, revealed in eight sections: Dear Colie, three personal paragraphs, I MISS U ❤️, the closing sentence, 你的, / Claire and 7/10-2026. No additional ending copy is appended. The letter supports contained scrolling when needed. No large ending message, extra question or Replay control is added.

The private letter uses larger Kalam handwritten-print body text, Caveat for the salutation and English signature, and a small Ma Shan Zheng subset for the Chinese sign-off. These fonts preload to avoid a late typography change; notices and sources are recorded in FONT_SOURCES.md. Cormorant Garamond and EB Garamond are self-hosted with their SIL Open Font License notices and serif fallbacks. Visuals are existing artwork or direct frame extractions; no artwork is regenerated.

Acceptance evidence is recorded in QA.md. Screenshots, raw downloads and local tooling remain excluded from publication.
