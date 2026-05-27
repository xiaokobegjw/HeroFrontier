import { _decorator, Component, Node, Label, Color, UITransform, view, Slider, Button } from 'cc';
import { GameSession } from '../Managers/GameSession';
import { CurrencySystem } from '../ECS/Systems/CurrencySystem';
import { World } from '../../Shared/ECS/Core/World';
import { HealthComponent } from '../ECS/Components/HealthComponent';
import { LevelComponent } from '../ECS/Components/LevelComponent';
import { BaseProductionComponent } from '../ECS/Components/BaseProductionComponent';
import { SoldierComponent } from '../ECS/Components/SoldierComponent';
import { TowerPlacementManager } from '../Managers/TowerPlacementManager';
import { SoldierModeBalancer } from '../Managers/SoldierModeBalancer';

const { ccclass } = _decorator;

export type GameUIHandlers = {
    getWorld: () => World | null;
    getCurrency: () => CurrencySystem | null;
    getBaseEntityId: () => number | null;
    getTowerManager: () => TowerPlacementManager | null;
    upgradeCastle: () => boolean;
    selectTowerSlot: (slotIndex: number) => void;
    buildArrowTower: (slotIndex: number) => void;
    buildMagicTower: (slotIndex: number) => void;
    upgradeSelectedTower: () => void;
    sellSelectedTower: () => void;
    restartGame: () => void;
    castSkill?: (skillIndex: number, targetEntityId?: number | null, x?: number, y?: number) => void;
};

@ccclass('GameUIController')
export class GameUIController extends Component {
    private handlers: GameUIHandlers | null = null;
    private hudLabel: Label | null = null;
    private followerSlider: Slider | null = null;
    private gameOverNode: Node | null = null;
    private gameOverLabel: Label | null = null;
    private selectedSlotIndex: number = 0;
    private slotLabel: Label | null = null;

    public init(handlers: GameUIHandlers): void {
        this.handlers = handlers;
        this.buildUI();
    }

    private buildUI(): void {
        const size = view.getVisibleSize();
        const root = this.node;
        const ui = root.getComponent(UITransform) ?? root.addComponent(UITransform);
        ui.setContentSize(size);

        const hud = this.createLabel('HUD', 18, new Color(255, 255, 200, 255));
        hud.node.setPosition(-size.width * 0.5 + 16, size.height * 0.5 - 24, 0);
        root.addChild(hud.node);
        this.hudLabel = hud;

        this.createButton(root, '升级主塔', -size.width * 0.5 + 90, size.height * 0.5 - 80, () => {
            this.handlers?.upgradeCastle();
        });

        const sliderNode = new Node('FollowerSlider');
        const st = sliderNode.addComponent(UITransform);
        st.setContentSize(220, 24);
        sliderNode.setPosition(-size.width * 0.5 + 130, size.height * 0.5 - 120, 0);
        const slider = sliderNode.addComponent(Slider);
        slider.progress = 0;
        sliderNode.on('slide', () => this.onFollowerSlider(slider.progress));
        root.addChild(sliderNode);
        this.followerSlider = slider;

        const sliderHint = this.createLabel('随从比例', 14, new Color(200, 220, 255, 255));
        sliderHint.node.setPosition(-size.width * 0.5 + 16, size.height * 0.5 - 120, 0);
        root.addChild(sliderHint.node);

        const slotLbl = this.createLabel('炮塔位: 0', 14, new Color(200, 255, 200, 255));
        slotLbl.node.setPosition(-size.width * 0.5 + 16, -size.height * 0.5 + 120, 0);
        root.addChild(slotLbl.node);
        this.slotLabel = slotLbl;

        for (let i = 0; i < 8; i++) {
            const col = i % 4;
            const row = Math.floor(i / 4);
            this.createButton(root, `${i + 1}`, -size.width * 0.5 + 60 + col * 52, -size.height * 0.5 + 80 - row * 36, () => {
                this.selectedSlotIndex = i;
                this.handlers?.selectTowerSlot(i);
                this.refresh();
            });
        }

        this.createButton(root, '建箭塔', size.width * 0.5 - 200, -size.height * 0.5 + 80, () => {
            this.handlers?.buildArrowTower(this.selectedSlotIndex);
        });
        this.createButton(root, '建魔法塔', size.width * 0.5 - 90, -size.height * 0.5 + 80, () => {
            this.handlers?.buildMagicTower(this.selectedSlotIndex);
        });
        this.createButton(root, '技能1', size.width * 0.5 - 200, -size.height * 0.5 + 8, () => {
            this.handlers?.castSkill?.(0);
        });
        this.createButton(root, '升级炮塔', size.width * 0.5 - 200, -size.height * 0.5 + 44, () => {
            this.handlers?.upgradeSelectedTower();
            this.refresh();
        });
        this.createButton(root, '出售炮塔', size.width * 0.5 - 90, -size.height * 0.5 + 44, () => {
            this.handlers?.sellSelectedTower();
            this.refresh();
        });

        const goNode = new Node('GameOverPanel');
        const gt = goNode.addComponent(UITransform);
        gt.setContentSize(size.width, size.height);
        const bg = goNode.addComponent(Label);
        bg.string = '';
        goNode.active = false;
        const goLabel = this.createLabel('', 22, new Color(255, 120, 120, 255));
        goLabel.node.setPosition(0, 40, 0);
        goNode.addChild(goLabel.node);
        this.gameOverLabel = goLabel;
        this.createButton(goNode, '重新开始', 0, -40, () => this.handlers?.restartGame());
        root.addChild(goNode);
        this.gameOverNode = goNode;
    }

