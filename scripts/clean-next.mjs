import fs from "fs";
import path from "path";

const DIRS = [".next", ".next-dev"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeDir(name) {
  const dir = path.join(process.cwd(), name);
  if (!fs.existsSync(dir)) {
    console.log(`${name} already absent`);
    return;
  }

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      console.log(`Removed ${name}`);
      return;
    } catch (error) {
      if (attempt === 5) {
        throw error;
      }
      console.warn(`Retry ${attempt}/5 removing ${name}...`);
      await sleep(500 * attempt);
    }
  }
}

async function main() {
  for (const name of DIRS) {
    await removeDir(name);
  }
}

main().catch((error) => {
  console.error("Failed to remove Next.js cache:", error.message);
  console.error("Stop this project's next processes and run: npm run build:clean");
  process.exit(1);
});
