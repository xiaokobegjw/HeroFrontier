import { _decorator, Component, ProgressBar, Node, Sprite } from 'cc';
const { ccclass, property } = _decorator;

import { NumberDisplay } from './NumberDisplay';

/**
 * HUDManager 负责管理游戏场景的 HUD 显示
 * 包括：
 * - 英雄血量进度条 (HealthPR)
 * - 英雄经验进度条 (BluePR / 蓝条)
 * - 金币数字显示 (CoinNumGe, CoinNumShi, CoinNumBai)
 * - 波次显示 分数格式 (NTGE/DTGE, NTSHI/DTSHI)
 * - 英雄等级显示 (LevelShi, LevelGe)
 */
@ccclass('HUDManager')
export class HUDManager extends Component {
    @property({ type: ProgressBar })
    public healthProgressBar: ProgressBar | null = null;

    @property({ type: ProgressBar })
    public experienceProgressBar: ProgressBar | null = null;

    @property({ type: Node })
    public coinNumGeNode: Node | null = null;

    @property({ type: Node })
    public coinNumShiNode: Node | null = null;

    @property({ type: Node })
    public coinNumBaiNode: Node | null = null;

    @property({ type: Node })
    public waveNumeratorGeNode: Node | null = null;  // NTGE 波次分子个位

    @property({ type: Node })
    public waveNumeratorShiNode: Node | null = null; // NTSHI 波次分子十位

    @property({ type: Node })
    public waveDenominatorGeNode: Node | null = null;  // DTGE 波次分母个位

    @property({ type: Node })
    public waveDenominatorShiNode: Node | null = null; // DTSHI 波次分母十位

    @property({ type: Node })
    public levelShiNode: Node | null = null;  // 英雄等级十位

    @property({ type: Node })
    public levelGeNode: Node | null = null;   // 英雄等级个位

    @property({ type: ProgressBar })
    public heroReviveProgressBar: ProgressBar | null = null;  // 英雄复活CD进度条

    private coinNumGe: NumberDisplay | null = null;
    private coinNumShi: NumberDisplay | null = null;
    private coinNumBai: NumberDisplay | null = null;

    private waveNumeratorGe: NumberDisplay | null = null;
    private waveNumeratorShi: NumberDisplay | null = null;
    private waveDenominatorGe: NumberDisplay | null = null;
    private waveDenominatorShi: NumberDisplay | null = null;

    private levelShi: NumberDisplay | null = null;
    private levelGe: NumberDisplay | null = null;

    onLoad(): void {
        this.initNumberDisplays();
    }

    private initNumberDisplays(): void {
        if (this.coinNumGeNode) {
            this.coinNumGe = this.coinNumGeNode.getComponent(NumberDisplay);
            if (!this.coinNumGe) {
                this.coinNumGe = this.coinNumGeNode.addComponent(NumberDisplay);
            }
        }

        if (this.coinNumShiNode) {
            this.coinNumShi = this.coinNumShiNode.getComponent(NumberDisplay);
            if (!this.coinNumShi) {
                this.coinNumShi = this.coinNumShiNode.addComponent(NumberDisplay);
            }
        }

        if (this.coinNumBaiNode) {
            this.coinNumBai = this.coinNumBaiNode.getComponent(NumberDisplay);
            if (!this.coinNumBai) {
                this.coinNumBai = this.coinNumBaiNode.addComponent(NumberDisplay);
            }
        }

        if (this.waveNumeratorGeNode) {
            this.waveNumeratorGe = this.waveNumeratorGeNode.getComponent(NumberDisplay);
            if (!this.waveNumeratorGe) {
                this.waveNumeratorGe = this.waveNumeratorGeNode.addComponent(NumberDisplay);
            }
        }

        if (this.waveNumeratorShiNode) {
            this.waveNumeratorShi = this.waveNumeratorShiNode.getComponent(NumberDisplay);
            if (!this.waveNumeratorShi) {
                this.waveNumeratorShi = this.waveNumeratorShiNode.addComponent(NumberDisplay);
            }
        }

        if (this.waveDenominatorGeNode) {
            this.waveDenominatorGe = this.waveDenominatorGeNode.getComponent(NumberDisplay);
            if (!this.waveDenominatorGe) {
                this.waveDenominatorGe = this.waveDenominatorGeNode.addComponent(NumberDisplay);
            }
        }

        if (this.waveDenominatorShiNode) {
            this.waveDenominatorShi = this.waveDenominatorShiNode.getComponent(NumberDisplay);
            if (!this.waveDenominatorShi) {
                this.waveDenominatorShi = this.waveDenominatorShiNode.addComponent(NumberDisplay);
            }
        }

        if (this.levelShiNode) {
            this.levelShi = this.levelShiNode.getComponent(NumberDisplay);
            if (!this.levelShi) {
                this.levelShi = this.levelShiNode.addComponent(NumberDisplay);
            }
        }

        if (this.levelGeNode) {
            this.levelGe = this.levelGeNode.getComponent(NumberDisplay);
            if (!this.levelGe) {
                this.levelGe = this.levelGeNode.addComponent(NumberDisplay);
            }
        }
    }

