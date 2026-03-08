import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { BROADCAST_CHAT_SERVER_WHISPER, COMMAND_BOTS } from '../../events';
import { MainConnectionId } from '../../types';
import { System } from '../system';

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
      fs.writeFileSync(envBotsPath, `NUM_BOTS=${numBots}\n`);

      try {
        // restart via systemctl --user restart ab-bot
        const child = spawn('systemctl', ['--user', 'restart', 'ab-bot'], {
          detached: true,
          stdio: 'ignore'
        });

        child.on('error', (err) => {
          this.log.error('Failed to restart ab-bot service:', err);
        });

        child.unref();

        this.log.info('Bot count updated to %d by SU player: %o', numBots, {
          playerId,
          playerName: player.name.current
        });
      } catch (e) {}
    } catch (err) {
      this.log.error('Failed to update .env.bots or restart ab-bot', err);
      this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, 'Failed to update bot count. Check server logs.');
    }
  }
}