    private createLabel(text: string, fontSize: number, color: Color): Label {
        const node = new Node('Label');
        node.addComponent(UITransform).setContentSize(400, 80);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.color = color;
        label.overflow = Label.Overflow.RESIZE_HEIGHT;
        label.enableWrapText = true;
        return label;
    }

    private createButton(parent: Node, text: string, x: number, y: number, onClick: () => void): void {
        const node = new Node(`Btn_${text}`);
        const t = node.addComponent(UITransform);
        t.setContentSize(88, 32);
        node.setPosition(x, y, 0);
        const label = node.addComponent(Label);
        label.string = `[${text}]`;
        label.fontSize = 14;
        label.color = new Color(255, 255, 255, 255);
        const btn = node.addComponent(Button);
        btn.transition = Button.Transition.NONE;
        node.on(Button.EventType.CLICK, onClick);
        parent.addChild(node);
    }

    private onFollowerSlider(progress: number): void {
        const world = this.handlers?.getWorld();
        const baseId = this.handlers?.getBaseEntityId();
        if (!world || baseId === null) return;
        const base = world.getEntity(baseId!);
        const prod = base?.getComponent(BaseProductionComponent);
        if (!prod) return;
        const desired = Math.floor(prod.followerCap * Math.max(0, Math.min(1, progress)));
        SoldierModeBalancer.apply(world, baseId!, desired);
    }

    public refresh(): void {
        const world = this.handlers?.getWorld();
        const currency = this.handlers?.getCurrency();
        const baseId = this.handlers?.getBaseEntityId();
        const towers = this.handlers?.getTowerManager();
        const session = GameSession.instance;

        if (!this.hudLabel) return;

        let castleHp = '-';
        let castleLv = 1;
        let followers = 0;
        if (world && baseId !== null) {
            const base = world.getEntity(baseId!);
            const hp = base?.getComponent(HealthComponent);
            const lv = base?.getComponent(LevelComponent);
            const prod = base?.getComponent(BaseProductionComponent);
            if (hp) castleHp = `${Math.ceil(hp.current)}/${hp.max}`;
            if (lv) castleLv = Math.floor(lv.level);
            if (prod) {
                followers = world
                    .getAllEntities()
                    .filter(
                        e =>
                            e.active &&
                            e.getComponent(SoldierComponent)?.baseEntityId === baseId &&
                            e.getComponent(SoldierComponent)?.mode === 'Follower'
                    ).length;
                session.updateMaxFollowers(followers);
                if (this.followerSlider && prod.followerCap > 0) {
                    this.followerSlider.progress = prod.followerDesired / prod.followerCap;
                }
            }
        }

        const gold = currency ? Math.floor(currency.getGold()) : 0;
        const slot = towers?.getSlot(this.selectedSlotIndex);
        const slotState = slot?.entityId !== null ? '已建造' : '空';

        this.hudLabel.string =
            `金币: ${gold}  |  波次: ${session.currentWave}  |  击杀: ${session.totalKills}\n` +
            `主塔 Lv.${castleLv}  HP: ${castleHp}  |  随从: ${followers}/${session.maxFollowers}`;

        if (this.slotLabel) {
            this.slotLabel.string = `炮塔位 ${this.selectedSlotIndex + 1}: ${slotState}`;
        }

        if (this.gameOverNode && this.gameOverLabel) {
            this.gameOverNode.active = session.isGameOver;
            if (session.isGameOver) {
                this.gameOverLabel.string =
                    `游戏结束\n${session.gameOverReason}\n` +
                    `存活波次: ${session.currentWave}  击杀: ${session.totalKills}  最高随从: ${session.maxFollowers}`;
            }
        }
    }

    update(): void {
        this.refresh();
    }
}
