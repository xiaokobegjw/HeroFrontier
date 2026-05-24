import { World } from '../../Shared/ECS/Core/World';
import { BaseProductionComponent } from '../ECS/Components/BaseProductionComponent';
import { SoldierComponent } from '../ECS/Components/SoldierComponent';

/** 按 followerDesired 在驻守/随从之间重新分配已有士兵 */
export class SoldierModeBalancer {
    public static apply(world: World, baseEntityId: number, followerDesired: number): void {
        const base = world.getEntity(baseEntityId);
        const prod = base?.getComponent(BaseProductionComponent);
        if (!base || !prod) return;

        const cap = Math.max(0, Math.min(prod.followerCap, Math.floor(followerDesired)));
        prod.followerDesired = cap;

        const soldiers = world
            .getAllEntities()
            .filter(e => e.active && e.hasComponent(SoldierComponent))
            .map(e => ({ e, s: e.getComponent(SoldierComponent)! }))
            .filter(x => x.s.baseEntityId === baseEntityId);

        let followers = soldiers.filter(x => x.s.mode === 'Follower');
        let garrison = soldiers.filter(x => x.s.mode === 'Garrison');

        while (followers.length > cap && garrison.length >= 0) {
            const pick = followers.shift();
            if (!pick) break;
            pick.s.mode = 'Garrison';
            pick.s.formationIndex = garrison.length;
            pick.s.deployed = false;
            garrison.push(pick);
        }

        while (followers.length < cap && garrison.length > 0) {
            const pick = garrison.shift();
            if (!pick) break;
            pick.s.mode = 'Follower';
            pick.s.formationIndex = followers.length;
            pick.s.deployed = false;
            followers.push(pick);
        }

        garrison.forEach((x, i) => {
            x.s.formationIndex = i;
        });
        followers.forEach((x, i) => {
            x.s.formationIndex = i;
        });
    }
}
