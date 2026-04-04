import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const workspaceRoot = process.cwd();
const pnpmDir = path.join(workspaceRoot, 'node_modules', '.pnpm');

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, out);
    } else if (entry.isFile() && fullPath.endsWith('.d.ts')) {
      out.push(fullPath);
    }
  }
  return out;
}

async function findMatrixSdkLibDirs() {
  const dirs = [];
  const entries = await readdir(pnpmDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('matrix-js-sdk@')) {
      continue;
    }

    const libDir = path.join(
      pnpmDir,
      entry.name,
      'node_modules',
      'matrix-js-sdk',
      'lib',
    );

    try {
      const info = await stat(libDir);
      if (info.isDirectory()) {
        dirs.push(libDir);
      }
    } catch {
      // Ignore missing dirs and continue discovery.
    }
  }
  return dirs;
}

async function findMatrixSdkRoots() {
  const roots = [];
  const entries = await readdir(pnpmDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('matrix-js-sdk@')) {
      continue;
    }

    const rootDir = path.join(
      pnpmDir,
      entry.name,
      'node_modules',
      'matrix-js-sdk',
    );

    try {
      const info = await stat(rootDir);
      if (info.isDirectory()) {
        roots.push(rootDir);
      }
    } catch {
      // Ignore missing dirs and continue discovery.
    }
  }
  return roots;
}

async function patchSignInWithQr(rootDir) {
  const sourceFile = path.join(rootDir, 'src', 'rendezvous', 'MSC4108SignInWithQR.ts');

  try {
    const source = await readFile(sourceFile, 'utf8');
    let next = source;

    next = next.replace(
      'interface SecretsPayload extends MSC4108Payload, Awaited<ReturnType<NonNullable<CryptoApi["exportSecretsBundle"]>>> {\n    type: PayloadType.Secrets;\n}',
      'type SecretsPayload = MSC4108Payload & Awaited<ReturnType<NonNullable<CryptoApi["exportSecretsBundle"]>>> & {\n    type: PayloadType.Secrets;\n};',
    );

    next = next.replace(
      'const secretsBundle = await this.client!.getCrypto()!.exportSecretsBundle!();',
      'const secretsBundle = (await this.client!.getCrypto()!.exportSecretsBundle!()) as Omit<SecretsPayload, "type">;',
    );

    if (next !== source) {
      await writeFile(sourceFile, next, 'utf8');
      return 1;
    }
    return 0;
  } catch {
    return 0;
  }
}

async function patchBase64(rootDir) {
  const sourceFile = path.join(rootDir, 'src', 'base64.ts');

  try {
    const source = await readFile(sourceFile, 'utf8');
    let next = source;

    next = next.replace(
      '/**\n * Base64 encoding and decoding utilities\n */\n',
      '/**\n * Base64 encoding and decoding utilities\n */\n\ninterface Uint8ArrayToBase64Options {\n    alphabet?: "base64" | "base64url";\n    omitPadding?: boolean;\n}\n\ninterface Uint8ArrayFromBase64Options {\n    alphabet?: "base64" | "base64url";\n    lastChunkHandling?: "loose" | "strict" | "stop-before-partial";\n}\n',
    );

    next = next.replace(
      'if (typeof uint8Array.toBase64 === "function") {',
      'if (typeof (uint8Array as any).toBase64 === "function") {',
    );

    next = next.replace(
      'return uint8Array.toBase64(options);',
      'return (uint8Array as any).toBase64(options);',
    );

    next = next.replace(
      'if (typeof Uint8Array.fromBase64 === "function") {',
      'if (typeof (Uint8Array as any).fromBase64 === "function") {',
    );

    next = next.replace(
      'return Uint8Array.fromBase64(base64, options);',
      'return (Uint8Array as any).fromBase64(base64, options);',
    );

    if (next !== source) {
      await writeFile(sourceFile, next, 'utf8');
      return 1;
    }
    return 0;
  } catch {
    return 0;
  }
}

async function patchMediaHandler(rootDir) {
  const sourceFile = path.join(rootDir, 'src', 'webrtc', 'mediaHandler.ts');

  try {
    const source = await readFile(sourceFile, 'utf8');
    let next = source;

    next = next.replace(
      'const isWebkit = !!navigator.webkitGetUserMedia;',
      'const isWebkit = !!(navigator as any).webkitGetUserMedia;',
    );

    next = next.replace(
      '                video: {\n                    mandatory: {\n                        chromeMediaSource: "desktop",\n                        chromeMediaSourceId: desktopCapturerSourceId,\n                    },\n                },',
      '                video: {\n                    mandatory: {\n                        chromeMediaSource: "desktop",\n                        chromeMediaSourceId: desktopCapturerSourceId,\n                    },\n                } as any,',
    );

    if (next !== source) {
      await writeFile(sourceFile, next, 'utf8');
      return 1;
    }
    return 0;
  } catch {
    return 0;
  }
}

async function main() {
  const libDirs = await findMatrixSdkLibDirs();
  const matrixRoots = await findMatrixSdkRoots();
  if (libDirs.length === 0) {
    console.log('No matrix-js-sdk lib directories found; nothing to patch.');
    return;
  }

  let updatedFiles = 0;
  for (const libDir of libDirs) {
    const dtsFiles = await walk(libDir);
    for (const file of dtsFiles) {
      const source = await readFile(file, 'utf8');
      const next = source.replace(/\.ts(["'])/g, '$1');
      if (next !== source) {
        await writeFile(file, next, 'utf8');
        updatedFiles += 1;
      }
    }
  }

  let updatedSourceFiles = 0;
  for (const rootDir of matrixRoots) {
    updatedSourceFiles += await patchSignInWithQr(rootDir);
    updatedSourceFiles += await patchBase64(rootDir);
    updatedSourceFiles += await patchMediaHandler(rootDir);
  }

  console.log(
    `Patched ${updatedFiles} matrix-js-sdk declaration files and ${updatedSourceFiles} matrix-js-sdk source files.`,
  );
}

main().catch((error) => {
  console.error('Failed to patch matrix-js-sdk declarations:', error);
  process.exitCode = 1;
});
