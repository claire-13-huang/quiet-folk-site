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

## Explore Room acceptance — 2026-10-09

Implementation acceptance was completed locally before publication. Checkpoint `f3e507d` preserves the invitation source and the four supplied room images before feature changes. Unrelated untracked artwork and analytics-worker files were left in place. Original audio, letter text and analytics implementation were not changed by this feature.

Production builds pass TypeScript and Vite compilation. The room is emitted as a separate lazy bundle; fresh entry requests contain neither the room bundle nor its four PNGs. The renderer starts only behind the final letter. The four production PNGs are byte-identical to the supplied originals.

Chromium ran the actual opening video, invitation, Yes, celebration video, confirmed meeting, sushi choice, Olive dialogue, final letter and room handoff. WebKit with iPhone 15 emulation ran the same flow with the adjust-meeting and decide-food-later branches, entered the room without fullscreen, rotated between 844×390 and 390×844, and tapped a character inspection and its Close action. The mobile landscape envelope position was corrected because the existing dialogue covered its tap target.

Desktop assertions cover drag/look, wheel dolly, stationery inspection, long-hold grab/move/drop, Cmd+Z, Ctrl+Z, reset and rereading the letter without creating another canvas. The background-music element remains the same, playing with a continuously advancing time across the letter and room transitions.

A separate browser harness loads the actual room module and uses Chromium native touch input with iPhone emulation. Assertions cover one-finger look, pinch, pinch-to-single-finger continuation, tap inspection, long-hold movement/drop, exact transform restoration on undo and canvas disposal on abort. Final geometry and placement were visually inspected: paper stays above its placement surface, floor and ceiling cover vertical views, and timber uprights conceal reference joins. The scene remains a compact projection assembled from non-panoramic references; image perspective is not a mathematically exact reconstruction.

Screenshots and automation scripts are local under ignored `output/playwright/`. WebKit emulation is engine-level evidence, not a physical iPhone device measurement. Existing font/preload warnings and the lazy-bundle size advisory do not prevent the checked flows.

Forced WebGL context loss after a successful touch move shows the in-page retry. Retrying creates one fresh canvas and clears old inspection/history controls; unmounting removes that canvas. The retry path and the same-module abort cleanup both passed live browser assertions.
