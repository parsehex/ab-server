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
  private stayTimer: NodeJS.Timeout | null = null;

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

    const args = data.split(' ');
    const subcommand = args[0].toLowerCase();
    const value = args.slice(1).join(' ');

    const mapping = {
      num: 'NUM_BOTS',
      type: 'BOTS_TYPE',
      character: 'BOTS_CHARACTER',
      flag: 'BOTS_FLAG',
      active: 'BOTS_NO_IDLE',
      restart: 'RESTART',
    };

    if (!mapping[subcommand]) {
      this.emit(
        BROADCAST_CHAT_SERVER_WHISPER,
        playerId,
        'Usage: /bots <num|type|character|flag|active|restart> [value]'
      );
      return;
    }

    if (!value && subcommand !== 'active' && subcommand !== 'restart') {
      this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, `Please specify a value for ${subcommand}.`);
      return;
    }

    let finalValue = value;

    if (subcommand === 'active') {
      finalValue = 'true';
    }

    const envKey = mapping[subcommand];

    if (subcommand === 'num') {
      const numBots = parseInt(value, 10);
      if (isNaN(numBots) || numBots < 0 || numBots > 50) {
        this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, 'Invalid bot count. Please specify a number between 0 and 50.');
        return;
      }
    }

    // Handle restart command specially
    if (subcommand === 'restart') {
      this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, 'Restarting ab-bot service...');
      this.emit(
        BROADCAST_CHAT_SERVER_PUBLIC,
        `Bots are being restarted. They will return in ~15s. (Ordered by ${player.name.current})`
      );

      try {
        // restart via systemctl --user restart ab-bot
        runCommandDetached('systemctl', ['--user', 'restart', 'ab-bot'], this.log).catch((err) => {
          this.log.error('Failed to restart ab-bot service:', err);
        });

        this.log.info('Bots restarted by SU player: %o', {
          playerId,
          playerName: player.name.current,
        });
      } catch (err) {
        this.log.error('Failed to restart ab-bot', err);
        this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, 'Failed to restart bots. Check server logs.');
      }
      return;
    }

    this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, `Updating ${subcommand} to ${finalValue || value} and restarting ab-bot service...`);

    try {
      this.updateEnv(envKey, finalValue);

      if (subcommand === 'active') {
        const minutes = parseInt(value, 10) || 15;
        this.emit(
          BROADCAST_CHAT_SERVER_PUBLIC,
          `Bots have been ordered to stay active for ${minutes} minutes! (Ordered by ${player.name.current})`
        );

        if (this.stayTimer) {
          clearTimeout(this.stayTimer);
        }

        this.stayTimer = setTimeout(() => {
          this.updateEnv('BOTS_NO_IDLE', '');
          runCommandDetached('systemctl', ['--user', 'restart', 'ab-bot'], this.log).catch((err) => {
            this.log.error('Failed to restart ab-bot service after persistence:', err);
          });
          this.emit(
            BROADCAST_CHAT_SERVER_PUBLIC,
            'Bot persistence period over. Bots returning to normal idle behavior.'
          );
        }, minutes * 60 * 1000);
      } else {
        this.emit(
          BROADCAST_CHAT_SERVER_PUBLIC,
          `Bot ${subcommand} changing to: ${value}. Bots will return in ~15s.`
        );
      }

      // restart via systemctl --user restart ab-bot
      runCommandDetached('systemctl', ['--user', 'restart', 'ab-bot'], this.log).catch((err) => {
        this.log.error('Failed to restart ab-bot service:', err);
      });

      this.log.info('Bot %s updated to %s by SU player: %o', subcommand, finalValue, {
        playerId,
        playerName: player.name.current,
      });
    } catch (err) {
      this.log.error('Failed to update .env.bots or restart ab-bot', err);
      this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, 'Failed to update bot config. Check server logs.');
    }
  }

  private updateEnv(key: string, value: string): void {
    const envBotsPath = path.resolve(__dirname, '../../../../.env.bots');
    let envContent = '';

    if (fs.existsSync(envBotsPath)) {
      envContent = fs.readFileSync(envBotsPath, 'utf8');
    }

    const lines = envContent.split('\n');
    let found = false;
    const newLines = lines.map((line) => {
      if (line.startsWith(`${key}=`)) {
        found = true;
        if (value === '') return '';
        return `${key}=${value}`;
      }
      return line;
    });

    if (!found) {
      newLines.push(`${key}=${value}`);
    }

    fs.writeFileSync(envBotsPath, newLines.join('\n').trim() + '\n');
  }
}
