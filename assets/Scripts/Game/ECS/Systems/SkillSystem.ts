import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { SkillComponent } from '../Components/SkillComponent';
import { SkillStateComponent } from '../Components/SkillStateComponent';
import { PlaystyleComponent } from '../Components/PlaystyleComponent';
import { TargetComponent } from '../Components/TargetComponent';
import { SkillExecutor, SkillExecuteContext } from '../Skills/SkillExecutor';
import { DefaultSkillExecutor } from '../Skills/DefaultSkillExecutor';
import { BladeStormSkillExecutor } from '../Skills/BladeStormSkillExecutor';
import type { SkillCastType, SkillConfig, SkillLevelConfig, SkillTargetType } from '../Skills/SkillTypes';

export type { SkillTargetType, SkillCastType, SkillLevelConfig, SkillConfig };

export class SkillSystem extends ECSSystem {
    private world: World;
    private configs: Record<string, SkillConfig>;
    private executors: Map<string, SkillExecutor> = new Map();
    private defaultExecutor: SkillExecutor;

    constructor(world: World, configs: Record<string, SkillConfig>, priority: number = 6.4) {
        super('SkillSystem', priority);
        this.world = world;
        this.configs = configs;
        this.defaultExecutor = new DefaultSkillExecutor();
        this.registerExecutor(new BladeStormSkillExecutor());
    }

    public getMaxLevel(configId: string): number {
        const cfg = this.configs[configId];
        const fromCfg = cfg && typeof cfg.maxLevel === 'number' ? Math.floor(cfg.maxLevel) : 0;
        if (fromCfg > 0) return fromCfg;
        if (Array.isArray(cfg?.levels) && cfg!.levels!.length > 0) {
            let max = 1;
            for (const lv of cfg!.levels!) {
                if (typeof (lv as any)?.level === 'number') max = Math.max(max, Math.floor((lv as any).level));
            }
            return Math.max(1, max);
        }
        return 1;
    }

    public hasConfig(configId: string): boolean {
        return !!this.configs[configId];
    }

    public registerConfig(config: SkillConfig): void {
        if (!config || typeof (config as any).id !== 'string') return;
        const id = (config as any).id.trim();
        if (!id) return;
        this.configs[id] = config;
    }

    public registerExecutor(executor: SkillExecutor): void {
        this.executors.set(executor.id, executor);
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
            this.updatePlaystyle(entity, skillComponent);
            this.updateCooldowns(skillComponent, skillState, deltaTime);
            this.tryAutoCast(entity, skillComponent, skillState);
            this.processRequestedCast(entity, skillComponent, skillState);
        }
    }

    private updatePlaystyle(entity: Entity, skill: SkillComponent): void {
        let playstyle = entity.getComponent(PlaystyleComponent);
        if (!playstyle) {
            playstyle = this.world.acquireComponent(PlaystyleComponent);
            entity.addComponent(playstyle);
        }

        let tank = 0;
        let slash = 0;
        let commander = 0;

        for (const configId of skill.skillConfigIds) {
            const cfg = this.configs[configId];
            if (!cfg) continue;
            if (cfg.category === 'Tank') tank++;
            else if (cfg.category === 'Slash') slash++;
            else if (cfg.category === 'Commander') commander++;
        }

        // 仅在数值变化时更新，避免每帧重复计算复杂逻辑
        if (playstyle.tankSkillCount !== tank || playstyle.slashSkillCount !== slash || playstyle.commanderSkillCount !== commander) {
            playstyle.tankSkillCount = tank;
            playstyle.slashSkillCount = slash;
            playstyle.commanderSkillCount = commander;

            // 应用 V2/V3 制衡逻辑
            // 1. 指挥官流成型 (>=3): 英雄全伤害 -35%
            playstyle.heroDamageMultiplier = commander >= 3 ? 0.65 : 1.0;
            
            // 2. 坦流成型 (>=3): 防御塔伤害 -20%
            playstyle.towerDamageMultiplier = tank >= 3 ? 0.8 : 1.0;
            
            // 3. 割草流成型 (>=3): 士兵上限 -15% (130 * 0.15 ≈ 20)
            playstyle.soldierCapOffset = slash >= 3 ? -20 : 0;

            // 4. 割草流额外奖励: 防御塔输出 +10%
            if (slash >= 3) {
                playstyle.towerDamageMultiplier *= 1.1;
            }

            // 5. 指挥官流额外奖励: 补给恢复 +10%
            playstyle.supplyRecoveryMultiplier = commander >= 3 ? 1.1 : 1.0;
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
            skill.autoCastEnabled.push(true);
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

    private tryAutoCast(entity: Entity, skill: SkillComponent, state: SkillStateComponent): void {
        if (state.requestedSkillIndex !== -1) return;

        for (let i = 0; i < skill.skillConfigIds.length; i++) {
            if (!skill.autoCastEnabled[i]) continue;
            if ((state.skillCooldownRemaining[i] ?? 0) > 0) continue;

            const configId = skill.skillConfigIds[i] ?? '';
            if (!configId) continue;
            const cfg = this.configs[configId];
            if (!cfg) continue;

            const tt = (cfg.targetType ?? 'Self') as SkillTargetType;
            const target = entity.getComponent(TargetComponent);

            let targetEntityId: number | null = null;
            let targetX: number = Number.NaN;
            let targetY: number = Number.NaN;

            if (tt === 'Enemy' || tt === 'Ally') {
                targetEntityId = target?.targetEntityId ?? null;
                if (targetEntityId === null) continue;
            } else if (tt === 'Point' || tt === 'Area') {
                const x = target?.targetX ?? Number.NaN;
                const y = target?.targetY ?? Number.NaN;
                if (Number.isFinite(x) && Number.isFinite(y)) {
                    targetX = x;
                    targetY = y;
                }
            }

            this.requestCast(entity.id, i, targetEntityId, targetX, targetY);
            break;
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

        const levelCfg = this.resolveLevelConfig(config, level);
        const ctx: SkillExecuteContext = {
            world: this.world,
            caster: entity,
            configId,
            config,
            level,
            levelConfig: levelCfg,
            targetEntityId,
            targetX,
            targetY
        };

        const executor = this.executors.get(configId) ?? this.defaultExecutor;
        executor.execute(ctx);
    }
}
