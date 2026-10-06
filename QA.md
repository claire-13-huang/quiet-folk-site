# Acceptance — 2026-10-07

## Scope and source

Preserve the opening film, envelope and invitation. Replace the temporary YES screen with the approved celebration video and explicit meeting confirmation. The remaining food-choice, final-summary and ending flow is now implemented as documented below. No new artwork is implemented. Answers remain local to the current page.

The public main branch stores editable Vite/React/TypeScript source. GitHub Actions builds and publishes only dist. Vite base: `/quiet-folk-site/`. Production address: https://claire-13-huang.github.io/quiet-folk-site/

## Media integrity

The supplied master is `庆祝视频.mp4`: HEVC, 1920×1080, 30 fps, 11.7 seconds, embedded stereo AAC. It remains unchanged, SHA-256 `64cc11718ac15076f49cc26322eabf8f9c221b5b2f10ea56dbee9e562df0609c`.

The separate `public/media/celebration-web.mp4` uses H.264, 1920×1080, 30 fps, yuv420p, CRF 20, slow preset and faststart (moov precedes mdat). Its 351 frames preserve the source duration. The AAC stream was copied without re-encoding; source and delivery audio stream SHA-256 both equal `87ab1fb1cd7d5b914720646361973cdc936ab10f00ad0bcee006bdaaabdf0969`.

The poster is the source video's first frame, extracted for immediate playback fallback. All sixteen earlier supplied originals remain unchanged. The existing opening runtime file is unchanged in this update.

## Playback and transitions

Enter and YES call play directly within their user gestures on already-mounted inline video elements, starting at zero, unmuted, volume 0.85. A single media owner pauses other sources before playback. No additional music or audio element is added. Scene 01 finishes naturally before its handoff.

Celebration preloads before YES. The invitation exits over 280 ms with a slight scale change; celebration fades underneath from approximately 200 to 600 ms. Subtitles use the video clock at duration minus 4.5 seconds and 700 ms later, with an 800 ms line-level fade and 10 px rise, fading during the last 300 ms. The actual ended video stays mounted, holds for 400 ms, then gradually blurs to 5 px on mobile or 6 px on desktop, dims to 0.76 or 0.74, and scales to 1.01.

The meeting card reuses the existing botanical paper and exact date/airport copy. Its choices provide local selection feedback before advancing through the remaining flow described below. Portrait playback contains the entire picture, with a soft fill outside it. The cinematic title is centered in the upper safe area. The meeting card reuses the original invitation geometry and paper at each viewport, centered on both axes.

Leaving the tab pauses both videos, including pending playback. Returning requires Resume and keeps the existing video position and subtitle clock. Rejected playback keeps the poster visible and offers another user gesture; no silent autoplay fallback is used.

## Earlier integration verification (before targeted layout correction)

Production build and TypeScript checks passed. Complete natural opening-with-audio → envelope → invitation → YES → celebration-with-audio → timed subtitles → meeting confirmation passed at 390×844, 430×932 and 1440×900. Both mobile sizes used actual Playwright touch taps; desktop used mouse clicks.

Before YES, celebration readyState was 4 and all 11.7 seconds were buffered. Play was invoked with user activation, time zero and muted false for both videos. A test-only Chromium audio analyser measured nonzero output from both embedded soundtracks; no analyser exists in production. A 20 ms monitor found no overlapping active audio sources. Celebration started in approximately 13–17 ms. The invitation was removed by 350 ms. The final frame hold measured approximately 402–412 ms.

The early celebration had no visible text. Both exact subtitle lines appeared after their scheduled times. All meeting copy and both choices were usable and stayed within the viewport. No horizontal scrolling, HTTP asset failures, page errors or console errors occurred. Transition, early celebration, subtitle and meeting screenshots were visually inspected at all three sizes.

Native WebKit with iPhone 15 emulation passed the complete touch flow, enabled embedded audio, playsInline and no fullscreen takeover. Pausing celebration on pagehide preserved time; Resume continued rather than restarting. Native WebKit was checked without inserting an audio analyser into its playback path.

