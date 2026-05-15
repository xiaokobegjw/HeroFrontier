import { JsonAsset, resources } from 'cc';

export class EntityConfigCache {
    private static cache: Map<string, any> = new Map();
    private static pending: Map<string, Promise<any>> = new Map();

    public static async loadEntityConfig(entityId: string): Promise<any> {
        const id = String(entityId || '').trim();
        if (!id) throw new Error('Empty entityId');

        const cached = this.cache.get(id);
        if (cached) return cached;

        const inflight = this.pending.get(id);
        if (inflight) return inflight;

        const p = new Promise<any>((resolve, reject) => {
            resources.load(`configs/Entitys/${id}`, JsonAsset, (err, asset) => {
                if (err || !asset) {
                    reject(err ?? new Error(`Failed to load entity config: ${id}`));
                    return;
                }
                resolve(asset.json);
            });
        })
            .then((json) => {
                this.cache.set(id, json);
                this.pending.delete(id);
                return json;
            })
            .catch((e) => {
                this.pending.delete(id);
                throw e;
            });

        this.pending.set(id, p);
        return p;
    }

    public static has(entityId: string): boolean {
        const id = String(entityId || '').trim();
        return this.cache.has(id);
    }

    public static get(entityId: string): any | null {
        const id = String(entityId || '').trim();
        return this.cache.get(id) ?? null;
    }
}

