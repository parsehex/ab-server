import fs from 'fs';
import path from 'path';
import { LIMITS_SU, LIMITS_SU_WEIGHT } from '../../constants';
import { BROADCAST_CHAT_SERVER_WHISPER, COMMAND_SU, RESPONSE_COMMAND_REPLY, CONNECTIONS_SEND_PACKETS } from '../../events';
import { SERVER_PACKETS } from '@airbattle/protocol';
import { MainConnectionId } from '../../types';
import { System } from '../system';

export default class SuperuserCommandHandler extends System {
  constructor({ app }) {
    super({ app });

    this.listeners = {
      [COMMAND_SU]: this.onCommandReceived,
    };
  }

  onCommandReceived(connectionId: MainConnectionId, password: string): void {
    const connection = this.storage.connectionList.get(connectionId);

    if (
      !this.storage.connectionList.has(connectionId) ||
      !this.helpers.isPlayerConnected(connection.playerId)
    ) {
      return;
    }

    if (connection.limits.su > LIMITS_SU) {
      this.emit(RESPONSE_COMMAND_REPLY, connectionId, 'Too frequent requests.');

      return;
    }

    connection.limits.su += LIMITS_SU_WEIGHT;

    const { playerId } = connection;

    if (password === this.config.suPassword) {
      const player = this.storage.playerList.get(playerId);

      player.su.current = true;

      this.emit(
        CONNECTIONS_SEND_PACKETS,
        {
          c: SERVER_PACKETS.SERVER_CUSTOM,
          type: 99,
          data: JSON.stringify({ id: playerId, su: true }),
        },
        [...this.storage.mainConnectionIdList]
      );

      this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, 'You have superuser rights now.');

      const pendingPath = path.resolve(__dirname, '../../../.update-pending');
      if (fs.existsSync(pendingPath)) {
        this.emit(
          BROADCAST_CHAT_SERVER_WHISPER,
          playerId,
          'An update is available! Type /update to apply it.'
        );
      }

      this.log.info('Player became superuser: %o', {
        playerId,
      });
    } else {
      this.log.info('Wrong superuser password: %o', {
        playerId,
      });
    }
  }
}