Injected NotAllowedError and interruption during a pending celebration start both retained a paused poster with no early subtitles, then completed celebration and meeting after another gesture, unmuted and without overlap. Existing opening zero-volume and blocked-playback fallback checks also passed in the preceding audio acceptance.

Physical iPhone hardware, its mute switch and physical speakers were not tested. Browser audio output and Safari/WebKit playback behavior were verified through the tests above. Artistic preferences for caption placement and the final shallow-focus strength remain visual judgments.

## Targeted layout correction

The meeting card now uses the original invitation width, height and paper, with its center at the viewport center. Typography and spacing fit within that unchanged shell; no separate flat or bottom-aligned card remains. Its entrance uses opacity, scale 0.97 to 1 and a 12 px rise over 800 ms.

Celebration title timing follows loaded video duration: first line at duration minus 4.5 seconds, second 700 ms later, fade out over the final 300 ms. The centered desktop title uses the existing elegant serif, maximum width 850 px, main font clamp(42 px, 5 vw, 76 px) and smaller secondary copy. Mobile places the title above the complete contained picture. Audio, media files, opening scene, envelope and YES/NO behavior were not modified by this correction.

One targeted desktop check at 1440×900 and one mobile check at 390×844 passed for this correction, bypassing the opening film and seeking celebration to its final six seconds. No production debugging entry is added.

Measured original/meeting shells match exactly: 760×410.8 px on desktop and 358×438 px on mobile. Meeting centers equal viewport centers. Both title lines were fully visible around video time 9 seconds. No page/console errors or horizontal scrolling occurred. The initial mobile meeting screenshot exposed hidden background characters; the same final video frame now moves gently to the upper area in that state, retaining all faces above the centered card. Only that failed mobile screenshot was rechecked.

## Remaining flow acceptance — 2026-10-07

Only App.tsx and scene-specific CSS change the experience. Scene 01, envelope opening, original invitation, YES/NO, video files, embedded audio and the approved meeting card appearance remain unchanged. No new dependencies, assets, forms, food photos, restaurant cards, debugging UI or architecture layer is introduced.

Meeting YES stores meetingConfirmed=true and advances to food-choice. Adjusting displays the exact two-line reassurance for 1.2 seconds, then advances with meetingConfirmed=false. Food selection stores foodChoice, disables further selection, reveals the exact dessert line, then advances after one second. The summary shows the requested date, confirmed or flexible airport time and food choice; You choose for me resolves to the requested personal alternative. It holds three seconds before ending.

Food and summary use the same paperEnd geometry, paper artwork, centered position and shallow-focus celebration final frame as meeting confirmation. Desktop uses two food columns, mobile one. Ending fades the card over 800 ms, clears background blur over 1.25 seconds, retains the same video/frame and reveals its three exact lines at 700, 1400 and 2300 ms. No Replay control is included.

One direct state-jump visual check at 1440×900 and one at 390×844 passed without replaying either film. The state jump existed only in browser test code. Confirmed/Japanese and adjusted/You choose for me paths both produced the correct summaries. Food shells matched meeting shells exactly (760×410.8 and 358×438 px). Dessert appeared, summary held approximately 3007–3010 ms, all ending lines reached full opacity, no card remained and the background reached blur(0px) brightness(1). Screenshots of food, summary and ending were visually inspected at both sizes. No page/console/HTTP errors, horizontal scrolling or active audio occurred in these tail checks.

One final complete natural 390×844 touch run passed from Enter through both full videos, envelope, first invitation, NO, YES, meeting confirmation, Cha chaan teng, summary and ending. Both video starts were unmuted at zero within real user activation. The only two play calls belonged to the existing videos; no overlapping audio was observed. Summary held 3008 ms. Ending text began appearing at approximately 727, 1428 and 2326 ms after entry, matching the required 700 ms and 900 ms gaps. Final frame remained ended, background became clear, and no horizontal scrolling or page/console/HTTP errors occurred. No additional browser or complete playback run was performed.
