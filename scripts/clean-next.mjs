import fs from "fs";
import path from "path";

const dir = path.join(process.cwd(), ".next");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!fs.existsSync(dir)) {
    console.log(".next already absent");
    return;
  }

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      console.log("Removed .next");
      return;
    } catch (error) {
      if (attempt === 5) {
        throw error;
      }
      console.warn(`Retry ${attempt}/5 removing .next...`);
      await sleep(500 * attempt);
    }
  }
}

main().catch((error) => {
  console.error("Failed to remove .next:", error.message);
  console.error("Stop all node/next processes and run: npm run build:clean");
  process.exit(1);
});
