import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { BladeOrbitComponent } from '../Components/BladeOrbitComponent';

export class BladeOrbitSystem extends ECSSystem {
    private world: World;

    constructor(world: World, priority: number = 9.4) {
        super('BladeOrbitSystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, BladeOrbitComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        const dt = Math.max(0, deltaTime);
        for (const entity of entities) {
            const tr = entity.getComponent(TransformComponent);
            const orbit = entity.getComponent(BladeOrbitComponent);
            if (!tr || !orbit) continue;

            const owner = orbit.ownerId ? this.world.getEntity(orbit.ownerId) : null;
            const otr = owner?.getComponent(TransformComponent) ?? null;
            if (!otr) continue;

            orbit.angleDeg += orbit.angularSpeedDegPerSec * dt;
            if (orbit.angleDeg > 360 || orbit.angleDeg < -360) orbit.angleDeg = orbit.angleDeg % 360;

            const rad = (orbit.angleDeg * Math.PI) / 180;
            const ox = Math.cos(rad) * orbit.radius;
            const oy = Math.sin(rad) * orbit.radius;

            tr.x = otr.x + ox;
            tr.y = otr.y + oy;

            tr.rotation = orbit.angleDeg + (orbit.rotationOffsetDeg ?? 0);
        }
    }
}
