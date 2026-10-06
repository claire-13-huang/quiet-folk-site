# Acceptance — 2026-10-06

## Scope

Preserve Scenes 01–02, existing visual assets, exact invitation text and temporary YES state. No Scene 03 or redesign.

## Source and deployment

The genuine Vite/React/TypeScript source is maintained in the local project. The public `quiet-folk-site` main branch stores the editable application, six runtime media files and configuration. GitHub Actions builds and publishes `dist/`; Pages no longer serves a manually copied main-branch build.

Vite base: `/quiet-folk-site/`.

Production URL: https://claire-13-huang.github.io/quiet-folk-site/

## Corrections

- Scene handoff starts with a closer envelope framing and settles gently into the interactive room.
- Opening remains disabled until that camera movement has settled.
- Answer space is reserved before reveal, preventing invitation text from moving when choices appear.
- Each NO movement is measured from its current position and remains within screen margins.
- Resizing a displayed card updates its final position without replaying extraction.
- The room and mobile background dim together after extraction; the card stays sharp.
- The experience clips oversized scene layers without becoming a scroll container; immediate opening cannot shift the whole scene.

## Verification

Independent source/configuration/workflow and publishing-tree review passed. Production build and typecheck passed both in the local source project and in the curated publishing checkout.

Production preview at `/quiet-folk-site/` passed natural video playback → immediate envelope opening → sequential copy → repeated NO movement → YES at 390×844, 430×932 and 1440×900. Mobile runs used touch-enabled Chromium contexts. All cards stayed centered within the viewport; no horizontal or internal scene scrolling occurred. Eight consecutive NO moves per size stayed within 16px screen margins and moved 93–110px each. No console/page errors or HTTP asset errors occurred.

Video uses `preload="auto"`; Scene 02 images were decoded by 2.5 seconds into the 16-second film. Desktop handoff frames and all three viewport screenshots were visually inspected. Stable copy did not shift when choices appeared, and resizing the extracted card did not replay extraction.

GitHub Pages publishing source is GitHub Actions. The first automatic production build/deployment succeeded in run `37432825042`. The final clip correction passed automatic build and deployment in run `37433204702`, source commit `11d59b92f4da2fdbb554d53764da45763aa48c39`.

Original visual files and runtime media remain unchanged. Mobile acceptance uses browser emulation rather than a physical iPhone.


## Live verification

The unchanged production address returned the new production asset versions. Natural opening playback → immediate envelope interaction → exact invitation copy → NO → YES passed at 390×844 with touch emulation and 1440×900 with mouse input. Scene 02 images were ready while the film played. The card remained centered, scene scroll offsets stayed zero, and no console/page errors or failed asset responses occurred. Live NO movement measured 93px on mobile and 110px on desktop.

The supplied film ending and Scene 02 image use different compositions. The camera pullback softens their size difference; their fade retains a brief image overlap. Artistic preference for this overlap and pullback pacing remains a visual judgment.
