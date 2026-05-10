# Sinnamon

Sinnamon is a custom Matrix client built around a Discord-like user experience, with a focus on room navigation, timeline reliability, encryption recovery flows, and long-term customization support.

## Project Status

Sinnamon is currently in pre-release development at `0.1.0-alpha.0`.

The current implementation focus is:

- Discord-like layout and interaction structure
- Stable Matrix room navigation and message timeline behavior
- Encryption UX with key storage, import, and recovery direction
- Theming, emoji, and sticker customization foundations

## Roadmap

Planned near-term work includes:

- Custom emojis, stickers, and animated stickers
- Profile and room visual customization
- Continued Matrix reliability and UX polish

Longer-term work includes:

- Self-hosted peer-to-peer voice chat using Opus

## Technology Stack

- Electron
- React
- TypeScript
- Vite

## Repository Documents

- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Issues: [ISSUES.md](ISSUES.md)
- Code of Conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Legal Disclaimer: [LEGAL_DISCLAIMER.md](LEGAL_DISCLAIMER.md)

## Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Run the local Matrix mock server for offline or isolated testing:

```bash
npm run dev:mock-matrix
```

Use the following settings for local mock-server testing:

- Homeserver URL: `http://127.0.0.1:8787`
- Username: `@tester:local`
- Password: any value

Run the Electron app directly:

```bash
npm run start
```

Build the production web bundle:

```bash
npm run build
```

Create the Electron Debug package for validation:

```bash
npm run package:debug
```

Create the Electron Release package for validation:

```bash
npm run package:release
```

Preview the production web bundle locally:

```bash
npm run preview
```

## Quality Expectations

- Maintain a professional automated testing suite.
- Run the relevant tests before build validation.
- Validate both Debug and Release build variants for implementation changes.

## Legal Notice

Legal restrictions and project-specific disclaimer terms are maintained in [LEGAL_DISCLAIMER.md](LEGAL_DISCLAIMER.md).

## Contributing

Follow the repository standards and keep [CHANGELOG.md](CHANGELOG.md) and [ISSUES.md](ISSUES.md) current when making meaningful project changes.
