import { CTF_TEAMS } from '@airbattle/protocol';
import { INF_PLAYERS_SPAWN_ZONES } from '../../../constants';
import {
  BROADCAST_CHAT_SERVER_PUBLIC,
  BROADCAST_PLAYER_RETEAM,
  CTF_SHUFFLE_PLAYERS,
  CTF_TEAMS_RESHUFFLED,
  PLAYERS_ASSIGN_SPAWN_POSITION,
  PLAYERS_ASSIGN_TEAM,
  PLAYERS_UPDATE_TEAM,
  TIMELINE_BEFORE_GAME_START,
} from '../../../events';
import { System } from '../../../server/system';
import { getRandomInt } from '../../../support/numbers';
import { Player, PlayerId, TeamId } from '../../../types';

interface ShuffleRateItem {
  id: PlayerId;
  score: number;
}

export default class GamePlayers extends System {
  constructor({ app }) {
    super({ app });

    this.listeners = {
      [TIMELINE_BEFORE_GAME_START]: this.initTeams,
      [PLAYERS_ASSIGN_TEAM]: this.onAssignPlayerTeam,
      [PLAYERS_ASSIGN_SPAWN_POSITION]: this.onAssignPlayerSpawnPosition,
      [CTF_SHUFFLE_PLAYERS]: this.onShufflePlayers,
    };
  }

  initTeams(): void {
    this.storage.connectionIdByTeam.set(CTF_TEAMS.BLUE, new Set());
    this.storage.connectionIdByTeam.set(CTF_TEAMS.RED, new Set());
  }

  onAssignPlayerTeam(player: Player): void {
    let blueTeam = 0;
    let redTeam = 0;

    if (player.bot.current) {
      this.storage.botIdList.forEach(botId => {
        const bot = this.storage.playerList.get(botId);

        if (bot.team.current === CTF_TEAMS.BLUE) {
          blueTeam += 1;
        } else {
          redTeam += 1;
        }
      });
    } else {
      blueTeam = this.storage.connectionIdByTeam.get(CTF_TEAMS.BLUE).size;
      redTeam = this.storage.connectionIdByTeam.get(CTF_TEAMS.RED).size;
    }

    if (player.bot.current) {
      const redRatio = redTeam / (redTeam + blueTeam);
      // if red team has less than 1/3 of total players, assign to red
      // otherwise assign to blue
      player.team.current = redRatio < 0.33 ? CTF_TEAMS.RED : CTF_TEAMS.BLUE;
    }

    player.team.current = blueTeam > redTeam ? CTF_TEAMS.RED : CTF_TEAMS.BLUE;

    this.log.debug(`Player ${player.id.current} assigned to team ${player.team.current}`);
  }

  onAssignPlayerSpawnPosition(player: Player): void {
    const isBlue = player.team.current === CTF_TEAMS.BLUE;
    let x = 0;
    let y = 0;
    let r = 0;

    if (
      player.bot.current ||
      !player.alivestatus.isLastStateKilled ||
      !this.config.ctf.extraSpawns
    ) {
      if (isBlue) {
        [x, y, r] = INF_PLAYERS_SPAWN_ZONES[CTF_TEAMS.BLUE];
      } else {
        [x, y, r] = INF_PLAYERS_SPAWN_ZONES[CTF_TEAMS.RED];
      }
    }

    player.position.x = x + getRandomInt(-r, r);
    player.position.y = y + getRandomInt(-r, r);
  }