    /**
     * 更新英雄血量进度条
     * @param current 当前血量
     * @param max 最大血量
     */
    public updateHealthBar(current: number, max: number): void {
        if (!this.healthProgressBar) return;
        const progress = Math.max(0, Math.min(1, current / max));
        this.healthProgressBar.progress = progress;
    }

    /**
     * 更新经验进度条
     * @param current 当前经验
     * @param max 最大经验
     */
    public updateExperienceBar(current: number, max: number): void {
        if (!this.experienceProgressBar) return;
        const progress = Math.max(0, Math.min(1, current / max));
        this.experienceProgressBar.progress = progress;
    }

    /**
     * 显示金币数量（三位数）
     * @param amount 金币总数 (0-999)
     */
    public displayCoin(amount: number): void {
        amount = Math.max(0, Math.min(999, Math.floor(amount)));

        const bai = Math.floor(amount / 100);
        const shi = Math.floor((amount % 100) / 10);
        const ge = amount % 10;

        if (this.coinNumBai) this.coinNumBai.setNumber(bai);
        if (this.coinNumShi) this.coinNumShi.setNumber(shi);
        if (this.coinNumGe) this.coinNumGe.setNumber(ge);
    }

    /**
     * 获取当前显示的金币数
     */
    public getCoinDisplay(): number {
        if (!this.coinNumBai || !this.coinNumShi || !this.coinNumGe) return 0;
        return (
            this.coinNumBai.getNumber() * 100 +
            this.coinNumShi.getNumber() * 10 +
            this.coinNumGe.getNumber()
        );
    }

    /**
     * 显示波次数量（分数格式：分子/分母，最多99）
     * @param current 当前波次（分子）
     * @param max 最大波次（分母）
     */
    public displayWave(current: number, max: number): void {
        current = Math.max(0, Math.min(99, Math.floor(current)));
        max = Math.max(0, Math.min(99, Math.floor(max)));

        const numeratorShi = Math.floor(current / 10);
        const numeratorGe = current % 10;

        const denominatorShi = Math.floor(max / 10);
        const denominatorGe = max % 10;

        if (this.waveNumeratorShi) this.waveNumeratorShi.setNumber(numeratorShi);
        if (this.waveNumeratorGe) this.waveNumeratorGe.setNumber(numeratorGe);
        if (this.waveDenominatorShi) this.waveDenominatorShi.setNumber(denominatorShi);
        if (this.waveDenominatorGe) this.waveDenominatorGe.setNumber(denominatorGe);
    }

    /**
     * 获取当前显示的波次信息
     */
    public getWaveDisplay(): { current: number; max: number } {
        const numerator =
            (this.waveNumeratorShi?.getNumber() ?? 0) * 10 +
            (this.waveNumeratorGe?.getNumber() ?? 0);
        const denominator =
            (this.waveDenominatorShi?.getNumber() ?? 0) * 10 +
            (this.waveDenominatorGe?.getNumber() ?? 0);
        return { current: numerator, max: denominator };
    }

    /**
     * 显示英雄等级（两位数）
     * @param level 英雄等级 (1-99)
     */
    public displayLevel(level: number): void {
        level = Math.max(1, Math.min(99, Math.floor(level)));

        const shi = Math.floor(level / 10);
        const ge = level % 10;

        if (this.levelShi) this.levelShi.setNumber(shi);
        if (this.levelGe) this.levelGe.setNumber(ge);
    }

    /**
     * 获取当前显示的英雄等级
     */
    public getLevelDisplay(): number {
        if (!this.levelShi || !this.levelGe) return 1;
        return this.levelShi.getNumber() * 10 + this.levelGe.getNumber();
    }

    /**
     * 更新英雄复活CD进度条
     * @param progress 进度 (0-1，0表示即将复活，1表示刚死亡)
     */
    public updateHeroReviveBar(progress: number): void {
        if (!this.heroReviveProgressBar) return;
        this.heroReviveProgressBar.progress = Math.max(0, Math.min(1, progress));
        this.heroReviveProgressBar.node.active = progress > 0;
    }

    /**
     * 隐藏复活CD进度条
     */
    public hideHeroReviveBar(): void {
        if (this.heroReviveProgressBar?.node) {
            this.heroReviveProgressBar.node.active = false;
        }
    }

    /**
     * 隐藏或显示 HUD
     */
    public setHUDVisible(visible: boolean): void {
        if (this.healthProgressBar?.node) {
            this.healthProgressBar.node.active = visible;
        }
        if (this.experienceProgressBar?.node) {
            this.experienceProgressBar.node.active = visible;
        }
        if (this.coinNumGeNode) this.coinNumGeNode.active = visible;
        if (this.coinNumShiNode) this.coinNumShiNode.active = visible;
        if (this.coinNumBaiNode) this.coinNumBaiNode.active = visible;

        if (this.waveNumeratorGeNode) this.waveNumeratorGeNode.active = visible;
        if (this.waveNumeratorShiNode) this.waveNumeratorShiNode.active = visible;
        if (this.waveDenominatorGeNode) this.waveDenominatorGeNode.active = visible;
        if (this.waveDenominatorShiNode) this.waveDenominatorShiNode.active = visible;

        if (this.levelShiNode) this.levelShiNode.active = visible;
        if (this.levelGeNode) this.levelGeNode.active = visible;

        if (this.heroReviveProgressBar?.node) {
            this.heroReviveProgressBar.node.active = false;
        }
    }
}
