import fs from 'fs';
import path from 'path';
import {
  BROADCAST_CHAT_SERVER_WHISPER,
  BROADCAST_CHAT_SERVER_PUBLIC,
  COMMAND_BOTS,
} from '../../events';
import { MainConnectionId } from '../../types';
import { System } from '../system';
import { runCommandDetached } from '../utils/run_command';

export default class BotsCommandHandler extends System {
  constructor({ app }) {
    super({ app });

    this.listeners = {
      [COMMAND_BOTS]: this.onCommandReceived,
    };
  }

  onCommandReceived(connectionId: MainConnectionId, data: string): void {
    const connection = this.storage.connectionList.get(connectionId);

    if (
      !this.storage.connectionList.has(connectionId) ||
      !this.helpers.isPlayerConnected(connection.playerId)
    ) {
      return;
    }

    const { playerId } = connection;
    const player = this.storage.playerList.get(playerId);

    if (!player.su.current) {
      this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, 'You do not have permission to use this command.');
      return;
    }

    const numBots = parseInt(data, 10);

    if (isNaN(numBots) || numBots < 0 || numBots > 50) {
      this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, 'Invalid bot count. Please specify a number between 0 and 50.');
      return;
    }

    this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, `Updating bot count to ${numBots} and restarting ab-bot service...`);

    try {
      const envBotsPath = path.resolve(__dirname, '../../../../.env.bots');
      let oldNumBots = 4;

      if (fs.existsSync(envBotsPath)) {
        try {
          const content = fs.readFileSync(envBotsPath, 'utf8');
          const match = content.match(/NUM_BOTS=(\d+)/);
          if (match) {
            oldNumBots = parseInt(match[1], 10);
          }
        } catch (err) {
          this.log.error('Failed to read old bot count from .env.bots', err);
        }
      }

      fs.writeFileSync(envBotsPath, `NUM_BOTS=${numBots}\n`);

      this.emit(
        BROADCAST_CHAT_SERVER_PUBLIC,
        `Bot count changing: ${oldNumBots} -> ${numBots}. Bots will return in ~30s.`
      );

      // restart via systemctl --user restart ab-bot
      runCommandDetached('systemctl', ['--user', 'restart', 'ab-bot'], this.log).catch(
        (err) => {
          this.log.error('Failed to restart ab-bot service:', err);
        }
      );

      this.log.info('Bot count updated to %d from %d by SU player: %o', numBots, oldNumBots, {
        playerId,
        playerName: player.name.current,
      });
    } catch (err) {
      this.log.error('Failed to update .env.bots or restart ab-bot', err);
      this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, 'Failed to update bot count. Check server logs.');
    }
  }
}
