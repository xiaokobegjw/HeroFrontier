import { _decorator, Component, Node, ProgressBar, Label, resources, JsonAsset, Prefab, SpriteFrame, AnimationClip } from 'cc';
import { LocalizationManager } from '../I18n/LocalizationManager';
const { ccclass, property } = _decorator;

@ccclass('LoadingScreen')
export class LoadingScreen extends Component {
    @property({ type: ProgressBar })
    private loadingBar: ProgressBar = null!;

    @property({ type: Label })
    private loadingTips: Label = null!;

    @property({ type: Node })
    private loadingNode: Node = null!;

    private tipsKeyPrefix: string = 'loading_tip_';
    private totalTips: number = 10;
    private currentTipIndex: number = 0;
    private tipInterval: number = 3000;
    private tipTimer: number = 0;
    private isLoading: boolean = false;
    private loadingProgress: number = 0;

    onLoad() {
        this.loadingNode.active = true;
        this.loadingBar.progress = 0;
        this.currentTipIndex = Math.floor(Math.random() * this.totalTips) + 1;
        this.updateTips();
    }

    start() {
        this.startLoading();
    }

    update(deltaTime: number) {
        if (!this.isLoading) return;

        this.tipTimer += deltaTime * 1000;
        if (this.tipTimer >= this.tipInterval) {
            this.tipTimer = 0;
            this.nextTip();
        }

        this.loadingBar.progress = this.loadingProgress;
    }

    private async startLoading() {
        this.isLoading = true;
        this.loadingProgress = 0;

        try {
            await this.loadResourcesAsync();
        } catch (error) {
            // 预加载失败不阻塞进入游戏，未加载的资源会按需加载
            console.error('[LoadingScreen] preload failed, fallback to on-demand loading', error);
        }

        this.loadingProgress = 1;
        await this.delay(200);
        this.onLoadingComplete();
    }

    private async loadResourcesAsync() {
        const steps: Array<{ weight: number; run: (report: (p: number) => void) => Promise<void> }> = [
            { weight: 0.05, run: p => this.loadConfigs(p) },
            { weight: 0.25, run: p => this.loadDirAssets('clips', AnimationClip, p) },
            { weight: 0.45, run: p => this.loadDirAssets('prefabs', Prefab, p) },
            { weight: 0.1, run: p => this.loadLevels(p) },
            { weight: 0.15, run: p => this.loadDirAssets('texturePacker', SpriteFrame, p) }
        ];

        let completed = 0;
        for (const step of steps) {
            try {
                await step.run(p => {
                    this.loadingProgress = Math.min(0.99, completed + p * step.weight);
                });
            } catch (error) {
                // 单个目录加载失败不影响后续资源
                console.warn('[LoadingScreen] preload step failed', error);
            }
            completed += step.weight;
        }
    }

    private loadConfigs(report: (p: number) => void): Promise<void> {
        return this.chain([
            { weight: 0.2, run: p => this.loadAsset('configs/GameConfig', JsonAsset, p) },
            { weight: 0.4, run: p => this.loadDirAssets('configs/Skills', JsonAsset, p) },
            { weight: 0.4, run: p => this.loadDirAssets('configs/Entitys', JsonAsset, p) }
        ], report);
    }

    private loadLevels(report: (p: number) => void): Promise<void> {
        return this.chain([
            { weight: 0.5, run: p => this.loadDirAssets('levels', JsonAsset, p) },
            { weight: 0.5, run: p => this.loadDirAssets('levels', SpriteFrame, p) }
        ], report);
    }

    private async chain(
        steps: Array<{ weight: number; run: (report: (p: number) => void) => Promise<void> }>,
        report: (p: number) => void
    ): Promise<void> {
        let completed = 0;
        for (const step of steps) {
            await step.run(p => report(Math.min(0.99, completed + p * step.weight)));
            completed += step.weight;
        }
        report(1);
    }

    private loadAsset(path: string, type: any, report: (p: number) => void): Promise<void> {
        return new Promise(resolve => {
            resources.load(path, type as any, () => {
                report(1);
                resolve();
            });
        });
    }

    private loadDirAssets(path: string, type: any, report: (p: number) => void): Promise<void> {
        return new Promise(resolve => {
            resources.loadDir(
                path,
                type as any,
                (finished: number, total: number) => report(total > 0 ? finished / total : 0),
                (err: Error | null) => {
                    if (err) console.warn(`[LoadingScreen] loadDir failed: ${path}`, err);
                    resolve();
                }
            );
        });
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private nextTip() {
        this.currentTipIndex++;
        if (this.currentTipIndex > this.totalTips) {
            this.currentTipIndex = 1;
        }
        this.updateTips();
    }

    private updateTips() {
        const tipKey = `${this.tipsKeyPrefix}${this.currentTipIndex}`;
        const tipText = LocalizationManager.instance.t(tipKey);
        this.loadingTips.string = tipText;
    }

    private onLoadingComplete() {
        this.isLoading = false;
        this.loadingBar.progress = 1;
        // 由 GameMain 在关卡与角色就绪后关闭加载界面，避免出现空场景
        this.onLoadingFinished();
    }

    private onLoadingFinished() {
        console.log('Loading completed, game ready');
        this.node.emit('loadingComplete');
    }

    public show() {
        this.loadingNode.active = true;
        this.loadingProgress = 0;
        this.loadingBar.progress = 0;
        this.currentTipIndex = Math.floor(Math.random() * this.totalTips) + 1;
        this.updateTips();
        this.startLoading();
    }

    public hide() {
        this.loadingNode.active = false;
        this.isLoading = false;
    }
}
