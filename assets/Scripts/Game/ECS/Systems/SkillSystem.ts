import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { SkillComponent } from '../Components/SkillComponent';
import { SkillStateComponent } from '../Components/SkillStateComponent';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { MeleeHitboxComponent } from '../Components/MeleeHitboxComponent';
import { RenderComponent } from '../../../Shared/ECS/Components/RenderComponent';

export type SkillTargetType = 'None' | 'Self' | 'Enemy' | 'Ally' | 'Point' | 'Area';
export type SkillCastType = 'Active' | 'Passive';

export type SkillLevelConfig = {
    level: number;
    cooldownSeconds: number;
    power?: number;
    bonusPct?: number;
};

export type SkillConfig = {
    id: string;
    name?: string;
    description?: string;
    castType?: SkillCastType;
    targetType?: SkillTargetType;
    maxLevel?: number;
    defaultCooldownSeconds?: number;
    levels?: SkillLevelConfig[];
};

export class SkillSystem extends ECSSystem {
    private world: World;
    private configs: Record<string, SkillConfig>;

    constructor(world: World, configs: Record<string, SkillConfig>, priority: number = 6.4) {
        super('SkillSystem', priority);
        this.world = world;
        this.configs = configs;
    }

    public getRequiredComponents(): (new (...args: any[]) => any)[] {
        return [SkillComponent, SkillStateComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        for (const entity of entities) {
            const skillComponent = entity.getComponent(SkillComponent);
            const skillState = entity.getComponent(SkillStateComponent);
            if (!skillComponent || !skillState) continue;

            this.ensureSkillState(skillComponent, skillState);
            this.updateCooldowns(skillComponent, skillState, deltaTime);
            this.processRequestedCast(entity, skillComponent, skillState);
        }
    }

    public requestCast(entityId: number, skillIndex: number, targetEntityId: number | null = null, targetX: number = 0, targetY: number = 0): boolean {
        const entity = this.world.getEntity(entityId);
        if (!entity) return false;

        const skill = entity.getComponent(SkillComponent);
        const state = entity.getComponent(SkillStateComponent);
        if (!skill || !state) return false;

        if (skillIndex < 0 || skillIndex >= skill.skillConfigIds.length) return false;
        if (state.skillCooldownRemaining[skillIndex] > 0) return false;

        state.requestedSkillIndex = skillIndex;
        state.requestedTargetEntityId = targetEntityId;
        state.requestedTargetX = targetX;
        state.requestedTargetY = targetY;
        return true;
    }

    private ensureSkillState(skill: SkillComponent, state: SkillStateComponent): void {
        const count = skill.skillConfigIds.length;
        while (state.skillCooldownRemaining.length < count) {
            state.skillCooldownRemaining.push(0);
        }
        while (state.skillCooldownRemaining.length > count) {
            state.skillCooldownRemaining.pop();
        }

        while (skill.skillLevels.length < count) {
            skill.skillLevels.push(1);
        }
        while (skill.skillLevels.length > count) {
            skill.skillLevels.pop();
        }

        while (skill.autoCastEnabled.length < count) {
            skill.autoCastEnabled.push(false);
        }
        while (skill.autoCastEnabled.length > count) {
            skill.autoCastEnabled.pop();
        }
    }

    private updateCooldowns(skill: SkillComponent, state: SkillStateComponent, deltaTime: number): void {
        for (let index = 0; index < state.skillCooldownRemaining.length; index++) {
            if (state.skillCooldownRemaining[index] > 0) {
                state.skillCooldownRemaining[index] = Math.max(0, state.skillCooldownRemaining[index] - deltaTime);
            }
        }
    }

    private processRequestedCast(entity: Entity, skill: SkillComponent, state: SkillStateComponent): void {
        const requestedIndex = state.requestedSkillIndex;
        if (requestedIndex < 0 || requestedIndex >= skill.skillConfigIds.length) {
            return;
        }

        const configId = skill.skillConfigIds[requestedIndex];
        const config = this.configs[configId];
        if (!config) {
            console.warn(`[SkillSystem] Skill config not found: ${configId}`);
            state.requestedSkillIndex = -1;
            return;
        }

        const level = Math.max(1, Math.floor(skill.skillLevels[requestedIndex] ?? 1));
        const cooldown = this.getCooldown(config, level);
        if (state.skillCooldownRemaining[requestedIndex] > 0) {
            state.requestedSkillIndex = -1;
            return;
        }

        this.executeSkill(entity, configId, config, level, state.requestedTargetEntityId, state.requestedTargetX, state.requestedTargetY);
        state.skillCooldownRemaining[requestedIndex] = cooldown;
        state.requestedSkillIndex = -1;
        state.requestedTargetEntityId = null;
    }

    private getCooldown(config: SkillConfig, level: number): number {
        const levelConfig = this.resolveLevelConfig(config, level);
        if (levelConfig && typeof levelConfig.cooldownSeconds === 'number') {
            return Math.max(0.01, levelConfig.cooldownSeconds);
        }
        return Math.max(0.01, config.defaultCooldownSeconds ?? 1);
    }

    private resolveLevelConfig(config: SkillConfig, level: number): SkillLevelConfig | null {
        if (!Array.isArray(config.levels) || config.levels.length === 0) {
            return null;
        }
        let candidate = config.levels[0];
        for (const entry of config.levels) {
            if (entry.level === level) return entry;
            if (entry.level <= level && entry.level > candidate.level) {
                candidate = entry;
            }
        }
        return candidate;
    }

    private executeSkill(
        entity: Entity,
        configId: string,
        config: SkillConfig,
        level: number,
        targetEntityId: number | null,
        targetX: number,
        targetY: number
    ): void {
        const targetDesc = targetEntityId !== null ? `entity ${targetEntityId}` : `position (${targetX.toFixed(1)}, ${targetY.toFixed(1)})`;
        console.log(
            `[SkillSystem] ${entity.name} cast skill ${configId} level ${level} on ${targetDesc}`
        );

        // 此处为技能执行框架占位：
        // 后续可以根据 config.castType / config.targetType / config.levels
        // 实现具体的伤害、治疗、buff、召唤等效果。
        const levelCfg = this.resolveLevelConfig(config, level);
        const power = (levelCfg && typeof levelCfg.power === 'number') ? levelCfg.power : 0;

        if (power <= 0) return;

        // compute spawn position: target entity center if provided, otherwise provided coords or caster
        let sx = targetX;
        let sy = targetY;
        if (targetEntityId !== null) {
            const te = this.world.getEntity(targetEntityId);
            const ttr = te?.getComponent(TransformComponent);
            if (ttr) {
                sx = ttr.x;
                sy = ttr.y;
            }
        }

        if (Number.isNaN(sx) || Number.isNaN(sy)) {
            const ctr = entity.getComponent(TransformComponent);
            sx = ctr?.x ?? 0;
            sy = ctr?.y ?? 0;
        }

        // spawn a short-lived melee hitbox entity
        const hb = this.world.createEntity(`${entity.name}_skill_${configId}_${Date.now()}`);
        const tr = this.world.acquireComponent(TransformComponent);
        tr.x = sx;
        tr.y = sy;
        hb.addComponent(tr);

        const hit = this.world.acquireComponent(MeleeHitboxComponent);
        hit.ownerId = entity.id;
        hit.damage = Math.max(0, power);
        hit.armorPenPct = 0;
        hit.skillMultiplier = 1;
        hit.critChance = 0;
        hit.lifeRemaining = 0.18; // short-lived
        hit.followOwner = false;
        hit.offsetX = 0;
        hit.offsetY = 0;
        hit.canHitMultiple = true;
        hb.addComponent(hit);

        // optional visual: add a temporary render circle if RenderComponent is available
        try {
            const render = this.world.acquireComponent(RenderComponent);
            render.addCircle( (levelCfg && (levelCfg.power ?? 0)) > 0 ? 24 : 12, [255, 120, 60, 180 ], true);
            hb.addComponent(render);
        } catch {}
    }
}
