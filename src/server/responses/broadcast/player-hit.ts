import { MOB_TYPES, ServerPackets, SERVER_PACKETS } from '@airbattle/protocol';
import { SHIPS_SPECS } from '../../../constants';
import { BROADCAST_PLAYER_HIT, CONNECTIONS_SEND_PACKETS } from '../../../events';
import { MobId, PlayerId, Projectile } from '../../../types';
import { System } from '../../system';

export default class PlayerHitBroadcast extends System {
  constructor({ app }) {
    super({ app });

    this.listeners = {
      [BROADCAST_PLAYER_HIT]: this.onPlayerHit,
    };
  }

  /**
   * Sent on:
   * 1. Projectile hits the player.
   * 2. BTR firewall hits the player.
   * 3. INF Infected player hits the player.
   *
   * Broadcast to all player who sees the victims.
   * Currently `victimIds` always contains only one victim.
   *
   * @param projectileOrPlayerId
   * @param victimIds
   */
  onPlayerHit(projectileOrPlayerId: MobId | PlayerId, victimIds: PlayerId[], isPlayer = false): void {
    if (isPlayer) {
      /**
       * Infected player hit player.
       */
      if (victimIds.length === 0) {
        return;
      }
      
      const player = this.storage.playerList.get(victimIds[0]);
      
      if (!player) {
        return;
      }
      
      const players = [
        {
          id: player.id.current,
          health: player.health.current,
          healthRegen: SHIPS_SPECS[player.planetype.current].healthRegen,
        } as ServerPackets.PlayerHitPlayer,
      ];
      
      const recipients = [...this.storage.broadcast.get(player.id.current)];
      
      this.emit(
        CONNECTIONS_SEND_PACKETS,
        {
          c: SERVER_PACKETS.PLAYER_HIT,
          id: projectileOrPlayerId,
          type: MOB_TYPES.PLAYER,
          posX: player.position.x,
          posY: player.position.y,
          owner: 0,
          players,
        } as ServerPackets.PlayerHit,
        recipients
      );
      return;
    }
    
    if (projectileOrPlayerId !== 0) {
      /**
       * Projectile hit
       */
      if (!this.storage.mobList.has(projectileOrPlayerId) || !this.storage.broadcast.has(projectileOrPlayerId)) {
        return;
      }

      const projectile = this.storage.mobList.get(projectileOrPlayerId) as Projectile;
      const recipients = [...this.storage.broadcast.get(projectileOrPlayerId)];
      const players = [];

      for (let playerIndex = 0; playerIndex < victimIds.length; playerIndex += 1) {
        if (this.storage.playerList.has(victimIds[playerIndex])) {
          const player = this.storage.playerList.get(victimIds[playerIndex]);

          players.push({
            id: player.id.current,
            health: player.health.current,
            healthRegen: SHIPS_SPECS[player.planetype.current].healthRegen,
          } as ServerPackets.PlayerHitPlayer);
        }
      }

      if (players.length === 0) {
        return;
      }

      this.emit(
        CONNECTIONS_SEND_PACKETS,
        {
          c: SERVER_PACKETS.PLAYER_HIT,
          id: projectileOrPlayerId,
          type: projectile.mobtype.current,
          posX: projectile.position.x,
          posY: projectile.position.y,
          owner: projectile.owner.current,
          players,
        } as ServerPackets.PlayerHit,
        recipients
      );
    } else {
      /**
       * BTR firewall hit; assume victimIds only has one entry
       */
      const player = this.storage.playerList.get(victimIds[0]);

      const players = [
        {
          id: player.id.current,
          health: player.health.current,
          healthRegen: SHIPS_SPECS[player.planetype.current].healthRegen,
        } as ServerPackets.PlayerHitPlayer,
      ];

      const recipients = [...this.storage.broadcast.get(player.id.current)];

      this.emit(
        CONNECTIONS_SEND_PACKETS,
        {
          c: SERVER_PACKETS.PLAYER_HIT,
          id: projectileOrPlayerId,
          type: MOB_TYPES.FIREWALL,
          posX: player.position.x,
          posY: player.position.y,
          owner: 0,
          players,
        } as ServerPackets.PlayerHit,
        recipients
      );
    }
  }
}
