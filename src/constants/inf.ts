import { CTF_TEAMS } from '@airbattle/protocol';

/**
 * x, y, radius.
 */
export const INF_PLAYERS_SPAWN_ZONES = {
  [CTF_TEAMS.BLUE]: [-8580, -1500, 100],
  [CTF_TEAMS.RED]: [0, 0, 250],
};

export const INF_PLAYERS_EXTRA_SPAWN_ZONES = {
  [CTF_TEAMS.BLUE]: {
    NORTH: [2048, -5860, 50],
    SOUTH: [3072, 5120, 50],
  },

  [CTF_TEAMS.RED]: {
    NORTH: [-2340, -5120, 50],
    SOUTH: [-4096, 4535, 50],
  },
};
