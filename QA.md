# Focused handmade polish acceptance — 2026-10-07

## Preserved scope

Original opening and celebration video/audio, four characters, room and envelope artwork, invitation and meeting-card geometry, bounded second-answer behavior, food-state logic and Olive dialogue sequence remain unchanged. No new questions, generated artwork, audio library or production debug UI were added.

## Changes

- Entry uses background-only study artwork without extra CSS blur. At 800 ms, first-line opacity was 0.563 and second-line opacity was 0; Come in appears last. Desktop 1440 × 900 and mobile 390 × 844 show crisp HTML typography and no horizontal scrolling. Come in starts the original video unmuted from zero.
- The decoded, already-mounted match envelope retains the 350 ms hold and 1100 ms handoff. Its starting placement is closer to the film envelope; a slight warm/darker correction avoids a pale overlay. The readable 28/22 px hint uses Whenever you’re ready. with the specified curly apostrophe.
- Existing staged invitation, centered celebration typography and approved schedule stationery are preserved. Food title precedes option rows; the five choices now end with We can decide later. The summary comparison is updated consistently; food choices use 30 px desktop / 23 px mobile type. A final typography-only spot check confirms the enlarged labels remain within the card.
- Olive remains the story bridge into the sealed private letter. The letter contains exactly the specified eight sections, ending in 你的, / Claire and 7/10-2026. Old One more thing. and See you soon. text is absent from the letter. Reveals begin after the paper settles at 2550 ms, staggered by 950 ms. No text is rewritten or appended.
- Local Kalam body text is 21 px desktop / 20 px mobile with increased line/paragraph spacing. Caveat and Ma Shan Zheng make the salutation and bilingual sign-off distinctly handwritten. All three fonts preload; publisher source links and complete OFL notices are included. Scrolling stays within the same cream paper.

## One focused desktop check — 1440×900

Entry, envelope, food and Olive-to-letter were checked once. The opening started at 0.01 seconds, unmuted and inline; audio decoding reached 41638 bytes. Only the final three seconds were sought for the envelope check, with no full opening or celebration replay. Real envelope-open and slide audio buffers started with durations 0.62/1.389 seconds and nonzero RMS 0.0346/0.0492; the same pair also played for the private letter. Original restrained gains remain 0.18/0.14.

At 600 ms on food, every option was invisible and disabled. The rows then appeared and We can decide later was selected normally. Actual dialogue clicks reached the sealed private letter. An early sample was [1, 0.99, 0, 0, 0, 0, 0, 0], proving the whole letter was not shown instantly. Final HTML text matched all eight exact sections. All handwriting fonts loaded, including the Chinese sign-off. The 577 px paper viewport supports a small internal scroll through 678 px of content to the full signature/date. No horizontal scrolling or console errors occurred.

## One mobile spot check — 390×844

A touch-enabled context checked entry, food choices, actual Olive taps and the sealed letter. The body rendered in Kalam at 20 px. Early paragraph sampling again showed only the first section and a partially fading second section. Internal paper scrolling reached the exact date, whose bottom was 674 px within the 697 px content boundary. No horizontal scrolling, page errors or asset HTTP errors occurred. No video replay was performed on mobile.

## Publication

Only the edited source/documents and six new font/license files are included in the public source checkout. Original masters, references, user images, screenshots, raw downloads and browser test shortcuts remain excluded. npm run build performs the final typecheck and production build. Published files are compared with that exact build after GitHub Pages finishes.
