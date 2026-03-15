import { ClientPackets } from '@airbattle/protocol';
import {
  COMMAND_DROP_FLAG,
  COMMAND_DROP_UPGRADE,
  COMMAND_ELECTIONS,
  COMMAND_FLAG,
  COMMAND_LAGS,
  COMMAND_MATCH,
  COMMAND_PLAYERS,
  COMMAND_PROFILE,
  COMMAND_RESPAWN,
  COMMAND_SERVER,
  COMMAND_SPECTATE,
  COMMAND_SPECTATORS,
  COMMAND_SU,
  COMMAND_SWITCH,
  COMMAND_UPGRADE,
  COMMAND_USURP,
  COMMAND_WELCOME,
  COMMAND_UPDATE,
  COMMAND_BOTS,
  COMMAND_FREECAM,
  ROUTE_COMMAND,
  CHAT_TEAM,
} from '../../events';
import { CHANNEL_CHAT } from '../../events/channels';
import { has } from '../../support/objects';
import { MainConnectionId } from '../../types';
import { System } from '../system';

interface ServerCommands {
  [commandName: string]: string;
}

export default class CommandMessageHandler extends System {
  /**
   * All available server commands.
   */
  protected commands: ServerCommands;

  constructor({ app }) {
    super({ app });

    this.commands = Object.freeze({
      drop: COMMAND_DROP_FLAG,
      flag: COMMAND_FLAG,
      respawn: COMMAND_RESPAWN,
      spectate: COMMAND_SPECTATE,
      upgrade: COMMAND_UPGRADE,

      // Custom commands.
      lags: COMMAND_LAGS,
      players: COMMAND_PLAYERS,
      profile: COMMAND_PROFILE,
      server: COMMAND_SERVER,
      spectators: COMMAND_SPECTATORS,
      su: COMMAND_SU,
      update: COMMAND_UPDATE,
      bots: COMMAND_BOTS,
      upgrades: COMMAND_DROP_UPGRADE,
      welcome: COMMAND_WELCOME,
      freecam: COMMAND_FREECAM,

      // CTF only.
      elections: COMMAND_ELECTIONS,
      match: COMMAND_MATCH,
      usurp: COMMAND_USURP,
      switch: COMMAND_SWITCH,
    });

    this.listeners = {
      [ROUTE_COMMAND]: this.onMessageReceived,
    };
  }

  /**
   * Handle `Command` request
   *
   * @param connectionId player connection id
   * @param msg player packet
   */
  onMessageReceived(connectionId: MainConnectionId, msg: ClientPackets.Command): void {
    const { com, data } = msg;

    if (has(this.commands, com)) {
      this.emit(this.commands[com], connectionId, data);
    } else {
      const botCommands = [
        'defend', 'def', 'recap', 'recover', 'd', 'r',
        'cap', 'capture', 'escort', 'c', 'e',
        'auto', 'assist', 'protect', 'a', 'p',
        'buddy', 'help', 'leader', 'leader-challenge',
        'challenge-leader', 'status', 'type', 'meet', 'yes'
      ];

      if (botCommands.includes(com)) {
        let text = `#${com}`;
        if (data && data.trim().length > 0) {
          text += ` ${data.trim()}`;
        }

        if (this.storage.connectionList.has(connectionId)) {
          const connection = this.storage.connectionList.get(connectionId);
          this.channel(CHANNEL_CHAT).delay(CHAT_TEAM, connection.playerId, text);
        }
      }
    }
  }
}
