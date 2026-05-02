import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { QuadTree, QuadTreeRect } from '../../../Shared/Spatial/QuadTree';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { ProjectileComponent } from '../Components/ProjectileComponent';
import { MeleeHitboxComponent } from '../Components/MeleeHitboxComponent';
import { FactionType } from '../../Data/Faction';

type SpatialItem = {
    id: number;
    bounds: QuadTreeRect;
};

export class SpatialIndexSystem extends ECSSystem {
    private boundary: QuadTreeRect;
    private trees: Map<FactionType, QuadTree<SpatialItem>> = new Map();

    constructor(boundary: QuadTreeRect, priority: number = 4.9) {
        super('SpatialIndexSystem', priority);
        this.boundary = boundary;
        this.trees.set(FactionType.Player, new QuadTree<SpatialItem>(boundary));
        this.trees.set(FactionType.Enemy, new QuadTree<SpatialItem>(boundary));
        this.trees.set(FactionType.Neutral, new QuadTree<SpatialItem>(boundary));
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, FactionComponent, HealthComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        for (const tree of this.trees.values()) tree.clear();

        for (const entity of entities) {
            if (entity.hasComponent(ProjectileComponent) || entity.hasComponent(MeleeHitboxComponent)) continue;

            const transform = entity.getComponent(TransformComponent);
            const faction = entity.getComponent(FactionComponent);
            const health = entity.getComponent(HealthComponent);
            if (!transform || !faction || !health) continue;
            if (health.isDead) continue;

            const bounds = this.computeBounds(entity, transform);
            const tree = this.trees.get(faction.faction);
            if (!tree) continue;
            tree.insert({ id: entity.id, bounds });
        }
    }

    public queryOpponents(selfFaction: FactionType, range: QuadTreeRect): number[] {
        const out: number[] = [];
        for (const [faction, tree] of this.trees.entries()) {
            if (faction === selfFaction) continue;
            const items = tree.query(range);
            for (const it of items) out.push(it.id);
        }
        return out;
    }

    public queryFaction(faction: FactionType, range: QuadTreeRect): number[] {
        const tree = this.trees.get(faction);
        if (!tree) return [];
        return tree.query(range).map(it => it.id);
    }

    public queryFactions(factions: readonly FactionType[], range: QuadTreeRect): number[] {
        const out: number[] = [];
        for (const faction of factions) {
            const tree = this.trees.get(faction);
            if (!tree) continue;
            const items = tree.query(range);
            for (const it of items) out.push(it.id);
        }
        return out;
    }

    private computeBounds(entity: Entity, transform: TransformComponent): QuadTreeRect {
        const collider = entity.getComponent(ColliderComponent);
        if (collider) {
            const cx = transform.x + collider.offsetX;
            const cy = transform.y + collider.offsetY;
            if (collider.shape === ColliderShapeType.Circle) {
                const r = collider.radius;
                return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
            }
            const w = collider.width;
            const h = collider.height;
            return { x: cx - w * 0.5, y: cy - h * 0.5, width: w, height: h };
        }
        return { x: transform.x - 1, y: transform.y - 1, width: 2, height: 2 };
    }
}
