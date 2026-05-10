import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopRoot, "..", "..");
const webBuildDir = path.join(repoRoot, "apps", "web", "webapp");
const desktopWebappDir = path.join(desktopRoot, "webapp");

if (!fs.existsSync(webBuildDir)) {
    console.error(`Web build output was not found: ${webBuildDir}`);
    console.error("Run 'pnpm build:web' before staging desktop webapp assets.");
    process.exit(1);
}

if (fs.existsSync(desktopWebappDir)) {
    fs.rmSync(desktopWebappDir, { recursive: true, force: true });
}

fs.cpSync(webBuildDir, desktopWebappDir, { recursive: true });

console.log(`Staged desktop webapp assets: ${desktopWebappDir}`);
