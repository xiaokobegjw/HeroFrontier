import { _decorator, Component, Button, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('StartPageScene')
export class StartPageScene extends Component {
    @property({ type: Button })
    public startButton: Button | null = null;

    onLoad(): void {
        // Prefer editor-bound button; fallback to lookup by name for convenience
        const btn = this.startButton ?? this.node.getChildByName('start')?.getComponent(Button) ?? null;
        if (!btn) return;
        btn.node.on(Button.EventType.CLICK, () => {
            director.loadScene('Lobby');
        });
    }
}
