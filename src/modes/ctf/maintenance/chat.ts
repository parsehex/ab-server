import {
  CHAT_MESSAGE_PER_TICKS_LIMIT,
  CHAT_SAY_LIFETIME_MS,
  CHAT_USERNAME_PLACEHOLDER,
  PLAYERS_ALIVE_STATUSES,
} from '../../../constants';
import {
  BROADCAST_CHAT_PUBLIC,
  BROADCAST_CHAT_SAY,
  BROADCAST_CHAT_SERVER_WHISPER,
  BROADCAST_CHAT_TEAM,
  BROADCAST_CHAT_WHISPER,
  CHAT_EMIT_DELAYED_EVENTS,
  CHAT_PUBLIC,
  CHAT_SAY,
  CHAT_TEAM,
  CHAT_WELCOME,
  CHAT_WHISPER,
  CTF_BOT_CHAT_TEAM,
  CTF_DROP_FLAG_NOW,
  RESPONSE_COMMAND_REPLY,
} from '../../../events';
import { CHANNEL_CHAT } from '../../../events/channels';
import { System } from '../../../server/system';
import { PlayerId } from '../../../types';

export default class GameChat extends System {
  private readonly usernamePlaceholderRegexp = new RegExp(CHAT_USERNAME_PLACEHOLDER, 'g');

  private readonly responseAttackBlock =
    "This command isn't allowed: https://github.com/wight-airmash/ab-server/issues/53";

  private readonly responseBotHelp = `Commands: #cap, #recap, #auto, #assist, #buddy, #drop, #status, #type, #leader, #challenge-leader.
  Only the team leader can run most commands.
  Type #help <command> (e.g., #help assist) for details.
  `;

  private framesPassed = 0;

  constructor({ app }) {
    super({ app });

    this.listeners = {
      [CHAT_EMIT_DELAYED_EVENTS]: this.onHandleChatMessages,
      [CHAT_PUBLIC]: this.onChatPublic,
      [CHAT_SAY]: this.onChatSay,
      [CHAT_TEAM]: this.onChatTeam,
      [CHAT_WELCOME]: this.onWelcomeMessage,
      [CHAT_WHISPER]: this.onChatWhisper,
    };
  }

  onHandleChatMessages(): void {
    this.framesPassed += 1;

    if (this.framesPassed < CHAT_MESSAGE_PER_TICKS_LIMIT) {
      return;
    }

    this.channel(CHANNEL_CHAT).emitFirstDelayed();
    this.framesPassed = 0;
  }

  protected static isHelpCommand(msg: string): boolean {
    if (msg.charAt(0) !== '#') {
      return false;
    }

    return msg.toLowerCase().startsWith('#help');
  }

  protected getHelpResponse(msg: string): string {
    const query = msg.toLowerCase().replace('#help', '').trim();

    if (query === '') {
      return this.responseBotHelp;
    }

    switch (query) {
      case 'cap':
      case 'capture':
      case 'escort':
      case 'c':
      case 'e':
        return 'Attack mode: Bots focus on the enemy flag or escort the teammate carrying it.';

      case 'recap':
      case 'recover':
      case 'defend':
      case 'd':
      case 'r':
        return 'Defense mode: Bots stay near our flag base or hunt for our dropped flag.';

      case 'auto':
        return 'Auto mode (default): Bots balance attack and defense based on proximity and team needs.';

      case 'assist':
      case 'protect':
      case 'a':
      case 'p':
        return 'Usage: #assist <player | me>. Directs nearby bots to follow and protect the specified player.';

      case 'buddy':
        return 'Buddy mode (WIP)\nUsage: #buddy <n>. Assigns <n> bots to follow and protect each active player on the team.';

      case 'drop':
      case 'f':
        return 'Usage: #drop (or #f). Asks the bot carrying the flag to drop it near you (must be teammate).';

      case 'status':
        return 'Status: Bots report current team composition, bot counts, and leadership status.';

      case 'type':
        return 'Usage: #type <1-5 | distribute | random>. Changes the plane types used by bots.';

      case 'leader':
        return 'Usage: #leader <player>. Manually assigns team leadership to the specified player.';

      case 'challenge-leader':
        return 'Starts an election to replace the current leader if they are AFK or have a lower score.';

      default:
        return `Unknown command "${query}". ${this.responseBotHelp}`;
    }
  }

