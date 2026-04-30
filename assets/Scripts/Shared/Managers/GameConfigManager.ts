import { sys } from 'cc';
import { DEBUG } from 'cc/env';

/**
 * 游戏配置管理器：负责环境检测及全局参数管理
 */
export class GameConfigManager {
    private static _instance: GameConfigManager;

    /** 是否是调试模式 (DEBUG 模式下为 true) */
    public readonly isDebug: boolean = DEBUG;

    /** 是否是发布模式 */
    public readonly isRelease: boolean = !DEBUG;

    /** 是否是移动端 */
    public readonly isMobile: boolean = sys.isMobile;

    /** 是否是 PC 端 (非移动端即视为 PC/浏览器端) */
    public readonly isPC: boolean = !sys.isMobile;

    /** 当前运行平台 */
    public readonly platform: string = sys.platform;

    /** 游戏版本号 */
    public readonly version: string = "1.0.0";

    private constructor() {
        console.log(`[GameConfigManager] Initialized: isMobile=${this.isMobile}, isPC=${this.isPC}, platform=${this.platform}, isDebug=${this.isDebug}`);
    }

    public static get instance(): GameConfigManager {
        if (!this._instance) {
            this._instance = new GameConfigManager();
        }
        return this._instance;
    }

    /**
     * 获取环境描述信息
     */
    public getEnvironmentInfo(): string {
        const buildType = this.isDebug ? "DEBUG" : "RELEASE";
        const deviceType = this.isMobile ? "Mobile" : "PC";
        return `[GameConfig] Version: ${this.version} | Build: ${buildType} | Device: ${deviceType} | Platform: ${this.platform}`;
    }
}
