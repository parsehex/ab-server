import {
  COMMAND_FREECAM,
  SPECTATE_FREECAM,
} from '../../events';
import { CHANNEL_SPECTATE } from '../../events/channels';
import { MainConnectionId } from '../../types';
import { System } from '../system';
import { MAP_SIZE } from '../../constants';

export default class FreeCamCommandHandler extends System {
  constructor({ app }) {
    super({ app });

    this.listeners = {
      [COMMAND_FREECAM]: this.onCommandReceived,
    };
  }

  onCommandReceived(connectionId: MainConnectionId, commandArguments: string): void {
    if (!this.storage.connectionList.has(connectionId)) {
      return;
    }

    const connection = this.storage.connectionList.get(connectionId);
    const player = this.storage.playerList.get(connection.playerId);

    // Anti-Abuse: Only allow if in spectator mode
    if (!player.spectate.isActive) {
      return;
    }

    const parts = commandArguments.split(',');
    if (parts.length !== 2) {
      return;
    }

    const x = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);

    if (isNaN(x) || isNaN(y)) {
      return;
    }

    // Anti-Abuse (Cheap): Distance and Speed validation
    const viewport = this.storage.viewportList.get(connection.playerId);
    if (viewport) {
      const dx = x - (viewport.hitbox.x - MAP_SIZE.HALF_WIDTH);
      const dy = y - (viewport.hitbox.y - MAP_SIZE.HALF_HEIGHT);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const now = Date.now();
      const timeDelta = now - player.spectate.lastFreeCamAt;

      // Log the jump distance for debugging
      if (distance > 50) {
          this.log.info(`FreeCam: Player ${player.name.current} (${player.id.current}) jump: ${Math.round(distance)}u, dt: ${timeDelta}ms`);
      }

      // 1. Hard jump cap per packet
      if (distance > 500) {
        this.log.warn(`FreeCam: Blocking excessive jump (${Math.round(distance)} units) from player ${player.name.current}`);
        return;
      }

      // 2. Speed cap (units per second)
      // Allow ~2500 units/second (slightly faster than a boosted plane)
      if (timeDelta > 0) {
          const speed = (distance / timeDelta) * 1000;
          if (speed > 2500) {
              this.log.warn(`FreeCam: Blocking excessive speed (${Math.round(speed)} units/sec) from player ${player.name.current}`);
              return;
          }
      }
      
      player.spectate.lastFreeCamAt = now;
    }

    this.channel(CHANNEL_SPECTATE).delay(SPECTATE_FREECAM, connection.playerId, x, y);
  }
}
