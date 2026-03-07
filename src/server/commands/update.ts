import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { BROADCAST_CHAT_SERVER_WHISPER, COMMAND_UPDATE } from '../../events';
import { MainConnectionId } from '../../types';
import { System } from '../system';

export default class UpdateCommandHandler extends System {
  constructor({ app }) {
    super({ app });

    this.listeners = {
      [COMMAND_UPDATE]: this.onCommandReceived,
    };
  }

  onCommandReceived(connectionId: MainConnectionId): void {
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

    const pendingPath = path.resolve(__dirname, '../../../.update-pending');
    
    if (!fs.existsSync(pendingPath)) {
      this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, 'There are no pending updates available.');
      return;
    }

    this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, 'Update confirmed. Triggering build and restart process in the background...');

    try {
      fs.unlinkSync(pendingPath);
    } catch (err) {
      this.log.error('Failed to clear .update-pending file', err);
    }

    try {
      const scriptPath = path.resolve(__dirname, '../../../../scripts/setup.js');
      
      const child = spawn('node', [scriptPath], {
        detached: true,
        stdio: 'ignore'
      });
      
      child.unref();
      
      this.log.info('Update command triggered setup.js by SU player: %o', {
        playerId,
        playerName: player.name.current,
      });
    } catch (err) {
      this.log.error('Failed to spawn setup.js for update', err);
      this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, 'Failed to start the update process. Check server logs.');
    }
  }
}
