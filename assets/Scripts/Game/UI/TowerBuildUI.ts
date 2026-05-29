import { _decorator, Component, Node, Label, Color, UITransform, view, Vec3, Button, Animation } from 'cc';
import { World } from '../../Shared/ECS/Core/World';
import { CurrencySystem } from '../ECS/Systems/CurrencySystem';
import { TowerPlacementManager } from '../Managers/TowerPlacementManager';
import { EntityConfigCache } from '../Managers/EntityConfigCache';

const { ccclass, property } = _decorator;

/**
 * 塔防建造 UI 组件
 * 处理塔的选择、建造、范围预览等逻辑
 */
@ccclass('TowerBuildUI')
export class TowerBuildUI extends Component {
    @property(Node)
    public towerAttackRange: Node = null!;

    @property(Node)
    public towerSelectNode: Node = null!;

    @property(Animation)
    public towerSelectAni: Animation = null!;

    @property(Node)
    public iconSelectArrowTowerBG: Node = null!;

    @property(Node)
    public iconSelectMagicTowerBG: Node = null!;

    @property(Label)
    public arrowTowerMoneyLabel: Label = null!;

    @property(Label)
    public magicTowerMoneyLabel: Label = null!;

    @property(Button)
    public btnSelectArrow: Button = null!;

    @property(Button)
    public btnSelectMagic: Button = null!;

    private world: World | null = null;
    private currency: CurrencySystem | null = null;
    private towerManager: TowerPlacementManager | null = null;
    private selectedSlotIndex: number = -1;
    private currentSelectedTowerType: 'Arrow' | 'Magic' | null = null;

    // 配置常量 (实际开发中应从配置加载，这里根据需求硬编码或预加载)
    private readonly ARROW_TOWER_ID = 'ArrowTower';
    private readonly MAGIC_TOWER_ID = 'MagicTower';
    private arrowTowerCost: number = 80;
    private magicTowerCost: number = 100;
    private arrowTowerRange: number = 480;
    private magicTowerRange: number = 420;

    onLoad() {
        this.hideAll();
        this.initCosts();
        this.bindEvents();
    }

    private bindEvents() {
        if (this.btnSelectArrow) {
            this.btnSelectArrow.node.on(Button.EventType.CLICK, this.onBtnSelectArrowClicked, this);
        }
        if (this.btnSelectMagic) {
            this.btnSelectMagic.node.on(Button.EventType.CLICK, this.onBtnSelectMagicClicked, this);
        }
    }

    public init(world: World, currency: CurrencySystem, towerManager: TowerPlacementManager): void {
        this.world = world;
        this.currency = currency;
        this.towerManager = towerManager;
    }

    private async initCosts() {
        try {
            const arrowCfg = await EntityConfigCache.loadEntityConfig(this.ARROW_TOWER_ID);
            const magicCfg = await EntityConfigCache.loadEntityConfig(this.MAGIC_TOWER_ID);

            const arrowTowerComp = arrowCfg?.ComponentsList?.find((c: any) => c.id === 'TowerComponent');
            const arrowWeaponComp = arrowCfg?.ComponentsList?.find((c: any) => c.id === 'WeaponComponent');
            if (arrowTowerComp) this.arrowTowerCost = arrowTowerComp.buildCost;
            if (arrowWeaponComp) this.arrowTowerRange = arrowWeaponComp.range;

            const magicTowerComp = magicCfg?.ComponentsList?.find((c: any) => c.id === 'TowerComponent');
            const magicWeaponComp = magicCfg?.ComponentsList?.find((c: any) => c.id === 'WeaponComponent');
            if (magicTowerComp) this.magicTowerCost = magicTowerComp.buildCost;
            if (magicWeaponComp) this.magicTowerRange = magicWeaponComp.range;

            this.updateLabels();
        } catch (e) {
            console.error('Failed to load tower configs for UI', e);
        }
    }

    private updateLabels() {
        if (this.arrowTowerMoneyLabel) this.arrowTowerMoneyLabel.string = `${this.arrowTowerCost}`;
        if (this.magicTowerMoneyLabel) this.magicTowerMoneyLabel.string = `${this.magicTowerCost}`;
    }

