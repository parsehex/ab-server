import { CTF_TEAMS, CTF_WIN_BOUNTY, SERVER_MESSAGE_TYPES } from '@airbattle/protocol';
import {
  CTF_COUNTDOWN_DURATION_MS,
  CTF_FLAGS_STATE_TO_NEW_PLAYER_BROADCAST_DELAY_MS,
  CTF_NEW_GAME_ALERT_DURATION_MS,
  MS_PER_SEC,
} from '../../../constants';
import {
  BROADCAST_CHAT_SERVER_PUBLIC,
  BROADCAST_CHAT_SERVER_WHISPER,
  BROADCAST_GAME_FLAG,
  BROADCAST_SERVER_MESSAGE,
  CTF_SHUFFLE_PLAYERS,
  PLAYERS_CREATED,
  PLAYERS_RESPAWN,
  TIMELINE_CLOCK_SECOND,
  TIMELINE_GAME_MATCH_END,
  TIMELINE_GAME_MATCH_START,
} from '../../../events';
import { SCOREBOARD_FORCE_UPDATE } from '../../../events/scoreboard';
import { System } from '../../../server/system';
import { Player, PlayerId, TeamId } from '../../../types';

export default class GameMatches extends System {
  private timeout = 0;

  constructor({ app }) {
    super({ app });

    this.listeners = {
      [PLAYERS_CREATED]: this.announceMatchState,
      [TIMELINE_CLOCK_SECOND]: this.onSecondTick,
    };
  }

  onSecondTick(): void {
    if (!this.storage.gameEntity.match.isActive) {
      this.timeout += 1;

      if (this.timeout === 15) {
        this.emit(
          BROADCAST_SERVER_MESSAGE,
          'New game starting in 1 minute',
          SERVER_MESSAGE_TYPES.ALERT,
          CTF_NEW_GAME_ALERT_DURATION_MS
        );
      } else if (this.timeout === 30) {
        this.emit(
          BROADCAST_SERVER_MESSAGE,
          'Game starting in 30 seconds - shuffling teams',
          SERVER_MESSAGE_TYPES.ALERT,
          5 * MS_PER_SEC
        );

        this.emit(CTF_SHUFFLE_PLAYERS);
      } else if (this.timeout === 50) {
        this.emit(
          BROADCAST_SERVER_MESSAGE,
          'Game starting in 10 seconds',
          SERVER_MESSAGE_TYPES.ALERT,
          4 * MS_PER_SEC
        );
      } else if (this.timeout >= 55 && this.timeout < 60) {
        const left = 60 - this.timeout;
        let text = 'Game starting in a second';

        if (left !== 1) {
          text = `Game starting in ${60 - this.timeout} seconds`;
        }

        this.emit(
          BROADCAST_SERVER_MESSAGE,
          text,
          SERVER_MESSAGE_TYPES.ALERT,
          CTF_COUNTDOWN_DURATION_MS
        );
      } else if (
        this.timeout >= 60 ||
        (this.storage.gameEntity.match.blue === 0 && this.storage.gameEntity.match.red === 0)
      ) {
        this.emit(
          BROADCAST_SERVER_MESSAGE,
          'Game starting!',
          SERVER_MESSAGE_TYPES.INFO,
          5 * MS_PER_SEC
        );

        // Match start.
        this.storage.gameEntity.match.current += 1;
        this.storage.gameEntity.match.isActive = true;
        this.storage.gameEntity.match.start = Date.now();
        this.storage.gameEntity.match.blue = 0;
        this.storage.gameEntity.match.red = 0;
        this.timeout = 0;

        this.emit(BROADCAST_GAME_FLAG, CTF_TEAMS.BLUE);
        this.emit(BROADCAST_GAME_FLAG, CTF_TEAMS.RED);

        const playersIterator = this.storage.playerList.values();
        let player: Player = playersIterator.next().value;

        while (player !== undefined) {
          player.delayed.RESPAWN = true;
          player.times.activePlayingBlue = 0;
          player.times.activePlayingRed = 0;
          player.kills.currentmatch = 0;

          this.emit(PLAYERS_RESPAWN, player.id.current);

          player = playersIterator.next().value;
        }

        this.emit(TIMELINE_GAME_MATCH_START);

        this.emit(SCOREBOARD_FORCE_UPDATE);
      }
    }
  }

  /**
   * Inform just connected player about the game state.
   *
   * @param playerId
   */
  announceMatchState(playerId: PlayerId): void {
    setTimeout(() => {
      this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, "Welcome to Infection Mode. This mode is still in development.");
      const player = this.storage.playerList.get(playerId);
      this.storage.mobList.set(playerId, player);
    }, CTF_FLAGS_STATE_TO_NEW_PLAYER_BROADCAST_DELAY_MS);
  }
}