  onShufflePlayers(): void {
    const playingHumansRateList: ShuffleRateItem[] = [];
    const spectatingHumansRateList: ShuffleRateItem[] = [];
    const totalPlayers = this.storage.playerList.size;

    if (totalPlayers === 0) {
      return;
    }

    let kills = 0;
    let deaths = 0;
    let damage = 0;
    let carriersKills = 0;
    let carriersKillsPlayers = 0;
    let deathsWithFlag = 0;
    let deathsWithFlagPlayers = 0;
    let capAttempts = 0;
    let capAttemptsPlayers = 0;
    let capSaves = 0;
    let capSavesPlayers = 0;
    let successCaps = 0;
    let successCapsPlayers = 0;
    let recaptures = 0;
    let recapturesPlayers = 0;

    let playersIterator = this.storage.playerList.values();
    let player: Player = playersIterator.next().value;

    while (player !== undefined) {
      kills += player.kills.current;
      deaths += player.deaths.current;
      damage += player.damage.current;

      if (player.kills.carriers > 0) {
        carriersKills += player.kills.carriers;
        carriersKillsPlayers += 1;
      }

      if (player.deaths.withFlag > 0) {
        deathsWithFlag += player.deaths.withFlag;
        deathsWithFlagPlayers += 1;
      }

      if (player.captures.attempts > 0) {
        capAttempts += player.captures.attempts;
        capAttemptsPlayers += 1;
      }

      if (player.captures.saves > 0) {
        capSaves += player.captures.saves;
        capSavesPlayers += 1;
      }

      if (player.captures.current > 0) {
        successCaps += player.captures.current;
        successCapsPlayers += 1;
      }

      if (player.recaptures.current > 0) {
        recaptures += player.recaptures.current;
        recapturesPlayers += 1;
      }

      player = playersIterator.next().value;
    }

    if (deaths === 0) {
      deaths = 1;
    }

    if (carriersKillsPlayers === 0) {
      carriersKillsPlayers = 1;
    }

    if (deathsWithFlagPlayers === 0) {
      deathsWithFlagPlayers = 1;
    }

    if (capAttemptsPlayers === 0) {
      capAttemptsPlayers = 1;
    }

    if (capSavesPlayers === 0) {
      capSavesPlayers = 1;
    }

    if (successCapsPlayers === 0) {
      successCapsPlayers = 1;
    }

    if (recapturesPlayers === 0) {
      recapturesPlayers = 1;
    }

    playersIterator = this.storage.playerList.values();
    player = playersIterator.next().value;

    while (player !== undefined) {
      if (player.bot.current) {
        player = playersIterator.next().value;

        continue;
      }

      const kd = player.kills.current / (player.deaths.current === 0 ? 1 : player.deaths.current);
      let score = 1;

      if (kd >= kills / deaths) {
        score += 1;
      }

      if (player.damage.current >= damage / totalPlayers) {
        score += 1;
      }

      if (carriersKills !== 0 && player.kills.carriers >= carriersKills / carriersKillsPlayers) {
        score += 1;
      }

      if (deathsWithFlag !== 0 && player.deaths.withFlag < deathsWithFlag / deathsWithFlagPlayers) {
        score += 1;
      }

      if (successCaps !== 0 && player.captures.current >= successCaps / successCapsPlayers) {
        score += 1;
      }

      if (capAttempts !== 0 && player.captures.attempts >= capAttempts / capAttemptsPlayers) {
        score += 1;
      }

      if (capSaves !== 0 && player.captures.saves >= capSaves / capSavesPlayers) {
        score += 1;
      }

      if (recaptures !== 0 && player.recaptures.current >= recaptures / recapturesPlayers) {
        score += 1;
      }

      if (!player.spectate.current) {
        playingHumansRateList.push({
          id: player.id.current,
          score,
        });
      } else {
        spectatingHumansRateList.push({
          id: player.id.current,
          score,
        });
      }

      player = playersIterator.next().value;
    }

    playingHumansRateList.sort((p1, p2) => p2.score - p1.score);
    spectatingHumansRateList.sort((p1, p2) => p2.score - p1.score);

    const broadcastReteamPlayerIdList: PlayerId[] = [];
    const firstTeam = getRandomInt(0, 1) === 0 ? CTF_TEAMS.BLUE : CTF_TEAMS.RED;
    const secondTeam = firstTeam === CTF_TEAMS.BLUE ? CTF_TEAMS.RED : CTF_TEAMS.BLUE;
    let firstTeamHumans = 0;
    let secondTeamHumans = 0;
    let firstTeamScore = 0;
    let secondTeamScore = 0;

    /**
     * Shuffle not AFK humans.
     */
    const maxHumansDiff = playingHumansRateList.length % 2;
    let shuffleTeam: TeamId = null;

    for (let index = 0; index < playingHumansRateList.length; index += 1) {
      const { id, score } = playingHumansRateList[index];
      const humanPlayer = this.storage.playerList.get(id);
      const playerTeam = humanPlayer.team.current;

      if (firstTeamScore <= secondTeamScore || firstTeamHumans < secondTeamHumans - maxHumansDiff) {
        shuffleTeam = firstTeam;
        firstTeamHumans += 1;
        firstTeamScore += score;

        this.emit(PLAYERS_UPDATE_TEAM, id, firstTeam);
      } else {
        shuffleTeam = secondTeam;
        secondTeamHumans += 1;
        secondTeamScore += score;

        this.emit(PLAYERS_UPDATE_TEAM, id, secondTeam);
      }

      if (playerTeam !== shuffleTeam) {
        broadcastReteamPlayerIdList.push(id);
      }
    }

    if (firstTeamHumans <= secondTeamHumans) {
      shuffleTeam = firstTeam;
    } else {
      shuffleTeam = secondTeam;
    }

    /**
     * Shuffle AFK humans.
     */
    for (let index = 0; index < spectatingHumansRateList.length; index += 1) {
      const { id } = spectatingHumansRateList[index];
      const humanPlayer = this.storage.playerList.get(id);
      const playerTeam = humanPlayer.team.current;

      if (playerTeam !== shuffleTeam) {
        broadcastReteamPlayerIdList.push(id);

        this.emit(PLAYERS_UPDATE_TEAM, id, shuffleTeam);
      }

      shuffleTeam = shuffleTeam === firstTeam ? secondTeam : firstTeam;
    }

    /**
     * Shuffle bots.
     */
    let blueTeamBots = 0;
    let redTeamBots = 0;

    this.storage.botIdList.forEach(botId => {
      const bot = this.storage.playerList.get(botId);
      const botTeam = bot.team.current;

      if (shuffleTeam === CTF_TEAMS.BLUE) {
        blueTeamBots += 1;
      } else {
        redTeamBots += 1;
      }

      if (botTeam !== shuffleTeam) {
        broadcastReteamPlayerIdList.push(botId);

        this.emit(PLAYERS_UPDATE_TEAM, botId, shuffleTeam);
      }

      shuffleTeam = shuffleTeam === CTF_TEAMS.RED ? CTF_TEAMS.BLUE : CTF_TEAMS.RED;
    });

    this.emit(BROADCAST_PLAYER_RETEAM, broadcastReteamPlayerIdList);
    this.emit(CTF_TEAMS_RESHUFFLED);

    let blueTeamHumans = 0;
    let redTeamHumans = 0;
    let blueTeamScore = 0;
    let redTeamScore = 0;

    if (firstTeam === CTF_TEAMS.BLUE) {
      blueTeamHumans = firstTeamHumans;
      redTeamHumans = secondTeamHumans;
      blueTeamScore = firstTeamScore;
      redTeamScore = secondTeamScore;
    } else {
      blueTeamHumans = secondTeamHumans;
      redTeamHumans = firstTeamHumans;
      blueTeamScore = secondTeamScore;
      redTeamScore = firstTeamScore;
    }

    this.emit(
      BROADCAST_CHAT_SERVER_PUBLIC,
      `Teams reshuffled: ${blueTeamHumans} vs ${redTeamHumans} humans, ${blueTeamBots} vs ${redTeamBots} bots, ${
        blueTeamHumans + blueTeamBots
      } vs ${redTeamHumans + redTeamBots} total. Balance scores: ${
        blueTeamScore + blueTeamBots
      } vs ${redTeamScore + redTeamBots}.`
    );
  }
}
