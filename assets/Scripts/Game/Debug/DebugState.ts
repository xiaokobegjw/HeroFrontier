export class DebugState {
    public static enabled: boolean = false;
    public static selectedEntityId: number | null = null;

    private static damageQueue: { entityId: number; current: number; max: number }[] = [];

    public static pushDamageEvent(entityId: number, current: number, max: number): void {
        this.damageQueue.push({ entityId, current, max });
    }

    public static drainDamageEvents(): { entityId: number; current: number; max: number }[] {
        if (this.damageQueue.length === 0) return [];
        const out = this.damageQueue;
        this.damageQueue = [];
        return out;
    }
}
