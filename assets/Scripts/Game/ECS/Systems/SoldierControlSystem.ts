import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { SoldierControlComponent, SoldierBehaviorMode } from '../Components/SoldierControlComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { TargetingComponent } from '../Components/TargetingComponent';
import { AIComponent } from '../Components/AIComponent';

export class SoldierControlSystem extends ECSSystem {
    private world: World;
    private retreatDuration: number = 3.0;

    constructor(world: World, priority: number = 6.5) {
        super('SoldierControlSystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => any)[] {
        return [SoldierControlComponent, FactionComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        const now = Date.now() / 1000;
        
        for (const entity of entities) {
            const control = entity.getComponent(SoldierControlComponent);
            if (!control) continue;

            if (control.retreating && now >= control.retreatEndTime) {
                control.retreating = false;
                this.resumeAI(entity);
            }

            this.applyBehaviorMode(entity, control);
        }
    }

    private applyBehaviorMode(entity: Entity, control: SoldierControlComponent): void {
        const targeting = entity.getComponent(TargetingComponent);
        if (!targeting) return;

        switch (control.behaviorMode) {
            case 'PrioritizeTank':
                targeting.strategy = 'HighestDefense';
                break;
            case 'PrioritizeDamage':
                targeting.strategy = 'LowestHealth';
                break;
            case 'HoldPosition':
                targeting.strategy = 'None';
                break;
            default:
                targeting.strategy = 'Nearest';
                break;
        }
    }

    public setBehaviorMode(soldierEntity: Entity, mode: SoldierBehaviorMode): void {
        const control = soldierEntity.getComponent(SoldierControlComponent);
        if (control) {
            control.behaviorMode = mode;
        }
    }

    public startRetreat(soldierEntity: Entity): void {
        const control = soldierEntity.getComponent(SoldierControlComponent);
        if (!control || control.retreating) return;

        control.retreating = true;
        control.retreatEndTime = Date.now() / 1000 + this.retreatDuration;
        
        const ai = soldierEntity.getComponent(AIComponent);
        if (ai) {
            ai.enabled = false;
        }
    }

    private resumeAI(entity: Entity): void {
        const ai = entity.getComponent(AIComponent);
        if (ai) {
            ai.enabled = true;
        }
    }

    public setFocusTarget(soldierEntity: Entity, targetId: number, isElite: boolean = false, isBoss: boolean = false): void {
        const control = soldierEntity.getComponent(SoldierControlComponent);
        if (!control) return;

        control.focusTargetId = targetId;
        control.isFocusingElite = isElite;
        control.isFocusingBoss = isBoss;
    }

    public clearFocusTarget(soldierEntity: Entity): void {
        const control = soldierEntity.getComponent(SoldierControlComponent);
        if (control) {
            control.focusTargetId = -1;
            control.isFocusingElite = false;
            control.isFocusingBoss = false;
        }
    }

    public orderAllSoldiersToFocus(targetId: number, isElite: boolean, isBoss: boolean): void {
        const soldiers = this.world.getEntitiesWithComponent(SoldierControlComponent);
        
        for (const soldier of soldiers) {
            const faction = soldier.getComponent(FactionComponent);
            if (faction && faction.faction === 'Player') {
                this.setFocusTarget(soldier, targetId, isElite, isBoss);
            }
        }
    }

    public orderAllSoldiersToRetreat(): void {
        const soldiers = this.world.getEntitiesWithComponent(SoldierControlComponent);
        
        for (const soldier of soldiers) {
            const faction = soldier.getComponent(FactionComponent);
            if (faction && faction.faction === 'Player') {
                this.startRetreat(soldier);
            }
        }
    }

    public setAllSoldiersBehaviorMode(mode: SoldierBehaviorMode): void {
        const soldiers = this.world.getEntitiesWithComponent(SoldierControlComponent);
        
        for (const soldier of soldiers) {
            const faction = soldier.getComponent(FactionComponent);
            if (faction && faction.faction === 'Player') {
                this.setBehaviorMode(soldier, mode);
            }
        }
    }
}