# Targeted Olive ending acceptance — 2026-10-07

## Scope and preserved behavior

Only entry treatment, Scene 01 handoff, envelope hint and summary-to-private-letter ending changed. Opening and celebration runtime MP4s, their embedded audio, paper recordings, private-letter copy, meeting/invitation geometry and food-selection logic remain unchanged. No generated artwork, new dependency, production shortcut or additional question was introduced.

## Runtime acceptance

- Desktop 1440×900: the entry has restrained For Colette, delayed I made something for you., and Come in, with no recognizable character. The entry gesture started the inline opening at the beginning, unmuted. Only the final three seconds were sought for handoff testing; no full opening or celebration replay was performed.
- At video end, the actual measured hold before the anchor appeared was 382 ms. The exact sealed image was already mounted and decoded. A 20 ms monitor found no undecoded visible anchor and no opacity gap throughout the film-to-desk transition. The room remained behind both layers. Visual screenshots showed the held final frame, receiving envelope and settled desk.
- The handoff uses 350 ms hold plus 1100 ms movement/crossfade, then enables envelope interaction. The hint is 28 px desktop / 22 px mobile, warm ivory and close to the envelope.
- A browser-only state jump populated the existing itinerary. After three seconds, it faded away; a 1.4-second restrained pan/zoom and reduced blur brought attention to Olive, retaining the room and other characters. The dialogue appeared after camera motion. Both dialogue clicks yielded the exact second and third lines. The old summary-side note is absent. The wax-sealed envelope appeared only after the last dialogue and stayed clear of the dialogue box.
- Clicking the sealed letter removed the dialogue, recentered the background and moved/opened the envelope before the letter slid out. The existing eight HTML paragraphs reveal at 650 ms intervals, with See you soon. ♡ one second after the signature. Early sampling showed only the first paragraph and a partially fading second paragraph; the remaining paragraphs were invisible. Final sampling confirmed all paragraphs and farewell visible.
- One mobile check at 390×844 used a touch-enabled Chromium context. Actual taps advanced all three dialogue lines and opened the sealed letter. The dialogue bounds were x20–370 and stayed in the viewport. During envelope movement its opacity was 1, height 172 px and the wax seal remained 98 px below the envelope top. Contained letter scrolling reached the signature and farewell inside the paper. No horizontal scrolling or page errors occurred.

## Corrections within this pass

Static review caught the dialogue animation overriding CSS centering and a zero-height envelope affecting wax-seal placement; both were corrected before visual acceptance. A moving-envelope screenshot exposed an opacity transition ending prematurely; its duration is now explicitly 1.9 seconds and the visible moving envelope was rechecked on mobile and desktop. The initial mobile automation context lacked touch support; it was replaced with a touch-enabled context. These targeted corrections did not replay either complete video. Preload links use the production base explicitly, avoiding development-path duplication.

## Publication

Build and deployment use the editable public source checkout and the existing GitHub Pages workflow. Browser state jumps, screenshots, original source media and local tools are excluded from publication. Live verification compares published files with the exact production build.
