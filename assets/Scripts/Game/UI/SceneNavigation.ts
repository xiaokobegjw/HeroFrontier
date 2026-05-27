import { _decorator, Component, Node, Button, director } from 'cc';
const { ccclass } = _decorator;

@ccclass('SceneNavigation')
export class SceneNavigation extends Component {
    onLoad(): void {
        this.attachSceneButtons();
    }

    private attachSceneButtons(): void {
        const sceneName = this.node.scene?.name ?? director.getScene()?.name ?? '';
        if (sceneName === 'StartPage') {
            this.attachButton('start', 'Lobby');
        } else if (sceneName === 'Lobby') {
            this.attachButton('BtnStartGame', 'GameScene');
        }
    }

    private attachButton(buttonName: string, targetScene: string): void {
        const buttonNode = this.node.getChildByName(buttonName);
        if (!buttonNode) return;
        const button = buttonNode.getComponent(Button);
        if (!button) return;
        button.node.on(Button.EventType.CLICK, () => {
            director.loadScene(targetScene);
        });
    }
}
