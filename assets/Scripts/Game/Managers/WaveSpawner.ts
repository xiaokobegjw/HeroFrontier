export type SpawnEvent = { time: number; enemyId: string; pathId: string; wave?: number };

/** V3 策划案波次表数据 */
const WAVE_TABLE_V3: Record<number, { total: number; elites: number; bossId?: string; duration: number }> = {
    1: { total: 18, elites: 0, duration: 25 },
    2: { total: 22, elites: 0, duration: 26 },
    3: { total: 22, elites: 0, duration: 28 },
    4: { total: 34, elites: 0, duration: 30 },
    5: { total: 42, elites: 0, duration: 35 },
    6: { total: 48, elites: 1, duration: 38 },
    7: { total: 52, elites: 1, duration: 40 },
    8: { total: 58, elites: 1, duration: 42 },
    9: { total: 64, elites: 2, duration: 45 },
    10: { total: 60, elites: 2, bossId: 'Boss_RottenCorpse', duration: 55 },
    11: { total: 70, elites: 2, duration: 55 },
    12: { total: 76, elites: 2, duration: 58 },
    13: { total: 82, elites: 3, duration: 60 },
    14: { total: 88, elites: 3, duration: 62 },
    15: { total: 96, elites: 4, duration: 65 },
    16: { total: 102, elites: 4, duration: 68 },
    17: { total: 108, elites: 4, duration: 70 },
    18: { total: 114, elites: 5, duration: 72 },
    19: { total: 122, elites: 5, duration: 75 },
    20: { total: 110, elites: 5, bossId: 'Boss_LavaWarlord', duration: 80 },
    21: { total: 118, elites: 5, duration: 82 },
    22: { total: 126, elites: 6, duration: 85 },
    23: { total: 132, elites: 6, duration: 88 },
    24: { total: 138, elites: 6, duration: 90 },
    25: { total: 145, elites: 7, duration: 92 },
    26: { total: 152, elites: 7, duration: 95 },
    27: { total: 158, elites: 8, duration: 98 },
    28: { total: 165, elites: 8, duration: 100 },
    29: { total: 172, elites: 8, duration: 105 },
    30: { total: 150, elites: 10, bossId: 'Boss_NetherBoneDragon', duration: 110 },
    31: { total: 160, elites: 10, duration: 112 },
    32: { total: 168, elites: 10, duration: 115 },
    33: { total: 176, elites: 11, duration: 118 },
    34: { total: 184, elites: 11, duration: 120 },
    35: { total: 192, elites: 12, duration: 122 },
    36: { total: 198, elites: 12, duration: 124 },
    37: { total: 205, elites: 13, duration: 126 },
    38: { total: 212, elites: 13, duration: 128 },
    39: { total: 220, elites: 14, duration: 130 },
    40: { total: 180, elites: 15, bossId: 'Boss_AbyssLord', duration: 140 },
};

export type WaveSpawnerOptions = {
    pathIds: string[];
};

/**
 * 遵循 V3 策划案规则的波次生成器：
 * - 1-40 波使用固定数值表
 * - 实现结构化冲击（分批次、分种类）
 * - 41 波后进入无尽模式，按衰减曲线增长
 */
export class WaveSpawner {
    private pathIds: string[];
    private nextWaveIndex: number = 1;

    constructor(opts: WaveSpawnerOptions) {
        this.pathIds = opts.pathIds.length > 0 ? opts.pathIds : ['A'];
    }

    public appendProceduralWaves(queue: SpawnEvent[], startTime: number, count: number): void {
        let t = startTime;
        for (let i = 0; i < count; i++) {
            const events = this.buildWaveV3(this.nextWaveIndex, t);
            queue.push(...events);
            
            // 下一波开始时间 = 当前波出怪时长 + 间歇 (固定 5s)
            const duration = this.getWaveDuration(this.nextWaveIndex);
            t += duration + 5;
            this.nextWaveIndex++;
        }
    }

