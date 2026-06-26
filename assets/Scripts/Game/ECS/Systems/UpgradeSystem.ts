import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { LevelComponent } from '../Components/LevelComponent';
import { UpgradeableComponent } from '../Components/UpgradeableComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { BaseHealthStatsComponent } from '../Components/BaseHealthStatsComponent';
import { WeaponComponent } from '../Components/WeaponComponent';
import { BaseWeaponStatsComponent } from '../Components/BaseWeaponStatsComponent';
import { DefenseComponent } from '../Components/DefenseComponent';
import { BaseDefenseStatsComponent } from '../Components/BaseDefenseStatsComponent';
import { BaseProductionComponent } from '../Components/BaseProductionComponent';
import { BaseProductionStatsComponent } from '../Components/BaseProductionStatsComponent';

type NumberRule = {
    addPerLevel?: number;
    mulPerLevel?: number;
};

type NumberValue = number | NumberRule;

type UpgradeFields = {
    HealthComponent?: {
        max?: NumberValue;
    };
    DefenseComponent?: {
        defense?: NumberValue;
    };
    BaseProductionComponent?: {
        populationCap?: NumberValue;
        followerCap?: NumberValue;
        followerDesired?: NumberValue;
        productionIntervalSeconds?: NumberValue;
        soldierConfigIds?: string[];
    };
    WeaponComponent?: {
        damage?: NumberValue;
        attackInterval?: NumberValue;
        range?: NumberValue;
        armorPenPct?: number;
        pierceCount?: number;
        projectileSplashRadius?: number;
        projectileSpeed?: NumberValue;
        projectileRadius?: NumberValue;
        projectileLifeSeconds?: NumberValue;
        projectileConfigId?: string;
        meleeRadius?: NumberValue;
        meleeWidth?: NumberValue;
        meleeHeight?: NumberValue;
        meleeLifeSeconds?: NumberValue;
        meleeForwardOffset?: NumberValue;
    };
};

type UpgradeLevel = {
    level: number;
    fields: UpgradeFields;
};

type UpgradeConfig = {
    id: string;
    levels?: UpgradeLevel[];
    fields?: UpgradeFields;
};

export class UpgradeSystem extends ECSSystem {
    private world: World;
    private configs: Record<string, UpgradeConfig>;

