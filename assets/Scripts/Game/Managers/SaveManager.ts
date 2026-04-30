import { sys } from 'cc';
import { LevelComponent } from '../ECS/Components/LevelComponent';
import { EquipmentComponent } from '../ECS/Components/EquipmentComponent';
import { Entity } from '../../Shared/ECS/Core/Entity';

export type SaveData = {
    version: number;
    player: {
        level: number;
        equippedWeaponId: string;
    };
    progress: {
        unlockedStages: string[];
    };
};

type StoredSave = {
    payload: SaveData;
    sig: string;
};

export class SaveManager {
    private static _instance: SaveManager;
    private readonly key = 'hf.save.v1';

    private constructor() {}

    public static get instance(): SaveManager {
        if (!this._instance) this._instance = new SaveManager();
        return this._instance;
    }

    public loadOrDefault(defaultSave: SaveData): SaveData {
        const raw = sys.localStorage.getItem(this.key);
        if (!raw) return this.clone(defaultSave);

        try {
            const parsed = JSON.parse(raw) as StoredSave;
            if (!parsed || !parsed.payload || typeof parsed.sig !== 'string') return this.clone(defaultSave);
            if (!this.verify(parsed.payload, parsed.sig)) return this.clone(defaultSave);
            return this.sanitize(parsed.payload, defaultSave);
        } catch {
            return this.clone(defaultSave);
        }
    }

    public save(data: SaveData): void {
        const payload = this.clone(data);
        const sig = this.sign(payload);
        const out: StoredSave = { payload, sig };
        sys.localStorage.setItem(this.key, JSON.stringify(out));
    }

    public applyToPlayerEntity(entity: Entity, data: SaveData): void {
        const level = entity.getComponent(LevelComponent);
        if (level) level.level = data.player.level;

        const equip = entity.getComponent(EquipmentComponent);
        if (equip) {
            equip.weaponConfigId = data.player.equippedWeaponId;
            equip.weaponEntityId = null;
        }
    }

    public extractFromPlayerEntity(entity: Entity, fallback: SaveData): SaveData {
        const data = this.clone(fallback);

        const level = entity.getComponent(LevelComponent);
        if (level) data.player.level = Math.max(1, Math.floor(level.level));

        const equip = entity.getComponent(EquipmentComponent);
        if (equip && equip.weaponConfigId) data.player.equippedWeaponId = equip.weaponConfigId;

        return data;
    }

    private sanitize(data: SaveData, fallback: SaveData): SaveData {
        const out = this.clone(fallback);
        out.version = typeof data.version === 'number' ? data.version : out.version;

        const lvl = data.player?.level;
        out.player.level = typeof lvl === 'number' ? Math.max(1, Math.floor(lvl)) : out.player.level;

        const weapon = data.player?.equippedWeaponId;
        out.player.equippedWeaponId = typeof weapon === 'string' && weapon.length > 0 ? weapon : out.player.equippedWeaponId;

        const unlocked = data.progress?.unlockedStages;
        if (Array.isArray(unlocked)) {
            out.progress.unlockedStages = unlocked.filter(x => typeof x === 'string' && x.length > 0);
        }

        return out;
    }

    private clone<T>(obj: T): T {
        return JSON.parse(JSON.stringify(obj)) as T;
    }

    private sign(payload: SaveData): string {
        const material = this.deviceSalt() + '|' + this.secret() + '|' + this.canonical(payload);
        return this.fnv1a32Hex(material);
    }

    private verify(payload: SaveData, sig: string): boolean {
        return this.sign(payload) === sig;
    }

    private canonical(payload: SaveData): string {
        const p: SaveData = {
            version: payload.version,
            player: {
                level: payload.player?.level ?? 1,
                equippedWeaponId: payload.player?.equippedWeaponId ?? ''
            },
            progress: {
                unlockedStages: Array.isArray(payload.progress?.unlockedStages) ? payload.progress.unlockedStages : []
            }
        };
        return JSON.stringify(p);
    }

    private deviceSalt(): string {
        return [sys.platform, sys.os, sys.isMobile ? 'm' : 'p', sys.language].join('|');
    }

    private secret(): string {
        const a = 'H';
        const b = 'F';
        const c = 'R';
        const d = '0';
        const e = '1';
        const f = 'x';
        return a + b + '_' + c + d + e + '_' + f;
    }

    private fnv1a32Hex(input: string): string {
        let hash = 0x811c9dc5;
        for (let i = 0; i < input.length; i++) {
            hash ^= input.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }
        const n = hash >>> 0;
        return ('00000000' + n.toString(16)).slice(-8);
    }
}

