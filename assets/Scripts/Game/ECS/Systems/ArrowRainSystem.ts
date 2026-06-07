import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { ProjectileComponent } from '../Components/ProjectileComponent';
import { WeaponComponent } from '../Components/WeaponComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { FactionType } from '../../Data/Faction';
import { ViewComponent } from '../Components/ViewComponent';
import { ArrowRainComponent } from '../Components/ArrowRainComponent';

export class ArrowRainSystem extends ECSSystem {
    private world: World;

    constructor(world: World, priority: number = 7.8) {
        super('ArrowRainSystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [ArrowRainComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        const dt = Math.max(0, deltaTime);
        for (const entity of entities) {
            const rain = entity.getComponent(ArrowRainComponent);
            if (!rain) continue;

            rain.timeRemaining -= dt;
            rain.nextWaveIn -= dt;
            rain.nextArrowIn -= dt;

            const owner = rain.ownerId ? this.world.getEntity(rain.ownerId) : null;
            const ownerTr = owner?.getComponent(TransformComponent) ?? null;
            const weapon = owner?.getComponent(WeaponComponent) ?? null;
            const ownerFaction = owner?.getComponent(FactionComponent)?.faction ?? FactionType.Player;
            if (!ownerTr || !weapon) {
                this.world.destroyEntity(entity);
                continue;
            }

            while (rain.nextWaveIn <= 0 && rain.waveCount > 0 && rain.timeRemaining > 0) {
                rain.waveCount--;
                rain.arrowSpawnRemaining = Math.max(0, Math.floor(rain.arrowsPerWave));
                rain.nextArrowIn = 0;
                rain.nextWaveIn += rain.waveInterval > 0 ? rain.waveInterval : 0.2;
            }

            const arrowsPerWave = Math.max(0, Math.floor(rain.arrowsPerWave));
            const arrowIntervalBase = arrowsPerWave > 0 ? (rain.waveInterval > 0 ? rain.waveInterval / arrowsPerWave : 0.02) : 0;
            while (rain.nextArrowIn <= 0 && rain.arrowSpawnRemaining > 0 && rain.timeRemaining > 0) {
                this.spawnArrow(rain, ownerTr, weapon, ownerFaction);
                rain.arrowSpawnRemaining--;
                const jitter = Math.random() * 0.02;
                rain.nextArrowIn += Math.max(0.01, arrowIntervalBase + jitter);
            }

            if (rain.timeRemaining <= 0 || (rain.waveCount <= 0 && rain.arrowSpawnRemaining <= 0)) {
                this.world.destroyEntity(entity);
            }
        }
    }

    private spawnArrow(rain: ArrowRainComponent, ownerTr: TransformComponent, weapon: WeaponComponent, ownerFaction: FactionType): void {
        const radius = Math.max(0, rain.radius);
        const spawnH = Math.max(0, rain.spawnExtraHeight);
        const speed = Math.max(1, rain.arrowSpeed);
        const lifeSeconds = Math.max(0.05, spawnH / speed);

        const pierce = Math.max(0, Math.floor(rain.pierceTargets));
        const pierceRemaining = pierce >= 999 ? 999999 : pierce;
        const damageCoeff = Math.max(0, rain.damageCoeffPerArrow);

        const u = Math.random();
        const v = Math.random();
        const rr = Math.sqrt(u) * radius;
        const ang = v * Math.PI * 2;
        const landX = ownerTr.x + Math.cos(ang) * rr;
        const landY = ownerTr.y + Math.sin(ang) * rr;
        const startY = landY + spawnH;

        const projEnt = this.world.createEntity(`Effect_SkyfallArrow_${rain.ownerId}_${Date.now()}`);

        const tr = this.world.acquireComponent(TransformComponent);
        tr.x = landX;
        tr.y = startY;
        tr.rotation = -90;
        projEnt.addComponent(tr);

        const proj = this.world.acquireComponent(ProjectileComponent);
        proj.ownerId = rain.ownerId;
        proj.damage = Math.max(0, weapon.damage);
        proj.damageType = 'Physical';
        proj.armorPenPct = weapon.armorPenPct;
        proj.skillMultiplier = damageCoeff;
        proj.critChance = weapon.critChance;
        proj.critMultiplier = weapon.critMultiplier;
        proj.finalDamageBonusPct = weapon.finalDamageBonusPct;
        proj.vx = 0;
        proj.vy = -speed;
        proj.lifeRemaining = lifeSeconds;
        proj.pierceRemaining = pierceRemaining;
        projEnt.addComponent(proj);

        const faction = this.world.acquireComponent(FactionComponent);
        faction.faction = ownerFaction;
        projEnt.addComponent(faction);

        const col = this.world.acquireComponent(ColliderComponent);
        col.shape = ColliderShapeType.Circle;
        col.isTrigger = true;
        col.radius = Math.max(1, rain.colliderRadius);
        col.offsetX = 0;
        col.offsetY = 0;
        col.layer = ownerFaction === FactionType.Player ? 4 : 8;
        col.mask = ownerFaction === FactionType.Player ? 2 : 1;
        projEnt.addComponent(col);

        if (rain.prefabPath) {
            const view = this.world.acquireComponent(ViewComponent);
            view.prefabPath = rain.prefabPath;
            projEnt.addComponent(view);
        }
    }
}
