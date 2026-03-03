# Sinnamon

Sinnamon is a custom Matrix client inspired by Element and Cinny, with a familiar Discord-style UX and deeper customization.

## Status

Pre-release (`0.1.0-alpha.0`), active development.

## Current Focus

- Discord-like layout and interaction model
- Matrix room navigation and timeline reliability
- Encryption UX direction with key storage/import flows
- Customization foundation for emoji/stickers/themes

## Planned Features

- Custom emojis, stickers, and animated stickers
- Profile and room visual customization
- Future: self-hosted P2P voice chat using Opus

## Tech Stack

- Electron
- React
- TypeScript
- Vite

## Project Docs

- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Issue tracker: [ISSUES.md](ISSUES.md)
- Code of Conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Development

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Run Electron directly (uses built assets when packaged, dev server in development):

```bash
npm run start
```

Build (release bundle):

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Quality Expectations

- Maintain a professional automated testing suite.
- Run and pass relevant tests before build validation.
- Validate both Debug and Release build variants for implementation changes.

## Contributing

Please follow the project standards in the repository docs and keep entries in `CHANGELOG.md` and `ISSUES.md` up to date.