  protected static isAttackCommand(msg: string): boolean {
    if (msg.charAt(0) !== '#' || msg.length > 7) {
      return false;
    }

    const command = msg.toLowerCase();

    if (command === '#attack' || command === '#atack') {
      return true;
    }

    return false;
  }

  protected static isShieldTimerAlert(msg: string): boolean {
    return msg.endsWith('seconds till enemy shield');
  }

  protected static isDropNowCommand(msg: string): boolean {
    return msg === '#dropnow';
  }

  onChatPublic(playerId: PlayerId, msg: string): void {
    if (!this.helpers.isPlayerConnected(playerId)) {
      return;
    }

    if (GameChat.isAttackCommand(msg)) {
      this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, this.responseAttackBlock);
    } else if (GameChat.isHelpCommand(msg)) {
      this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, this.getHelpResponse(msg));
    } else {
      this.emit(BROADCAST_CHAT_PUBLIC, playerId, msg);
    }
  }

  onChatSay(playerId: PlayerId, msg: string): void {
    if (!this.helpers.isPlayerConnected(playerId)) {
      return;
    }

    const player = this.storage.playerList.get(playerId);

    if (
      !player.planestate.stealthed &&
      player.alivestatus.current === PLAYERS_ALIVE_STATUSES.ALIVE
    ) {
      player.say.text = msg;
      player.say.createdAt = Date.now();
      this.storage.playerIdSayBroadcastList.add(playerId);

      clearTimeout(player.say.resetTimeout);

      player.say.resetTimeout = setTimeout(() => {
        this.storage.playerIdSayBroadcastList.delete(playerId);
      }, CHAT_SAY_LIFETIME_MS);

      this.emit(BROADCAST_CHAT_SAY, playerId, msg);
    } else {
      this.emit(
        RESPONSE_COMMAND_REPLY,
        this.storage.playerMainConnectionList.get(playerId),
        'You have to be visible to use "/s".'
      );
    }
  }

  onChatTeam(playerId: PlayerId, msg: string): void {
    if (!this.helpers.isPlayerConnected(playerId)) {
      return;
    }

    if (GameChat.isAttackCommand(msg)) {
      this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, this.responseAttackBlock);
    } else if (GameChat.isHelpCommand(msg)) {
      this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, this.getHelpResponse(msg));
    } else if (!GameChat.isShieldTimerAlert(msg)) {
      this.emit(BROADCAST_CHAT_TEAM, playerId, msg);

      if (GameChat.isDropNowCommand(msg)) {
        this.emit(CTF_DROP_FLAG_NOW, playerId);
      }
    }

    if (this.storage.botIdList.has(playerId)) {
      this.emit(CTF_BOT_CHAT_TEAM, playerId, msg);
    }
  }

  onChatWhisper(playerId: PlayerId, receiverId: PlayerId, msg: string): void {
    if (!this.helpers.isPlayerConnected(playerId) || !this.helpers.isPlayerConnected(receiverId)) {
      return;
    }

    this.emit(BROADCAST_CHAT_WHISPER, playerId, receiverId, msg);
  }

  onWelcomeMessage(playerId: PlayerId): void {
    if (!this.helpers.isPlayerConnected(playerId)) {
      return;
    }

    const player = this.storage.playerList.get(playerId);

    for (let msgIndex = 0; msgIndex < this.config.server.bot.welcome.length; msgIndex += 1) {
      const msg = this.config.server.bot.welcome[msgIndex].replace(
        this.usernamePlaceholderRegexp,
        player.name.current
      );

      this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, msg);
    }
  }
}
