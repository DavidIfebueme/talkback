# talkback

reactive laptop personality desktop app built with electron + typescript.

## download the app

yes, this is supported.

if you want installers instead of running locally, use github releases:
- releases page: https://github.com/davidifebueme/talkback/releases
- linux artifact: appimage
- windows artifact: nsis `.exe`
- mac artifact: `.dmg`

important:
- installers only show up when a tagged release is pushed.
- if there is no release tag yet, you will not see downloadable binaries yet.

release flow used by this repo:
1. push code to `master`
2. create and push a semver tag like `v0.1.0`
3. github actions workflow at `.github/workflows/release-build.yml` builds and uploads artifacts

## env setup

1. copy `.env.example` to `.env`
2. set these required keys for real provider calls:
   - `ZAI_API_KEY`
   - `ELEVENLABS_API_KEY`
3. optional tuning:
   - `ZAI_MODEL`
   - `ZAI_BASE_URL`
   - `ELEVENLABS_BASE_URL`
   - `ELEVENLABS_VOICE_ID`
   - `ELEVENLABS_MODEL_ID`


## where each provider is used

- z.ai inference: `src/main/personality-engine/zai-line-generator.ts`
- z.ai wiring: `src/main/index.ts`
- elevenlabs tts: `src/main/output-engine/elevenlabs-provider.ts`
- elevenlabs wiring: `src/main/index.ts`

fallback behavior:
- no `ZAI_API_KEY` → app uses prewritten lines only
- no `ELEVENLABS_API_KEY` → app keeps text output and skips real cloud tts

## run locally

```bash
npm install
npm run lint
npm test
npm run build
npm run dev
```

## quick linux qa (arch laptop)

```bash
npm run dev
```

manual checks:
- click `run demo output`
- click `run demo moment`
- confirm popup text shows immediately
- confirm audio plays when `ELEVENLABS_API_KEY` is set
- leave system idle and confirm idle lines fire
- verify keyboard mood behavior in your actual session type (wayland or x11)

## cross-platform validation checklist

build commands:

```bash
npm run package:linux
npm run package:win
npm run package:mac
```

test on real machines before calling it done:
- linux: launch appimage, run demo buttons, test idle + battery + keyboard flow
- windows 10/11: install `.exe`, verify launch, permissions, playback, restart
- macos: open `.dmg`, verify launch, permissions, playback, restart
