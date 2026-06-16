import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { World } from '../../../Shared/ECS/Core/World';
import { WeaponComponent } from '../Components/WeaponComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { ViewComponent } from '../Components/ViewComponent';
import { ProjectileComponent } from '../Components/ProjectileComponent';

export class XingGuiLingZhenSystem extends ECSSystem {
    private world: World;

    constructor(world: World, priority: number) {
        super('XingGuiLingZhenSystem', priority);
        this.world = world;
    }

    onStart(): void {
    }

    update(_entities: Entity[], deltaTime: number): void {
        this.updateMagicBalls(deltaTime);
        this.updateMagicBullets(deltaTime);
        this.updateCasters(deltaTime);
    }

    private updateMagicBalls(deltaTime: number): void {
        const allEntities = this.world.getAllEntities();
        const magicBallEntities = allEntities.filter(e => (e as any).magicBallData);

        for (const ballEntity of magicBallEntities) {
            const ballData = (ballEntity as any).magicBallData;
            if (!ballData) continue;

            const transform = ballEntity.getComponent(TransformComponent);
            if (!transform) continue;

            const caster = this.world.getEntity(ballData.casterId);
            if (!caster) {
                this.world.destroyEntity(ballEntity);
                continue;
            }

            const casterTransform = caster.getComponent(TransformComponent);
            if (!casterTransform) {
                this.world.destroyEntity(ballEntity);
                continue;
            }

            ballData.lastFireTime += deltaTime;

            if (ballData.lastFireTime >= ballData.fireInterval) {
                ballData.lastFireTime = 0;
                ballData.fireCooldownTime = 0.3;
                this.fireMagicBullet(ballEntity);
            }

            if (ballData.fireCooldownTime > 0) {
                ballData.fireCooldownTime -= deltaTime;
            } else {
                ballData.angle += ballData.orbitSpeed * deltaTime;
            }

            const x = casterTransform.x + Math.cos(ballData.angle) * ballData.orbitRadius;
            const y = casterTransform.y + Math.sin(ballData.angle) * ballData.orbitRadius;
            transform.x = x;
            transform.y = y;
        }
    }

    private fireMagicBullet(ballEntity: Entity): void {
        const ballData = (ballEntity as any).magicBallData;
        if (!ballData) return;

        const ballTransform = ballEntity.getComponent(TransformComponent);
        if (!ballTransform) return;

        const caster = this.world.getEntity(ballData.casterId);
        if (!caster) return;

        const target = this.findNearestEnemy(caster, ballData.attackRange);
        if (!target) return;

        const targetTransform = target.getComponent(TransformComponent);
        if (!targetTransform) return;

        const bulletEntity = this.world.createEntity();
        bulletEntity.name = 'MagicBullet';

        const bulletTransform = this.world.acquireComponent(TransformComponent);
        bulletTransform.x = ballTransform.x;
        bulletTransform.y = ballTransform.y;
        bulletTransform.scaleX = 1;
        bulletTransform.scaleY = 1;
        bulletEntity.addComponent(bulletTransform);

        const view = this.world.acquireComponent(ViewComponent);
        view.prefabPath = ballData.bulletPrefab;
        bulletEntity.addComponent(view);

        const projectile = this.world.acquireComponent(ProjectileComponent);
        projectile.ownerId = ballData.casterId;
        projectile.damage = 0;
        projectile.damageType = 'Magic';
        projectile.vx = 0;
        projectile.vy = 0;
        projectile.lifeRemaining = 3;
        projectile.pierceRemaining = 0;
        bulletEntity.addComponent(projectile);

        const dx = targetTransform.x - ballTransform.x;
        const dy = targetTransform.y - ballTransform.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = 300;
        const angle = Math.atan2(dy, dx);
        const angleInDegrees = angle * 180 / Math.PI;

        bulletTransform.rotation = angleInDegrees;

        (bulletEntity as any).magicBulletData = {
            targetId: target.id,
            speedX: (dx / distance) * speed,
            speedY: (dy / distance) * speed,
            elapsedTime: 0,
            damagePerShotPct: ballData.damagePerShotPct,
            casterId: ballData.casterId,
            maxLifeTime: 3
        };
    }

