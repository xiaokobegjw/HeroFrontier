import { _decorator, Component, Node, ProgressBar, Label, find } from 'cc';
import { LocalizationManager, LanguageType } from '../I18n/LocalizationManager';
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
            this.loadingProgress = 1;
            await this.delay(500);
            this.onLoadingComplete();
        } catch (error) {
            console.error('Loading failed:', error);
        }
    }

    private async loadResourcesAsync() {
        const loadSteps = [
            { name: 'configs', progress: 0.2 },
            { name: 'prefabs', progress: 0.3 },
            { name: 'textures', progress: 0.25 },
            { name: 'animations', progress: 0.15 },
            { name: 'audio', progress: 0.1 }
        ];

        for (const step of loadSteps) {
            await this.simulateLoadStep(step.progress);
        }
    }

    private async simulateLoadStep(progressIncrement: number) {
        const duration = 800 + Math.random() * 400;
        const startTime = Date.now();

        while (Date.now() - startTime < duration) {
            const elapsed = Date.now() - startTime;
            const progress = (elapsed / duration) * progressIncrement;
            this.loadingProgress += progress / 10;
            await this.delay(50);
        }

        this.loadingProgress = Math.min(this.loadingProgress + progressIncrement, 0.99);
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
        
        setTimeout(() => {
            this.loadingNode.active = false;
            this.onLoadingFinished();
        }, 300);
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
