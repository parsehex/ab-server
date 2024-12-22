import { CTF_TEAMS, CTF_WIN_BOUNTY, SERVER_MESSAGE_TYPES } from '@airbattle/protocol';
import {
  CTF_COUNTDOWN_DURATION_MS,
  CTF_FLAGS_STATE_TO_NEW_PLAYER_BROADCAST_DELAY_MS,
  CTF_NEW_GAME_ALERT_DURATION_MS,
  MS_PER_SEC,
  PLAYERS_DEATH_INACTIVITY_MS,
} from '../../../constants';
import {
  BROADCAST_CHAT_SERVER_PUBLIC,
  BROADCAST_CHAT_SERVER_WHISPER,
  BROADCAST_GAME_FLAG,
  BROADCAST_PLAYER_RETEAM,
  BROADCAST_SERVER_CUSTOM,
  BROADCAST_SERVER_MESSAGE,
  CTF_SHUFFLE_PLAYERS,
  PLAYERS_CREATED,
  PLAYERS_KILL,
  PLAYERS_RESPAWN,
  PLAYERS_UPDATE_TEAM,
  SYNC_ENQUEUE_UPDATE,
  TIMELINE_CLOCK_SECOND,
  TIMELINE_GAME_MATCH_END,
  TIMELINE_GAME_MATCH_START,
} from '../../../events';
import { SCOREBOARD_FORCE_UPDATE } from '../../../events/scoreboard';
import { System } from '../../../server/system';
import { Player, PlayerId, TeamId } from '../../../types';
import { CHANNEL_RESPAWN_PLAYER } from '../../../events/channels';

export default class GameMatches extends System {
  private timeout = 0;
  private timeoutMax = 30;

  constructor({ app }) {
    super({ app });

    this.listeners = {
      [PLAYERS_CREATED]: this.announceMatchState,
      [TIMELINE_CLOCK_SECOND]: this.onSecondTick,
      [PLAYERS_KILL]: this.onPlayerKill,
    };

    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) this.timeoutMax = 10;
  }

  /**
   * Handle player kill event.
   *
   * @param victimId
   */
  onPlayerKill(victimId: PlayerId, enemyId: PlayerId): void {
    const victim = this.storage.playerList.get(victimId);
    const isVictimSurvivor = this.config.server.typeId === 4 && victim.team.current === CTF_TEAMS.BLUE;
    const players = Array.from(this.storage.playerList.values());

    const survivorsAlive = players.filter(player => player.team.current === CTF_TEAMS.BLUE && player.alivestatus?.current === 0).length;
    const infectedAlive = players.filter(player => player.team.current === CTF_TEAMS.RED && player.alivestatus.current === 0).length;

    this.log.debug(`Survivors alive: ${survivorsAlive}, Infected alive: ${infectedAlive}`);

    if (survivorsAlive === 0 || infectedAlive === 0) {
      const enemy = players.find(
        player => player.id.current === enemyId
      );
      // one team has lost
      // end the match
      this.storage.gameEntity.match.isActive = false;
      this.storage.gameEntity.match.winnerTeam = infectedAlive > 0 ? CTF_TEAMS.RED : CTF_TEAMS.BLUE;
      this.emit(
        BROADCAST_SERVER_MESSAGE,
        `Team ${infectedAlive > 0 ? 'Infected' : 'Survivors'} wins!`,
        SERVER_MESSAGE_TYPES.INFO,
        3 * MS_PER_SEC
      );

      this.emit(BROADCAST_CHAT_SERVER_PUBLIC, `Team ${infectedAlive > 0 ? 'Infected' : 'Survivors'} wins!`);
      this.emit(BROADCAST_SERVER_CUSTOM, victim.id.current, 0);
      this.emit(BROADCAST_SERVER_CUSTOM, enemy.id.current, 0);

      this.emit(TIMELINE_GAME_MATCH_END);
    } else if (isVictimSurvivor) {
      this.log.debug(`Player ${victim.name.current} has been infected!`);
      if (this.storage.connectionList.has(this.storage.playerMainConnectionList.get(victimId))) {
        const connection = this.storage.connectionList.get(
          this.storage.playerMainConnectionList.get(victimId)
        );

        connection.pending.respawn = true;

        connection.timeouts.respawn = setTimeout(() => {
          const enemy = players.find(
            player => player.id.current === enemyId
          );
          this.emit(BROADCAST_CHAT_SERVER_PUBLIC, `${enemy.name.current} has infected ${victim.name.current}!`);
          victim.team.current = CTF_TEAMS.RED;
          victim.delayed.RESPAWN = true;
          this.emit(PLAYERS_UPDATE_TEAM, victimId, CTF_TEAMS.RED);

          this.emit(BROADCAST_PLAYER_RETEAM, [victimId]);
          this.channel(CHANNEL_RESPAWN_PLAYER).delay(PLAYERS_RESPAWN, victimId);
          this.emit(BROADCAST_SERVER_CUSTOM, victim.id.current, 0);
        }, PLAYERS_DEATH_INACTIVITY_MS + 100);
      }
    }
  }

  onSecondTick(): void {
    if (!this.storage.gameEntity.match.isActive) {
      this.timeout += 1;

      if (this.timeout === 5) {
        this.emit(
          BROADCAST_SERVER_MESSAGE,
          `Game starting in ${this.timeoutMax - this.timeout} seconds`,
          SERVER_MESSAGE_TYPES.ALERT,
          5 * MS_PER_SEC
        );

        this.emit(CTF_SHUFFLE_PLAYERS);
      } else if (this.timeout === this.timeoutMax - 10) {
        this.emit(
          BROADCAST_SERVER_MESSAGE,
          'Game starting in 10 seconds',
          SERVER_MESSAGE_TYPES.ALERT,
          4 * MS_PER_SEC
        );
      } else if (this.timeout >= this.timeoutMax - 5 && this.timeout < this.timeoutMax) {
        const left = this.timeoutMax - this.timeout;
        let text = 'Game starting in a second';

        if (left !== 1) {
          text = `Game starting in ${30 - this.timeout} seconds`;
        }

        this.emit(
          BROADCAST_SERVER_MESSAGE,
          text,
          SERVER_MESSAGE_TYPES.ALERT,
          CTF_COUNTDOWN_DURATION_MS
        );
      } else if (
        this.timeout >= this.timeoutMax
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
        this.timeout = 0;

        const playersIterator = this.storage.playerList.values();
        let player: Player = playersIterator.next().value;

        // Reset current match stats and respawn players
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
