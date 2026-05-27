export type SpawnEvent = { time: number; enemyId: string; pathId: string; wave?: number };

export type WaveSpawnerOptions = {
    pathIds: string[];
    baseEnemyId?: string;
    heavyEnemyId?: string;
    bossEnemyId?: string;
    waveGapSeconds?: number;
};

/**
 * 在关卡预设波次之后，按策划规则生成无尽波次：
 * - 每波数量递增
 * - 每 5 波 BOSS
 * - 每 10 波强化（更多重甲）
 */
export class WaveSpawner {
    private pathIds: string[];
    private baseEnemyId: string;
    private heavyEnemyId: string;
    private bossEnemyId: string;
    private waveGapSeconds: number;
    private nextWaveIndex: number = 1;
    private scheduleTime: number = 0;

    constructor(opts: WaveSpawnerOptions) {
        this.pathIds = opts.pathIds.length > 0 ? opts.pathIds : ['A'];
        this.baseEnemyId = opts.baseEnemyId ?? 'Enemy1';
        this.heavyEnemyId = opts.heavyEnemyId ?? 'Enemy3';
        this.bossEnemyId = opts.bossEnemyId ?? 'Enemy3';
        this.waveGapSeconds = opts.waveGapSeconds ?? 4;
    }

    public setStartTime(t: number): void {
        this.scheduleTime = Math.max(0, t);
    }

    public appendProceduralWaves(queue: SpawnEvent[], startTime: number, count: number): void {
        let t = startTime;
        for (let i = 0; i < count; i++) {
            const events = this.buildWave(this.nextWaveIndex, t);
            queue.push(...events);
            t += this.waveDuration(this.nextWaveIndex) + this.waveGapSeconds;
            this.nextWaveIndex++;
        }
        this.scheduleTime = t;
    }

    public ensureAhead(queue: SpawnEvent[], levelTime: number, minAheadSeconds: number = 90): void {
        if (queue.length === 0) return;
        const lastTime = queue[queue.length - 1].time;
        if (lastTime - levelTime >= minAheadSeconds) return;
        this.appendProceduralWaves(queue, lastTime + this.waveGapSeconds, 6);
    }

    private buildWave(wave: number, waveStart: number): SpawnEvent[] {
        const events: SpawnEvent[] = [];
        const pathId = this.pathIds[(wave - 1) % this.pathIds.length];
        const isBossWave = wave % 5 === 0;
        const isSpikeWave = wave % 10 === 0;

        if (isBossWave) {
            events.push({ time: waveStart + 1, enemyId: this.bossEnemyId, pathId, wave });
        }

        const count = Math.min(80, 8 + wave * 2 + (isSpikeWave ? 6 : 0));
        const interval = Math.max(0.25, 0.65 - wave * 0.008);
        const heavyRatio = wave < 6 ? 0 : isSpikeWave ? 0.45 : wave % 3 === 0 ? 0.25 : 0.12;

        for (let i = 0; i < count; i++) {
            const useHeavy = Math.random() < heavyRatio;
            const enemyId = useHeavy ? this.heavyEnemyId : this.baseEnemyId;
            events.push({
                time: waveStart + i * interval,
                enemyId,
                pathId,
                wave
            });
        }

        return events;
    }

    private waveDuration(wave: number): number {
        const count = 8 + wave * 2;
        const interval = Math.max(0.25, 0.65 - wave * 0.008);
        return count * interval + 2;
    }
}
