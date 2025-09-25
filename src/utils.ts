import fs from 'fs';
import path from 'path';

export function findParent(startDir: string, targetName: string): string | null {
  let dir = path.resolve(startDir);

  while (true) {
    const candidate = path.join(dir, targetName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      // Reached root
      return null;
    }
    dir = parent;
  }
}