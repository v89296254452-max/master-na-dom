import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const IMAGE_EXT = new Set([".webp", ".png", ".jpg", ".jpeg", ".svg"]);
const CATEGORIES = ["hero", "work", "details", "brand", "placeholders"];
const KEEP_FILES = new Set([".gitkeep", ".gitignore"]);

function guardCategory(root, category) {
  const dir = path.join(root, category);
  if (!fs.existsSync(dir)) return [];

  const removed = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      fs.rmSync(full, { recursive: true, force: true });
      removed.push(`${category}/${entry.name}/`);
      continue;
    }

    if (KEEP_FILES.has(entry.name)) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXT.has(ext) || entry.name.includes(".webp.webp")) {
      fs.rmSync(full, { force: true });
      removed.push(`${category}/${entry.name}`);
    }
  }

  return removed;
}

function removeNestedDataDirs(dir, removed) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;

    if (entry.name.toLowerCase() === "data") {
      fs.rmSync(full, { recursive: true, force: true });
      removed.push(full.replace(process.cwd(), "").replace(/\\/g, "/"));
      continue;
    }

    removeNestedDataDirs(full, removed);
  }
}

export function guardPublicImages(cwd = process.cwd()) {
  const root = path.join(cwd, "public", "images");
  const removed = [];

  for (const category of CATEGORIES) {
    removed.push(...guardCategory(root, category));
  }

  removeNestedDataDirs(root, removed);

  const legacyServices = path.join(root, "services");
  if (fs.existsSync(legacyServices)) {
    fs.rmSync(legacyServices, { recursive: true, force: true });
    removed.push("images/services/");
  }

  return removed;
}

function cleanNext(cwd = process.cwd()) {
  const dir = path.join(cwd, ".next");
  if (!fs.existsSync(dir)) return false;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      return true;
    } catch {
      if (attempt === 5) throw new Error("Could not remove .next — stop all node.exe first");
    }
  }

  return false;
}

function killOtherNodeProcesses() {
  if (process.platform === "win32") {
    try {
      execSync(
        `powershell -NoProfile -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne ${process.pid} } | Stop-Process -Force"`,
        { stdio: "ignore" }
      );
    } catch {
      // ignore
    }
    return;
  }

  spawnSync("pkill", ["-f", "next"], { stdio: "ignore" });
}

function main() {
  const mode = process.argv[2] || "all";

  if (mode === "guard") {
    const removed = guardPublicImages();
    if (removed.length > 0) {
      console.warn("Removed unsafe files from public/images:");
      for (const item of removed) console.warn(`  - ${item}`);
    }
    return;
  }

  if (mode === "clean-next") {
    const removed = cleanNext();
    console.log(removed ? "Removed .next" : ".next already absent");
    return;
  }

  console.log("Stopping other node processes...");
  killOtherNodeProcesses();

  const removed = guardPublicImages();
  if (removed.length > 0) {
    console.warn("Removed unsafe files from public/images:");
    for (const item of removed) console.warn(`  - ${item}`);
  }

  cleanNext();
  console.log("Running production build...");
  execSync("npm run build:clean", { stdio: "inherit", cwd: process.cwd() });

  console.log("\nReady. Start server: npm run start");
  console.log("Or development: npm run dev");
}

const isDirectRun = process.argv[1]?.includes("site-recover");
if (isDirectRun) {
  main();
}
