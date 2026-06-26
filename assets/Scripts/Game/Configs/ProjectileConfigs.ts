import Arrow1 from '../../../resources/configs/Projectiles/Arrow1.json';
import MagicBolt1 from '../../../resources/configs/Projectiles/MagicBolt1.json';
import TowerArrow1 from '../../../resources/configs/Projectiles/TowerArrow1.json';
import TowerMagicBolt1 from '../../../resources/configs/Projectiles/TowerMagicBolt1.json';
import TowerMagicBeam2 from '../../../resources/configs/Projectiles/TowerMagicBeam2.json';
import TowerMagicBolt3 from '../../../resources/configs/Projectiles/TowerMagicBolt3.json';
import TowerMagicScythe4 from '../../../resources/configs/Projectiles/TowerMagicScythe4.json';

export const projectileConfigs: Record<string, any> = {
    Arrow1,
    MagicBolt1,
    TowerArrow1,
    TowerMagicBolt1,
    TowerMagicBeam2,
    TowerMagicBolt3,
    TowerMagicScythe4,
};

export function registerProjectileConfig(id: string, config: any): void {
    projectileConfigs[id] = config;
}

export function getProjectileConfig(id: string): any | undefined {
    return projectileConfigs[id];
}