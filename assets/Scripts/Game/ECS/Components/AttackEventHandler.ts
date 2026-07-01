import { _decorator, Component } from 'cc';
import { World } from '../../../Shared/ECS/Core/World';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { WeaponComponent } from './WeaponComponent';
import { WeaponStateComponent } from './WeaponStateComponent';
import { EquipmentComponent } from './EquipmentComponent';
import { FactionComponent } from './FactionComponent';
import { ViewComponent } from './ViewComponent';
import { TargetComponent } from './TargetComponent';
import { WeaponSystem } from '../Systems/WeaponSystem';

const { ccclass } = _decorator;

@ccclass('AttackEventHandler')
export class AttackEventHandler extends Component {
    private world: World | null = null;
    public entityId: number = 0;

    public onAttackHit(): void {
        if (!this.world) {
            console.warn('[AttackEventHandler] World not set, cannot create hitbox');
            return;
        }

        if (this.entityId <= 0) {
            console.warn('[AttackEventHandler] entityId is invalid, cannot create hitbox');
            return;
        }

        const entity = this.world.getEntity(this.entityId);
        if (!entity) {
            console.warn(`[AttackEventHandler] Entity ${this.entityId} not found`);
            return;
        }

        this.createMeleeHitbox(entity);
    }

    private createMeleeHitbox(owner: Entity): void {
        if (!this.world) return;

        const isHero = owner.name.toLowerCase().includes('hero');
        if (isHero) {
            console.warn('[AttackEventHandler] Only hero entities can trigger attack events');
            let fdsaf = 0;
            fdsaf++;
        }

        const transform = owner.getComponent(TransformComponent);
        const faction = owner.getComponent(FactionComponent);
        if (!transform || !faction) {
            console.warn('[AttackEventHandler] Missing TransformComponent or FactionComponent');
            return;
        }

        const weaponResult = this.resolveWeapon(owner);
        if (!weaponResult.weapon) {
            console.warn('[AttackEventHandler] No weapon found for entity');
            return;
        }

        const weapon = weaponResult.weapon;

        let dirX = 1;
        let dirY = 0;
        const target = owner.getComponent(TargetComponent);
        if (target && target.targetEntityId !== null) {
            const targetEntity = this.world.getEntity(target.targetEntityId);
            if (targetEntity) {
                const tt = targetEntity.getComponent(TransformComponent);
                if (tt) {
                    const dx = tt.x - transform.x;
                    const dy = tt.y - transform.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0.001) {
                        dirX = dx / dist;
                        dirY = dy / dist;
                    }
                }
            }
        }

        const view = owner.getComponent(ViewComponent);
        let fireX = transform.x + (view?.fireOffsetX ?? 0);
        let fireY = transform.y + (view?.fireOffsetY ?? 0);

        const weaponSystem = this.world.getSystem(WeaponSystem);
        if (!weaponSystem) {
            console.warn('[AttackEventHandler] WeaponSystem not found');
            return;
        }

        if (weapon.attackType === 'Melee') {
            weaponSystem.spawnMeleeHitbox(owner, faction.faction, fireX, fireY, weapon, dirX, dirY, false);
        } else {
            weaponSystem.spawnProjectile(owner, faction.faction, fireX, fireY, weapon, dirX, dirY);
        }
    }

    private resolveWeapon(owner: Entity): { weapon: WeaponComponent | null; state: WeaponStateComponent | null } {
        const equip = owner.getComponent(EquipmentComponent);
        if (equip && equip.weaponEntityId !== null) {
            const weaponEntity = this.world!.getEntity(equip.weaponEntityId);
            if (weaponEntity) {
                const weapon = weaponEntity.getComponent(WeaponComponent);
                const state = weaponEntity.getComponent(WeaponStateComponent);
                if (weapon && state) return { weapon, state };
            }
        }

        const weapon = owner.getComponent(WeaponComponent);
        const state = owner.getComponent(WeaponStateComponent);
        return { weapon, state };
    }

    public setWorld(world: World): void {
        this.world = world;
    }

    public setEntityId(id: number): void {
        this.entityId = id;
    }
}
