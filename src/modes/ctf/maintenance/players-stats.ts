import { CTF_TEAMS } from '@airbattle/protocol';
import {
  BROADCAST_CHAT_SERVER_WHISPER,
  CTF_PLAYER_SWITCHED,
  CTF_TEAMS_RESHUFFLED,
  CTF_TEAM_CAPTURED_FLAG,
  PLAYERS_CREATED,
  PLAYERS_REMOVED,
  PLAYERS_RESPAWNED,
  PLAYERS_STATS_ANNOUNCE,
  PLAYERS_SWITCHED_TO_SPECTATE,
  TIMELINE_GAME_MATCH_START,
  TIMELINE_LOOP_TICK,
} from '../../../events';
import { CHANNEL_PLAYERS_STATS } from '../../../events/channels';
import { System } from '../../../server/system';
import { Player, PlayerId } from '../../../types';

/**
 * /players command handler.
 */
export default class GamePlayersStats extends System {
  private isStatsOutdated = true;

  private cachedResponseMessage = '';

  constructor({ app }) {
    super({ app });

    this.listeners = {
      // Channels.
      [TIMELINE_LOOP_TICK]: this.onEmitDelayedEvents,

      // Events.
      [CTF_PLAYER_SWITCHED]: this.setStatsOutdated,
      [CTF_TEAM_CAPTURED_FLAG]: this.onTeamCaptured,
      [CTF_TEAMS_RESHUFFLED]: this.setStatsOutdated,
      [PLAYERS_CREATED]: this.setStatsOutdated,
      [PLAYERS_REMOVED]: this.setStatsOutdated,
      [PLAYERS_RESPAWNED]: this.onPlayerRespawned,
      [PLAYERS_STATS_ANNOUNCE]: this.onAnnounceRequest,
      [PLAYERS_SWITCHED_TO_SPECTATE]: this.setStatsOutdated,
      [TIMELINE_GAME_MATCH_START]: this.setStatsOutdated,
    };
  }

  onEmitDelayedEvents(): void {
    this.channel(CHANNEL_PLAYERS_STATS).emitDelayed();
  }

  private getResponseMessage(): string {
    if (!this.isStatsOutdated) {
      return this.cachedResponseMessage;
    }

    const blueTeam = {
      humans: 0,
      humansSpec: 0,
      bots: 0,
      botsSpec: 0,
    };

    const redTeam = {
      humans: 0,
      humansSpec: 0,
      bots: 0,
      botsSpec: 0,
    };

    const playersIterator = this.storage.playerList.values();
    let player: Player = playersIterator.next().value;

    while (player !== undefined) {
      let stats = null;

      if (player.team.current === CTF_TEAMS.BLUE) {
        stats = blueTeam;
      } else {
        stats = redTeam;
      }

      if (player.bot.current) {
        stats.bots += 1;

        if (player.spectate.isActive) {
          stats.botsSpec += 1;
        }
      } else {
        stats.humans += 1;

        if (player.spectate.isActive) {
          stats.humansSpec += 1;
        }
      }

      player = playersIterator.next().value;
    }

    this.isStatsOutdated = false;
    this.cachedResponseMessage = `${blueTeam.humans - blueTeam.humansSpec} vs ${
      redTeam.humans - redTeam.humansSpec
    } humans, ${blueTeam.bots - blueTeam.botsSpec} vs ${redTeam.bots - redTeam.botsSpec} bots, ${
      blueTeam.humans + blueTeam.bots - blueTeam.humansSpec - blueTeam.botsSpec
    } vs ${redTeam.humans + redTeam.bots - redTeam.humansSpec - redTeam.botsSpec} total.`;

    return this.cachedResponseMessage;
  }

  setStatsOutdated(): void {
    this.isStatsOutdated = true;
  }

  onPlayerRespawned(playerId: PlayerId, isSpectateBefore: boolean): void {
    if (isSpectateBefore) {
      this.setStatsOutdated();
    }
  }

  onAnnounceRequest(playerId: PlayerId, _command: string): void {
    if (!this.helpers.isPlayerConnected(playerId)) {
      return;
    }

    const responseMessage = this.getResponseMessage();
    this.emit(BROADCAST_CHAT_SERVER_WHISPER, playerId, responseMessage);
  }

  onTeamCaptured(): void {
    // Keep stats cache fresh after captures without sending chat broadcast spam.
    this.setStatsOutdated();
  }
}
