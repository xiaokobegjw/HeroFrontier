import { JsonAsset, resources, SpriteFrame } from 'cc';

export type LevelBackground =
    | { type: 'none'; src?: string }
    | { type: 'url' | 'dataURL'; src: string }
    | { type: 'ccres'; path: string };

export type LevelPoint = {
    gx: number;
    gy: number;
    px: number;
    py: number;
};

export type LevelPath = {
    id: string;
    start?: LevelPoint | null;
    end?: LevelPoint | null;
    waypoints?: LevelPoint[];
};

export type LevelWaveGroup = {
    enemyId: string;
    count: number;
    interval: number;
    pathId: string;
    spawnOffset?: number;
};

export type LevelWave = {
    id: string;
    delay?: number;
    startAt?: number;
    groups?: LevelWaveGroup[];
};

export type LevelData = {
    version: number;
    background?: LevelBackground;
    backgroundOpacity?: number;
    cellSize: number;
    gridW: number;
    gridH: number;
    walkable?: number[];
    hero?: LevelPoint | null;
    base?: LevelPoint | null;
    enemySpawns?: LevelPoint[];
    paths?: LevelPath[];
    waves?: LevelWave[];
};

export class LevelLoader {
    public static loadLevelJson(resourcePathNoExt: string): Promise<LevelData> {
        return new Promise((resolve, reject) => {
            resources.load(resourcePathNoExt, JsonAsset, (err, asset) => {
                if (err || !asset) {
                    reject(err ?? new Error(`Failed to load JsonAsset: ${resourcePathNoExt}`));
                    return;
                }
                resolve(asset.json as LevelData);
            });
        });
    }

    public static loadLevelSpriteFrame(resourcePathNoExt: string): Promise<SpriteFrame> {
        return new Promise((resolve, reject) => {
            resources.load(resourcePathNoExt, SpriteFrame, (err, asset) => {
                if (err || !asset) {
                    reject(err ?? new Error(`Failed to load SpriteFrame: ${resourcePathNoExt}`));
                    return;
                }
                resolve(asset);
            });
        });
    }
}
