import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

import { NumberDisplay } from './NumberDisplay';

@ccclass('HeroLevelDisplay')
export class HeroLevelDisplay extends Component {
    @property({ type: Node })
    public levelShiNode: Node | null = null;

    @property({ type: Node })
    public levelGeNode: Node | null = null;

    private levelShi: NumberDisplay | null = null;
    private levelGe: NumberDisplay | null = null;

    onLoad(): void {
        this.initNumberDisplays();
    }

    private initNumberDisplays(): void {
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

    public displayLevel(level: number): void {
        level = Math.max(1, Math.min(99, Math.floor(level)));

        const shi = Math.floor(level / 10);
        const ge = level % 10;

        if (this.levelShi) this.levelShi.setNumber(shi);
        if (this.levelGe) this.levelGe.setNumber(ge);
    }

    public getDisplayLevel(): number {
        if (!this.levelShi || !this.levelGe) return 1;
        return this.levelShi.getNumber() * 10 + this.levelGe.getNumber();
    }
}
