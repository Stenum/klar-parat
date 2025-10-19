import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

let cached: Buffer | null = null;

const dirname = path.dirname(fileURLToPath(import.meta.url));
const beepPath = path.resolve(dirname, "../fake-beep.mp3");

export const getFakeTtsBuffer = async () => {
  if (cached) return cached;
  cached = await fs.readFile(beepPath);
  return cached;
};
