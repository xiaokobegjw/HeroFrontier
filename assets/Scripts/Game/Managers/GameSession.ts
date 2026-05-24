/** 单局运行时统计与状态 */
export class GameSession {
    private static _inst: GameSession | null = null;

    public static get instance(): GameSession {
        if (!this._inst) this._inst = new GameSession();
        return this._inst;
    }

    public static reset(): void {
        this._inst = new GameSession();
    }

    public currentWave: number = 0;
    public totalKills: number = 0;
    public maxFollowers: number = 0;
    public isGameOver: boolean = false;
    public gameOverReason: string = '';
    public waveInProgress: boolean = false;

    public recordKill(): void {
        if (this.isGameOver) return;
        this.totalKills++;
    }

    public setWave(wave: number): void {
        this.currentWave = Math.max(0, Math.floor(wave));
    }

    public updateMaxFollowers(count: number): void {
        this.maxFollowers = Math.max(this.maxFollowers, Math.max(0, Math.floor(count)));
    }

    public triggerGameOver(reason: string): void {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.gameOverReason = reason;
    }
}
