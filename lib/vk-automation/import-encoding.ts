import fs from "fs";
import iconv from "iconv-lite";

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function looksLikeMojibake(text: string): boolean {
  return /[\u00C0-\u00FF]{3,}/.test(text) || text.includes("Ð") || text.includes("Ñ");
}

function decodeBuffer(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(UTF8_BOM)) {
    return buffer.subarray(3).toString("utf-8");
  }

  const asUtf8 = buffer.toString("utf-8");
  if (!looksLikeMojibake(asUtf8)) {
    return asUtf8;
  }

  const asWin1251 = iconv.decode(buffer, "win1251");
  if (!looksLikeMojibake(asWin1251)) {
    return asWin1251;
  }

  return asUtf8;
}

export function readTextFileAutoEncoding(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return decodeBuffer(buffer);
}

export function readTextLinesAutoEncoding(filePath: string): string[] {
  const content = readTextFileAutoEncoding(filePath);
  return content
    .split(/\r?\n/)
    .map((line) => line.replace(/\t+$/, "").trim())
    .filter((line) => line && !line.startsWith("#"));
}
