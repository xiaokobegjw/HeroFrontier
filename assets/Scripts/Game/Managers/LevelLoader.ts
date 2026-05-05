import { JsonAsset, resources, SpriteFrame } from 'cc';

export type LevelBackground = { type: 'none' | 'url' | 'dataURL'; src: string };

export type LevelPoint = {
    gx: number;
    gy: number;
    px: number;
    py: number;
};

export type LevelData = {
    version: number;
    background?: LevelBackground;
    backgroundOpacity?: number;
    cellSize: number;
    gridW: number;
    gridH: number;
    walkable: number[];
    heroStart?: LevelPoint | null;
    castle?: LevelPoint | null;
    enemySpawns?: LevelPoint[];
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

