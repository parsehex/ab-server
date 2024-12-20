import { SHIPS_SPECS, SHIPS_TYPES, UPGRADES_SPECS } from '../../../constants';
import { PLAYERS_REPEL_ADD, PLAYERS_REPEL_DELETE, PLAYERS_SET_SHIP_TYPE } from '../../../events';
import { Player } from '../../../types';
import { System } from '../../system';

export default class GamePlayersShipType extends System {
  constructor({ app }) {
    super({ app });

    this.listeners = {
      [PLAYERS_SET_SHIP_TYPE]: this.onSetPlayerShipType,
    };
  }

  onSetPlayerShipType(player: Player, shipType: number): void {
    const previousType = player.planetype.current;
    const isInfectedMode = this.config.server.typeId === 4;
    const isInfected = isInfectedMode && player.team.current === 2;

    player.planetype.current = shipType;
    player.hitcircles.current = [...SHIPS_SPECS[shipType].collisions];
    if (!isInfected) {
    player.energy.regen =
      SHIPS_SPECS[shipType].energyRegen * UPGRADES_SPECS.ENERGY.factor[player.upgrades.energy];
    } else {
      player.energy.regen = 0.15;
    }

    if (previousType === SHIPS_TYPES.GOLIATH) {
      this.emit(PLAYERS_REPEL_DELETE, player);
    }

    if (shipType === SHIPS_TYPES.GOLIATH) {
      this.emit(PLAYERS_REPEL_ADD, player);
    }
  }
}
