import { _decorator, Component, Sprite, SpriteFrame, resources, Node } from 'cc';
const { ccclass, property } = _decorator;

/**
 * NumberDisplay 负责显示单个数字 (0-9)
 * 通过从 UI 图集中获取 pixel_number%d.png 纹理来实现
 */
@ccclass('NumberDisplay')
export class NumberDisplay extends Component {
    private currentNumber: number = 0;
    private sprite: Sprite | null = null;
    private static spriteFrames: Map<number, SpriteFrame> = new Map();
    private static isAtlasLoaded: boolean = false;
    private static loadCallbacks: ((success: boolean) => void)[] = [];

    onLoad(): void {
        this.sprite = this.node.getComponent(Sprite);
        if (!this.sprite) {
            console.warn(`[NumberDisplay] Node ${this.node.name} has no Sprite component`);
        }
    }

    private static loadAtlas(): void {
        if (NumberDisplay.isAtlasLoaded) return;

        resources.loadDir('texturePacker/UI', SpriteFrame, (err, spriteFrames) => {
            if (err) {
                console.error(`[NumberDisplay] Failed to load UI atlas:`, err);
                NumberDisplay.loadCallbacks.forEach(cb => cb(false));
                NumberDisplay.loadCallbacks = [];
                return;
            }

            if (Array.isArray(spriteFrames)) {
                spriteFrames.forEach((sf) => {
                    const name = sf.name;
                    const match = name.match(/pixel_number(\d)/);
                    if (match) {
                        const num = parseInt(match[1]);
                        NumberDisplay.spriteFrames.set(num, sf);
                    }
                });
            }

            if (NumberDisplay.spriteFrames.size === 0) {
                console.error(`[NumberDisplay] No pixel_number sprites found in atlas`);
                NumberDisplay.loadCallbacks.forEach(cb => cb(false));
                NumberDisplay.loadCallbacks = [];
                return;
            }

            NumberDisplay.isAtlasLoaded = true;
            NumberDisplay.loadCallbacks.forEach(cb => cb(true));
            NumberDisplay.loadCallbacks = [];
        });
    }

    private static ensureAtlasLoaded(callback: (success: boolean) => void): void {
        if (NumberDisplay.isAtlasLoaded) {
            callback(true);
            return;
        }

        NumberDisplay.loadCallbacks.push(callback);
        if (NumberDisplay.loadCallbacks.length === 1) {
            NumberDisplay.loadAtlas();
        }
    }

    /**
     * 设置要显示的数字 (0-9)
     */
    public setNumber(num: number): void {
        num = Math.max(0, Math.min(9, Math.floor(num)));
        if (num === this.currentNumber && this.sprite?.spriteFrame) return;
        
        this.currentNumber = num;
        if (!this.sprite) {
            console.warn(`[NumberDisplay] Sprite not ready`);
            return;
        }

        NumberDisplay.ensureAtlasLoaded((success) => {
            if (!success) {
                console.warn(`[NumberDisplay] Failed to load atlas, cannot display number ${num}`);
                return;
            }

            const spriteFrame = NumberDisplay.spriteFrames.get(num);
            if (spriteFrame && this.sprite && this.enabled) {
                this.sprite.spriteFrame = spriteFrame;
            } else {
                console.warn(`[NumberDisplay] Sprite frame for number ${num} not found in atlas`);
            }
        });
    }

    public getNumber(): number {
        return this.currentNumber;
    }
}