    private updateMagicBullets(deltaTime: number): void {
        const toRemove: Entity[] = [];

        const allEntities = this.world.getAllEntities();
        const bulletEntities = allEntities.filter(e => (e as any).magicBulletData);

        for (const bulletEntity of bulletEntities) {
            const bulletData = (bulletEntity as any).magicBulletData;
            if (!bulletData) continue;

            const transform = bulletEntity.getComponent(TransformComponent);
            if (!transform) {
                toRemove.push(bulletEntity);
                continue;
            }

            transform.x += bulletData.speedX * deltaTime;
            transform.y += bulletData.speedY * deltaTime;

            bulletData.elapsedTime += deltaTime;

            if (bulletData.elapsedTime >= bulletData.maxLifeTime) {
                toRemove.push(bulletEntity);
                continue;
            }

            const target = this.world.getEntity(bulletData.targetId);
            if (!target) {
                toRemove.push(bulletEntity);
                continue;
            }

            const targetTransform = target.getComponent(TransformComponent);
            const healthComp = target.getComponent(HealthComponent);

            if (!targetTransform || !healthComp || healthComp.current <= 0) {
                toRemove.push(bulletEntity);
                continue;
            }

            const dx = targetTransform.x - transform.x;
            const dy = targetTransform.y - transform.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= 15) {
                this.applyBulletDamage(bulletEntity);
                toRemove.push(bulletEntity);
            }
        }

        for (const entity of toRemove) {
            this.world.destroyEntity(entity);
        }
    }

    private applyBulletDamage(bulletEntity: Entity): void {
        const bulletData = (bulletEntity as any).magicBulletData;
        if (!bulletData) return;

        const caster = this.world.getEntity(bulletData.casterId);
        if (!caster) return;

        const target = this.world.getEntity(bulletData.targetId);
        if (!target) return;

        let attackPower = 100;
        const weaponComp = caster.getComponent(WeaponComponent);
        if (weaponComp) {
            attackPower = weaponComp.damage || 100;
        }

        const healthComp = target.getComponent(HealthComponent);
        if (healthComp) {
            const damage = attackPower * bulletData.damagePerShotPct;
            const current = healthComp.current;
            healthComp.current = Math.max(0, current - damage);
        }
    }

    private findNearestEnemy(caster: Entity, range: number): Entity | null {
        const casterTransform = caster.getComponent(TransformComponent);
        if (!casterTransform) return null;

        let nearestEnemy: Entity | null = null;
        let nearestDistance = range;

        const allEntities = this.world.getAllEntities();
        for (const entity of allEntities) {
            if (entity.id === caster.id) continue;

            if (!this.isEnemy(entity)) continue;

            const targetTransform = entity.getComponent(TransformComponent);
            const healthComp = entity.getComponent(HealthComponent);

            if (!targetTransform || !healthComp || healthComp.current <= 0) continue;

            const dx = targetTransform.x - casterTransform.x;
            const dy = targetTransform.y - casterTransform.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= range && distance < nearestDistance) {
                nearestDistance = distance;
                nearestEnemy = entity;
            }
        }

        return nearestEnemy;
    }

    private updateCasters(deltaTime: number): void {
        const allEntities = this.world.getAllEntities();
        for (const entity of allEntities) {
            const xglzData = (entity as any).xingGuiLingZhenData;
            if (!xglzData) continue;

            xglzData.elapsedTime += deltaTime;

            if (xglzData.elapsedTime >= xglzData.duration) {
                this.removeXingGuiLingZhen(entity);
            }
        }
    }

    private removeXingGuiLingZhen(caster: Entity): void {
        const casterId = caster.id;

        const allEntities = this.world.getAllEntities();
        const magicBallEntities = allEntities.filter(e => {
            const ballData = (e as any).magicBallData;
            return ballData && ballData.casterId === casterId;
        });

        const bulletEntities = allEntities.filter(e => {
            const bulletData = (e as any).magicBulletData;
            return bulletData && bulletData.casterId === casterId;
        });

        for (const ballEntity of magicBallEntities) {
            this.world.destroyEntity(ballEntity);
        }

        for (const bulletEntity of bulletEntities) {
            this.world.destroyEntity(bulletEntity);
        }

        (caster as any).xingGuiLingZhenData = null;
    }

    private isEnemy(entity: Entity): boolean {
        const faction = entity.getComponent(FactionComponent);
        if (!faction) return false;
        return faction.faction === 1;
    }

    onDestroy(): void {
    }

    getRequiredComponents(): any[] {
        return [];
    }
}