    private hideAll() {
        if (this.towerAttackRange) this.towerAttackRange.active = false;
        if (this.towerSelectNode) this.towerSelectNode.active = false;
        if (this.iconSelectArrowTowerBG) this.iconSelectArrowTowerBG.active = false;
        if (this.iconSelectMagicTowerBG) this.iconSelectMagicTowerBG.active = false;
        this.currentSelectedTowerType = null;
    }

    /**
     * 当点击地图上的坑位时调用
     * @param slotIndex 坑位索引
     * @param worldPos 坑位的世界像素位置
     */
    public showBuildMenu(slotIndex: number, worldPos: { x: number; y: number }): void {
        this.selectedSlotIndex = slotIndex;
        this.hideAll();

        // 显示面板并定位
        if (this.towerSelectNode) {
            this.towerSelectNode.active = true;
            this.towerSelectNode.setPosition(worldPos.x, worldPos.y, 0);
            
            // 播放显示动画
            if (this.towerSelectAni) {
                this.towerSelectAni.play('showTowerSelectAni');
            }
        }

        // 显示攻击范围预览并定位
        if (this.towerAttackRange) {
            this.towerAttackRange.active = true;
            this.towerAttackRange.setPosition(worldPos.x, worldPos.y, 0);
            // 初始缩放设为 0，直到选中塔类型
            this.towerAttackRange.setScale(0, 0, 1);
        }
    }

    /**
     * 隐藏建造面板
     */
    public hide(): void {
        this.hideAll();
        this.selectedSlotIndex = -1;
    }

    /**
     * 弓箭塔按钮点击回调 (由 Cocos Button 事件绑定)
     */
    public onBtnSelectArrowClicked(): void {
        if (this.currentSelectedTowerType === 'Arrow') {
            // 二次点击：建造
            this.performBuild('Arrow');
        } else {
            // 首次点击：选中并校验资源
            if (this.currency && this.currency.getGold() >= this.arrowTowerCost) {
                this.selectTowerType('Arrow');
            } else {
                this.showTips('金币不足！');
            }
        }
    }

    /**
     * 魔法塔按钮点击回调 (由 Cocos Button 事件绑定)
     */
    public onBtnSelectMagicClicked(): void {
        if (this.currentSelectedTowerType === 'Magic') {
            // 二次点击：建造
            this.performBuild('Magic');
        } else {
            // 首次点击：选中并校验资源
            if (this.currency && this.currency.getGold() >= this.magicTowerCost) {
                this.selectTowerType('Magic');
            } else {
                this.showTips('金币不足！');
            }
        }
    }

    private selectTowerType(type: 'Arrow' | 'Magic'): void {
        this.currentSelectedTowerType = type;
        
        // 互斥显示背景
        if (this.iconSelectArrowTowerBG) this.iconSelectArrowTowerBG.active = (type === 'Arrow');
        if (this.iconSelectMagicTowerBG) this.iconSelectMagicTowerBG.active = (type === 'Magic');

        // 适配攻击范围缩放
        // 原始尺寸 180px。公式：scale = targetRange * 2 / 180 (因为 range 是半径，展示图宽度是直径)
        // 策划需求：确保视觉展示与实际判定匹配
        const range = type === 'Arrow' ? this.arrowTowerRange : this.magicTowerRange;
        const scale = (range * 2) / 180;
        
        if (this.towerAttackRange) {
            this.towerAttackRange.setScale(scale, scale, 1);
        }
    }

    private async performBuild(type: 'Arrow' | 'Magic') {
        if (!this.world || !this.currency || !this.towerManager || this.selectedSlotIndex === -1) return;

        const configId = type === 'Arrow' ? this.ARROW_TOWER_ID : this.MAGIC_TOWER_ID;
        const success = await this.towerManager.buildTower(this.world, this.currency, this.selectedSlotIndex, configId);
        
        if (success) {
            this.hideAll(); // 这会隐藏攻击范围预览、建造菜单和所有选中背景
            this.selectedSlotIndex = -1;
            // 通知 UI 刷新金币显示
            const gameMain = this.node.parent?.getComponent('GameMain') as any;
            if (gameMain && gameMain.gameUI) gameMain.gameUI.refresh();
        }
    }

    private showTips(msg: string) {
        // 这里可以调用全局提示 UI，暂时用 console.log
        console.log(`[TowerBuildUI] ${msg}`);
    }
}
