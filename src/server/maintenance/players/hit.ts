import { MOB_TYPES } from '@airbattle/protocol';
import { PLAYERS_HEALTH, PROJECTILES_SPECS, SHIPS_SPECS, UPGRADES_SPECS } from '../../../constants';
import { BROADCAST_EVENT_STEALTH, BROADCAST_PLAYER_KILL, BROADCAST_PLAYER_UPDATE, PLAYERS_HIT, PLAYERS_KILL } from '../../../events';
import { MobId, PlayerId, Projectile } from '../../../types';
import { System } from '../../system';

export default class GamePlayersHit extends System {
  constructor({ app }) {
    super({ app });

    this.listeners = {
      [PLAYERS_HIT]: this.onHitPlayer,
    };
  }

  /**
   * Hit the player.
   *
   * @param victimId
   * @param projectileId
   * @param firewallDamage used if projectileId is zero
   */
  onHitPlayer(victimId: PlayerId, projectileId: MobId, firewallDamage: number): void {
    /**
     * Check current game status.
     */
    if (!this.storage.gameEntity.match.isActive) {
      return;
    }

    const now = Date.now();
    const victim = this.storage.playerList.get(victimId);
    let damage: number;
    let aggressorId = 0;

    if (victim.planestate.stealthed) {
      victim.planestate.stealthed = false;
      victim.times.lastStealth = now;

      this.delay(BROADCAST_EVENT_STEALTH, victim.id.current);
      this.delay(BROADCAST_PLAYER_UPDATE, victim.id.current);
    }

    const projectile = this.storage.mobList.get(projectileId) as Projectile;
    const gameType = this.config.server.typeId;

    if (projectileId === 0) {
      /**
       * Projectile zero is the BTR firewall
       */
      damage = firewallDamage;
    }  else if (!projectile.owner && gameType === 4) { // INF
      const aggressorId = projectileId;
      const aggressor = this.storage.playerList.get(aggressorId);

      if (!aggressor) {
        return;
      }
      if (victim.shield.current) {
        return;
      }

      victim.times.lastHit = now;
      victim.damage.hitsReceived += 1;
      damage = PROJECTILES_SPECS[MOB_TYPES.COPTER_MISSILE].damage;

      // apply damage
      const fullAirplaneHealth =
        (1 / SHIPS_SPECS[victim.planetype.current].damageFactor) *
        UPGRADES_SPECS.DEFENSE.factor[victim.upgrades.defense];
      victim.health.current = fullAirplaneHealth * victim.health.current - damage;
      victim.health.current /= fullAirplaneHealth;

      if (victim.health.current <= PLAYERS_HEALTH.MIN) {
        victim.health.current = PLAYERS_HEALTH.MIN;

        // player is dead
        this.emit(PLAYERS_KILL, aggressorId, victimId, true);
        this.emit(BROADCAST_PLAYER_KILL, aggressorId, victimId);
      }

      return;
    } else {
      if (victim.shield.current) {
        return;
      }

      aggressorId = projectile.owner.current;
      victim.times.lastHit = now;
      victim.damage.hitsReceived += 1;
      damage = PROJECTILES_SPECS[projectile.mobtype.current].damage;

      /**
       * Extra damage by repel.
       */
      if (projectile.damage.double) {
        damage *= 2;
      }

      /**
       * Tracking projectile owner damage.
       */
      if (this.helpers.isPlayerConnected(projectile.owner.current)) {
        const owner = this.storage.playerList.get(projectile.owner.current);
        const trackingDamage = Math.round(
          PROJECTILES_SPECS[projectile.mobtype.current].damage * 100
        );

        owner.damage.current += trackingDamage;
        owner.damage.hits += 1;

        if (this.storage.botIdList.has(victimId)) {
          owner.damage.bots += trackingDamage;
          owner.damage.hitsToBots += 1;
        }

        if (this.storage.botIdList.has(projectile.owner.current)) {
          victim.damage.hitsByBots += 1;
        }
      }
    }

    /**
     * Health value refers to Goliath health 1 (max among the airplanes).
     * Goliath = 1 / 1 = 1;
     * Predator = 1 / 2 = 0.5;
     * etc.
     */
    const fullAirplaneHealth =
      (1 / SHIPS_SPECS[victim.planetype.current].damageFactor) *
      UPGRADES_SPECS.DEFENSE.factor[victim.upgrades.defense];

    victim.health.current = fullAirplaneHealth * victim.health.current - damage;

    if (this.config.killAssists) {
      victim.damage.takenTraking.push(aggressorId, damage / fullAirplaneHealth);

      /**
       * Limit records.
       */
      if (victim.damage.takenTraking.length > 30) {
        victim.damage.takenTraking.splice(0, 2);
      }
    }

    if (victim.health.current <= PLAYERS_HEALTH.MIN) {
      if (this.config.killAssists) {
        /**
         * Subtract extra damage from the last record.
         */
        victim.damage.takenTraking[victim.damage.takenTraking.length - 1] +=
          victim.health.current / fullAirplaneHealth;
      }

      /**
       * Player is dead.
       */
      victim.health.current = PLAYERS_HEALTH.MIN;
    } else {
      /**
       * % of the full health.
       */
      victim.health.current /= fullAirplaneHealth;
    }
  }
}
