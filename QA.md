# Final polish acceptance — 2026-10-07

## Scope

Targeted modifications to entry, envelope handoff and prompt, quiet paper audio, blank extraction, invitation copy, typography, food pacing, itinerary note and hidden letter. The existing opening and celebration MP4s and original source assets remain unchanged. Meeting-confirmation width, height, paper and centered position are preserved.

## Implemented behavior

- The HTML first-paint placeholder also blurs and dims the poster before React mounts, preventing a brief clear-character reveal. The opening poster starts explicitly blurred at 80 px and dimmed before any playback. Come in starts at zero, unmuted, within the gesture; the entry text remains mounted for its 500 ms exit and the film clears over 1.4 seconds.
- In the final 500 ms of Scene 01, existing sealed artwork anchors an approximately 850 ms movement into the desk position while the film and room crossfade. Original video audio finishes naturally.
- The prompt is Whenever you're ready. The envelope click and extraction start at 650 ms trigger separate quiet paper recordings. The copy container is hidden throughout opening and extraction, with initially transparent text, then reveals only at the settled invitation stage.
- Exact revised getaway text and answer labels retain the original second-choice behavior.
- Self-hosted Cormorant Garamond and EB Garamond include their OFL notices. Browser serif fallbacks remain available.
- Celebration title remains centered, large and tied to duration minus 4.5 seconds, with the second line 700 ms later and final fade. The original celebration picture and embedded audio are unchanged.
- The 10.9-second stable celebration frame is predecoded and crossfades into later cards. The ended video is hidden after that crossfade. Background blur is 5 px on mobile and 6 px on desktop, brightness 0.72, scale moves slowly to 1.015 over 24 seconds.
- Food reveals intro, question and three option rows at 0, 500, 1100, 1650 and 2200 ms. Hidden options are disabled. Five exact choices use 28 px desktop and 21 px mobile text with understated hover response. Selection locks choices and reveals dessert before the one-second continuation.
- Itinerary geometry scales uniformly to 86% of the approved card, preserving aspect ratio and center. The summary remains available until the small note is clicked, allowing a calm reading pause. Let's decide later uses the exact We'll decide together ♡ alternative; the earlier confirmed/flexible meeting-time branch remains.
- The hidden sealed note peeks after 1.2 seconds from the lower-right paper edge, rises on hover, stays within the mobile viewport, and opens on mouse or touch. The summary has no active controls and does not intercept the note.
- The same paper style contains the exact HTML letter, eight paragraphs revealed with 650 ms stagger. See you soon. ♡ follows the signature by one second. Text scrolls inside the paper if necessary; the page does not scroll horizontally. The prior large ending is removed.

## Assets and audio

AUDIO_SOURCES.md records both original Freesound pages, CC0 permissions and the trimmed envelope excerpt. Both downloaded tracks contain natural paper sounds without added music, synthesised whoosh or watermark. Native Web Audio handles gesture unlock and decoded buffers; no new library is installed. Starting a video stops active paper nodes. Tab hiding pauses videos and paper sound.

The existing HEVC celebration master remains unchanged; this pass reuses the existing H.264/AAC web video. New stills are literal frame extractions, not generated artwork. Original runtime videos remain byte-identical to the preceding release.

## Targeted verification

One desktop pass at 1440×900 and one touch mobile pass at 390×844 used seeks and direct state jumps rather than repeated full playback. Entry, match handoff, invitation, celebration title, meeting, food, summary, hidden note and letter were inspected. Food options were all hidden and disabled before their scheduled rows. Both confirmed/decide-later and adjusted/Korean summaries displayed correctly. Later backgrounds used the predecoded still and hid the ended video. Paragraph and farewell reveals completed, contained letter scrolling reached the final line, and no horizontal scrolling or page/HTTP errors occurred.

The checks exposed entry opacity being interrupted, a note click intercepted by the summary, and text extending into the stationery margin. Those exact positions were fixed and rechecked without replaying either full film. A desktop state-jump invitation screenshot omitted extraction state; the single natural full run below verifies the actual invitation. Test shortcuts exist only in external browser code, with no production debug controls.

## Single complete natural run

A final 1440×900 natural end-to-end run passed through both full videos and every interaction to the private letter. Opening and celebration were the only two video play calls, each at zero, unmuted and inside user activation; no overlapping videos occurred. Real decoded paper buffers played at envelope click, sliding 658 ms later, and hidden-note click, all with a running gesture-unlocked AudioContext. A 20 ms extraction monitor found no visible early-copy sample. Entry exit was still mounted with opacity 0.54 after 120 ms. The actual desktop invitation had no envelope-layer obstruction.

All eight letter paragraphs appeared with approximately 640–660 ms gaps; the quiet farewell followed the signature by 1000 ms. The final desktop letter fit its 547 px inner paper area without scrolling after spacing polish. No page/console/HTTP errors or horizontal scrolling occurred. Original video streams and assets remain untouched. The downloaded low-level paper recordings were gain-matched to approximately -43 to -44 dB RMS at the restrained runtime gains (0.18/0.14), keeping them audible without a dramatic effect. Only paper-audio amplitude, letter content margins and the HTML first-paint placeholder were adjusted after this run; no state or timing code changed. A targeted production-preview check with the application script temporarily blocked confirmed a blurred, dimmed placeholder with no identifiable faces. After normal mounting, the placeholder disappears and the entry remains paused without horizontal scrolling. Targeted decoding verified final runtime RMS 0.0062/0.0069 with no clipping. Final letter recheck measured a 526 px inner area: the entire desktop letter fits, and mobile scrolling reaches the farewell within the paper border.
