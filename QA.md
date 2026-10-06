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

## Verification

Independent source/configuration/workflow review passed. Production build and typecheck passed. Three-size production flow and final live deployment results are recorded after execution.

Original visual files and runtime media remain unchanged. Mobile acceptance uses browser emulation rather than a physical iPhone.
