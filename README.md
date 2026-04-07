# TalkBack

Reactive laptop personality desktop app built with Electron and TypeScript.

## Environment setup

1. Copy `.env.example` to `.env`.
2. Fill provider keys:
   - `ZAI_API_KEY`
   - `ELEVENLABS_API_KEY`
3. Optional tuning:
   - `ZAI_MODEL`, `ZAI_BASE_URL`
   - `ELEVENLABS_BASE_URL`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`

`.env` is gitignored.

## Where providers are used

- Z.ai inference is used in `src/main/personality-engine/zai-line-generator.ts`.
- Z.ai is wired from app startup in `src/main/index.ts` through `createResilientAiLineGenerator`.
- ElevenLabs voice synthesis is used in `src/main/output-engine/elevenlabs-provider.ts`.
- ElevenLabs is wired in `src/main/index.ts` as the `TtsProvider` for `TtsGenerationWorker`.

If a key is missing, TalkBack falls back gracefully:
- No `ZAI_API_KEY`: prewritten lines only.
- No `ELEVENLABS_API_KEY`: text-only/fallback audio bytes path.

## Local development

```bash
npm install
npm run lint
npm test
npm run build
npm run dev
```

## Cross-platform validation from Linux

### Linux (local Arch laptop)

```bash
npm run dev
```

Manual checks:
- Click `Run Demo Output` and `Run Demo Moment`.
- Confirm popup text appears.
- Confirm audio starts when `ELEVENLABS_API_KEY` is set.
- Leave machine idle and check idle trigger lines.
- Verify keyboard mood fallback behavior under Wayland/X11.

### Build artifacts for all platforms

```bash
npm run package:linux
npm run package:win
npm run package:mac
```

On Linux host, cross-target packaging can be environment-limited for Windows/macOS signing/runtime validation.

Recommended release validation flow:
1. Push to `master`.
2. Create/push a semver tag (`vX.Y.Z`).
3. Use GitHub Actions workflow `.github/workflows/release-build.yml` to build platform artifacts.
4. Validate each artifact on real OS target machines.

### Minimum practical platform matrix

- Linux: Arch GNOME Wayland + X11 session
- Windows: Windows 10/11 clean install
- macOS: Recent Intel or Apple Silicon machine

For each platform validate:
- App launch
- Demo output buttons
- Popup rendering
- Audio playback with ElevenLabs key
- Battery/idle trigger behavior
- App quit and relaunch