    constructor(world: World, configs: Record<string, UpgradeConfig>, priority: number = 6.8) {
        super('UpgradeSystem', priority);
        this.world = world;
        this.configs = configs;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [LevelComponent, UpgradeableComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        for (const entity of entities) {
            const levelComp = entity.getComponent(LevelComponent);
            const upgradeable = entity.getComponent(UpgradeableComponent);
            if (!levelComp || !upgradeable) continue;

            if (!upgradeable.upgradeConfigId) continue;
            const config = this.configs[upgradeable.upgradeConfigId];
            if (!config) continue;

            const level = Math.max(1, Math.floor(levelComp.level));
            if (upgradeable.appliedLevel === level) continue;
            upgradeable.appliedLevel = level;

            const fields = this.getLevelFields(config, level);
            if (!fields) continue;

            this.applyHealth(entity, fields, level);
            this.applyDefense(entity, fields, level);
            this.applyProduction(entity, fields, level);
            this.applyWeapon(entity, fields, level);
        }
    }

    private getLevelFields(config: UpgradeConfig, level: number): UpgradeFields | null {
        if (config.levels && config.levels.length > 0) {
            let chosen = config.levels[0];
            for (const entry of config.levels) {
                if (entry.level === level) return entry.fields;
                if (entry.level <= level && entry.level >= chosen.level) chosen = entry;
                if (level < chosen.level) chosen = entry;
            }
            return chosen.fields;
        }

        return config.fields ?? null;
    }

    private applyHealth(entity: Entity, fields: UpgradeFields, level: number): void {
        const rules = fields.HealthComponent;
        if (!rules) return;

        const health = entity.getComponent(HealthComponent);
        if (!health) return;

        let base = entity.getComponent(BaseHealthStatsComponent);
        if (!base) {
            base = this.world.acquireComponent(BaseHealthStatsComponent);
            base.max = health.max;
            entity.addComponent(base);
        }

        const oldMax = health.max;
        if (rules.max) {
            health.max = this.evalNumberValue(base.max, rules.max, level);
        }

        if (health.current > health.max) health.current = health.max;
        if (health.current === oldMax) health.current = health.max;
    }

    private applyWeapon(entity: Entity, fields: UpgradeFields, level: number): void {
        const rules = fields.WeaponComponent;
        if (!rules) return;

        const weapon = entity.getComponent(WeaponComponent);
        if (!weapon) return;

        let base = entity.getComponent(BaseWeaponStatsComponent);
        if (!base) {
            base = this.world.acquireComponent(BaseWeaponStatsComponent);
            base.attackType = weapon.attackType;
            base.damage = weapon.damage;
            base.attackInterval = weapon.attackInterval;
            base.range = weapon.range;
            base.projectileSpeed = weapon.projectileSpeed;
            base.projectileRadius = weapon.projectileRadius;
            base.projectileLifeSeconds = weapon.projectileLifeSeconds;
            base.meleeRadius = weapon.meleeRadius;
            base.meleeWidth = weapon.meleeWidth;
            base.meleeHeight = weapon.meleeHeight;
            base.meleeLifeSeconds = weapon.meleeLifeSeconds;
            base.meleeForwardOffset = weapon.meleeForwardOffset;
            entity.addComponent(base);
        }

        if (rules.damage) weapon.damage = this.evalNumberValue(base.damage, rules.damage, level);
        if (rules.attackInterval) weapon.attackInterval = this.evalNumberValue(base.attackInterval, rules.attackInterval, level);
        if (rules.range) weapon.range = this.evalNumberValue(base.range, rules.range, level);
        if (rules.projectileSpeed) weapon.projectileSpeed = this.evalNumberValue(base.projectileSpeed, rules.projectileSpeed, level);
        if (rules.projectileRadius) weapon.projectileRadius = this.evalNumberValue(base.projectileRadius, rules.projectileRadius, level);
        if (rules.projectileLifeSeconds) weapon.projectileLifeSeconds = this.evalNumberValue(base.projectileLifeSeconds, rules.projectileLifeSeconds, level);
        if (rules.meleeRadius) weapon.meleeRadius = this.evalNumberValue(base.meleeRadius, rules.meleeRadius, level);
        if (rules.meleeWidth) weapon.meleeWidth = this.evalNumberValue(base.meleeWidth, rules.meleeWidth, level);
        if (rules.meleeHeight) weapon.meleeHeight = this.evalNumberValue(base.meleeHeight, rules.meleeHeight, level);
        if (rules.meleeLifeSeconds) weapon.meleeLifeSeconds = this.evalNumberValue(base.meleeLifeSeconds, rules.meleeLifeSeconds, level);
        if (rules.meleeForwardOffset) weapon.meleeForwardOffset = this.evalNumberValue(base.meleeForwardOffset, rules.meleeForwardOffset, level);
        if (typeof rules.armorPenPct === 'number') weapon.armorPenPct = rules.armorPenPct;
        if (typeof rules.pierceCount === 'number') weapon.pierceCount = rules.pierceCount;
        if (typeof rules.projectileSplashRadius === 'number') weapon.projectileSplashRadius = rules.projectileSplashRadius;
        if (typeof rules.projectileConfigId === 'string') weapon.projectileConfigId = rules.projectileConfigId;
    }

    private applyDefense(entity: Entity, fields: UpgradeFields, level: number): void {
        const rules = fields.DefenseComponent;
        if (!rules) return;

        const defense = entity.getComponent(DefenseComponent);
        if (!defense) return;

        let base = entity.getComponent(BaseDefenseStatsComponent);
        if (!base) {
            base = this.world.acquireComponent(BaseDefenseStatsComponent);
            base.defense = defense.defense;
            entity.addComponent(base);
        }

        if (rules.defense) {
            defense.defense = this.evalNumberValue(base.defense, rules.defense, level);
        }
    }

    private applyProduction(entity: Entity, fields: UpgradeFields, level: number): void {
        const rules = fields.BaseProductionComponent;
        if (!rules) return;

        const prod = entity.getComponent(BaseProductionComponent);
        if (!prod) return;

        let base = entity.getComponent(BaseProductionStatsComponent);
        if (!base) {
            base = this.world.acquireComponent(BaseProductionStatsComponent);
            base.populationCap = prod.populationCap;
            base.followerCap = prod.followerCap;
            base.followerDesired = prod.followerDesired;
            base.productionIntervalSeconds = prod.productionIntervalSeconds;
            entity.addComponent(base);
        }

        if (rules.populationCap) prod.populationCap = this.evalNumberValue(base.populationCap, rules.populationCap, level);
        if (rules.followerCap) prod.followerCap = this.evalNumberValue(base.followerCap, rules.followerCap, level);
        if (rules.followerDesired) prod.followerDesired = this.evalNumberValue(base.followerDesired, rules.followerDesired, level);
        if (rules.productionIntervalSeconds) {
            prod.productionIntervalSeconds = this.evalNumberValue(base.productionIntervalSeconds, rules.productionIntervalSeconds, level);
        }
        if (rules.soldierConfigIds && Array.isArray(rules.soldierConfigIds) && rules.soldierConfigIds.length > 0) {
            prod.soldierConfigIds = rules.soldierConfigIds.filter((x: unknown) => typeof x === 'string' && x.length > 0);
        }

        prod.populationCap = Math.max(0, Math.floor(prod.populationCap));
        prod.followerCap = Math.max(0, Math.floor(prod.followerCap));
        prod.followerDesired = Math.max(0, Math.min(prod.followerCap, Math.floor(prod.followerDesired)));
        prod.productionIntervalSeconds = Math.max(0.05, prod.productionIntervalSeconds);
    }

    private evalNumberRule(base: number, rule: NumberRule, level: number): number {
        const n = Math.max(0, level - 1);
        let value = base;
        if (typeof rule.addPerLevel === 'number') value = value + rule.addPerLevel * n;
        if (typeof rule.mulPerLevel === 'number') value = value * (1 + rule.mulPerLevel * n);
        return value;
    }

    private evalNumberValue(base: number, value: NumberValue, level: number): number {
        if (typeof value === 'number') return value;
        return this.evalNumberRule(base, value, level);
    }
}
