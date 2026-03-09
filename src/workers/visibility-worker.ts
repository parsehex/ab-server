import { parentPort } from 'worker_threads';

/**
 * Flags for mob types to match the logic in collisions.ts
 */
const FLAGS = {
  PROJECTILE: 1 << 0,
  BOX: 1 << 1,
  PLAYER: 1 << 2,
};

parentPort.on('message', (task) => {
  const { viewports, mobsBuffer, mobsCount } = task;
  const mobs = new Float32Array(mobsBuffer);
  const results = {};

  for (const viewport of viewports) {
    const { id, x, y, hX, hY } = viewport;
    const currentMobs = [];
    const projectiles = [];
    const boxes = [];

    // Bounding box for visibility
    const minX = x - hX;
    const maxX = x + hX;
    const minY = y - hY;
    const maxY = y + hY;

    for (let i = 0; i < mobsCount; i++) {
        const offset = i * 4;
        const mobId = mobs[offset];
        const mobX = mobs[offset + 1];
        const mobY = mobs[offset + 2];
        const mobFlags = mobs[offset + 3];

        // Simple AABB check for visibility
        if (mobX >= minX && mobX <= maxX && mobY >= minY && mobY <= maxY) {
            currentMobs.push(mobId);
            
            if (mobFlags & FLAGS.PROJECTILE) {
                // We keep track of projectiles specifically if needed, 
                // but for visibility we just need the IDs.
            }
        }
    }

    results[id] = currentMobs;
  }

  parentPort.postMessage({ results });
});
