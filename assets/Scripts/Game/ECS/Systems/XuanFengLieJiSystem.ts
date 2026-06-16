import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ViewComponent } from '../Components/ViewComponent';
import { World } from '../../../Shared/ECS/Core/World';
import { WeaponComponent } from '../Components/WeaponComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { FactionComponent } from '../Components/FactionComponent';

export class XuanFengLieJiSystem extends ECSSystem {
    private world: World;

    constructor(world: World, priority: number) {
        super(priority);
        this.world = world;
    }

    onStart(): void {
        // 初始化
    }

    update(entities: Entity[], deltaTime: number): void {
        this.updateTornadoes(deltaTime);
    }

    private updateTornadoes(deltaTime: number): void {
        const toRemove: Entity[] = [];

        const allEntities = this.world.getAllEntities();
        const tornadoEntities = allEntities.filter(e => (e as any).tornadoData);

        for (const tornadoEntity of tornadoEntities) {
            const tornadoData = (tornadoEntity as any).tornadoData;
            if (!tornadoData) continue;

            const transform = tornadoEntity.getComponent(TransformComponent);
            if (!transform) {
                toRemove.push(tornadoEntity);
                continue;
            }

            tornadoData.elapsedTime += deltaTime;

            if (tornadoData.elapsedTime >= tornadoData.duration) {
                toRemove.push(tornadoEntity);
                continue;
            }

            transform.x += tornadoData.speedX * deltaTime;
            transform.y += tornadoData.speedY * deltaTime;

            const driftAngle = Math.sin(tornadoData.elapsedTime * 3) * 0.1;
            const speed = Math.sqrt(tornadoData.speedX ** 2 + tornadoData.speedY ** 2);
            const currentAngle = Math.atan2(tornadoData.speedY, tornadoData.speedX);
            tornadoData.speedX = Math.cos(currentAngle + driftAngle) * speed;
            tornadoData.speedY = Math.sin(currentAngle + driftAngle) * speed;

            tornadoData.lastDamageTime += deltaTime;
            if (tornadoData.lastDamageTime >= 0.5) {
                tornadoData.lastDamageTime = 0;
                tornadoData.damagedEntities.clear();
                this.checkAndApplyDamage(tornadoEntity);
            }
        }

        for (const entity of toRemove) {
            this.world.destroyEntity(entity);
        }
    }

    private checkAndApplyDamage(tornadoEntity: Entity): void {
        const tornadoData = (tornadoEntity as any).tornadoData;
        if (!tornadoData) return;

        const transform = tornadoEntity.getComponent(TransformComponent);
        if (!transform) return;

        const caster = this.world.getEntity(tornadoData.casterId);
        if (!caster) return;

        let attackPower = 100;
        const weaponComp = caster.getComponent(WeaponComponent);
        if (weaponComp) {
            attackPower = weaponComp.damage || 100;
        }

        const allEntities = this.world.getAllEntities();
        for (const entity of allEntities) {
            if (entity.id === tornadoEntity.id || entity.id === tornadoData.casterId) continue;

            const targetTransform = entity.getComponent(TransformComponent);
            const healthComp = entity.getComponent(HealthComponent);
            
            if (!targetTransform || !healthComp) continue;

            if (!this.isEnemy(entity)) continue;

            const dx = targetTransform.x - transform.x;
            const dy = targetTransform.y - transform.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= tornadoData.radius && !tornadoData.damagedEntities.has(entity.id)) {
                const damage = attackPower * tornadoData.damagePerSecondPct * 0.5;
                const current = healthComp.current;
                healthComp.current = Math.max(0, current - damage);
                tornadoData.damagedEntities.add(entity.id);
            }
        }
    }

    private isEnemy(entity: Entity): boolean {
        const faction = entity.getComponent(FactionComponent);
        if (!faction) return false;
        return faction.faction === 1;
    }

    onDestroy(): void {
        // 清理
    }

    getRequiredComponents(): any[] {
        return [];
    }
}