    public ensureAhead(queue: SpawnEvent[], levelTime: number, minAheadSeconds: number = 60): void {
        if (queue.length === 0) {
             this.appendProceduralWaves(queue, 0, 3);
             return;
        }
        const lastTime = queue[queue.length - 1].time;
        if (lastTime - levelTime >= minAheadSeconds) return;
        this.appendProceduralWaves(queue, lastTime + 5, 3);
    }

    private buildWaveV3(wave: number, waveStart: number): SpawnEvent[] {
        const events: SpawnEvent[] = [];
        const pathId = this.pathIds[(wave - 1) % this.pathIds.length];

        if (wave <= 40) {
            const config = WAVE_TABLE_V3[wave];
            // 结构化冲击逻辑：将波次分为四个冲击段 (Phases)
            // 0-30%: 杂兵冲击
            // 30-60%: 快速单位/重甲单位
            // 60-80%: 精英压轴
            // 90%: Boss 登场 (如果是 Boss 波)
            
            const total = config.total;
            const elites = config.elites;
            const duration = config.duration;

            // 1. 杂兵段 (40%)
            const minionCount = Math.floor((total - elites) * 0.4);
            for (let i = 0; i < minionCount; i++) {
                events.push({
                    time: waveStart + (i / minionCount) * (duration * 0.3),
                    enemyId: this.getMinionId(wave),
                    pathId,
                    wave
                });
            }

            // 2. 快速/中坚段 (40%)
            const midCount = (total - elites) - minionCount;
            for (let i = 0; i < midCount; i++) {
                events.push({
                    time: waveStart + (duration * 0.35) + (i / midCount) * (duration * 0.3),
                    enemyId: this.getMidUnitId(wave),
                    pathId,
                    wave
                });
            }

            // 3. 精英段
            for (let i = 0; i < elites; i++) {
                events.push({
                    time: waveStart + (duration * 0.7) + (i / Math.max(1, elites)) * (duration * 0.15),
                    enemyId: this.getEliteId(wave),
                    pathId,
                    wave
                });
            }

            // 4. Boss
            if (config.bossId) {
                events.push({
                    time: waveStart + (duration * 0.9),
                    enemyId: config.bossId,
                    pathId,
                    wave
                });
            }
        } else {
            // 无尽模式 (41+)
            this.buildEndlessWave(wave, waveStart, events, pathId);
        }

        return events;
    }

    private getWaveDuration(wave: number): number {
        if (wave <= 40) return WAVE_TABLE_V3[wave].duration;
        return 140 + (wave - 40) * 1.5; // 无尽模式时长缓慢增长
    }

    private getMinionId(wave: number): string {
        if (wave < 15) return 'EnemyRottenPeasant';
        return Math.random() < 0.5 ? 'EnemyRottenPeasant' : 'EnemyWildWolf';
    }

    private getMidUnitId(wave: number): string {
        if (wave < 10) return 'EnemyWildWolf';
        if (wave < 25) return Math.random() < 0.6 ? 'EnemyHeavyGuard1' : 'EnemyCorrosiveBat';
        return Math.random() < 0.5 ? 'EnemyNecroSkeleton' : 'EnemyDarkMage';
    }

    private getEliteId(wave: number): string {
        if (wave < 20) return 'EnemyHeavyGuard1';
        if (wave < 30) return 'EnemyMutantBoneSpur';
        return Math.random() < 0.5 ? 'EnemyAbyssCurser' : 'EnemyHeavyGuard2';
    }

    private buildEndlessWave(wave: number, waveStart: number, events: SpawnEvent[], pathId: string): void {
        const baseTotal = 180;
        const waveFactor = wave - 40;
        // 按照 V3 衰减曲线计算增幅 (这里简单模拟，实际属性增幅在 EntityFactory)
        const total = Math.floor(baseTotal * (1 + waveFactor * 0.05)); 
        const elites = Math.floor(15 + waveFactor * 0.5);
        const duration = 140 + waveFactor * 1.5;

        // 简化的无尽出怪：混合乱序
        for (let i = 0; i < total; i++) {
            const isElite = Math.random() < (elites / total);
            events.push({
                time: waveStart + Math.random() * duration,
                enemyId: isElite ? this.getEliteId(wave) : this.getMidUnitId(wave),
                pathId,
                wave
            });
        }
    }
}
