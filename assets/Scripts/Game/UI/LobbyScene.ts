import { _decorator, Component, Button, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LobbyScene')
export class LobbyScene extends Component {
    @property({ type: Button })
    public startButton: Button | null = null;
    @property({ type: Button })
    public settingButton: Button | null = null;
    @property({ type: Button })
    public talentButton: Button | null = null;

    onLoad(): void {
        
        this.startButton.node.on(Button.EventType.CLICK, () => {
            director.loadScene('GameScene');
        });
    }
}
