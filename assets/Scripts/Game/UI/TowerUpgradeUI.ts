import { _decorator, Component, Node, Label, Button } from 'cc';
import { World } from '../../Shared/ECS/Core/World';
import { CurrencySystem } from '../ECS/Systems/CurrencySystem';
import { TowerPlacementManager } from '../Managers/TowerPlacementManager';
import { Entity } from '../../Shared/ECS/Core/Entity';

const { ccclass, property } = _decorator;

@ccclass('TowerUpgradeUI')
export class TowerUpgradeUI extends Component {
    @property(Node)
    public TowerUpgradeNode: Node = null!;

    @property(Label)
    public TowerSellMoney: Label = null!;

    @property(Node)
    public IconSelectUpgradeTowerBG: Node = null!;

    @property(Node)
    public IconSelectSellTowerBG: Node = null!;

    @property(Button)
    public BtnSelectMagicTower: Button = null!;

    @property(Button)
    public BtnSellTower: Button = null!;

    private world: World | null = null;
    private currency: CurrencySystem | null = null;
    private towerManager: TowerPlacementManager | null = null;
    private selectedSlotIndex: number = -1;
    private selectedTowerEntity: Entity | null = null;
    private upgradeCost: number = 0;
    private sellPrice: number = 0;

    private isUpgradeSelected: boolean = false;
    private isSellSelected: boolean = false;

    onLoad() {
        this.hide();
        this.bindEvents();
        
        if (this.IconSelectUpgradeTowerBG) this.IconSelectUpgradeTowerBG.active = false;
        if (this.IconSelectSellTowerBG) this.IconSelectSellTowerBG.active = false;
    }

    private bindEvents() {
        if (this.BtnSelectMagicTower) {
            this.BtnSelectMagicTower.node.on(Button.EventType.CLICK, this.onBtnSelectMagicTowerClicked, this);
        }
        if (this.BtnSellTower) {
            this.BtnSellTower.node.on(Button.EventType.CLICK, this.onBtnSellTowerClicked, this);
        }
    }

    public init(world: World, currency: CurrencySystem, towerManager: TowerPlacementManager): void {
        this.world = world;
        this.currency = currency;
        this.towerManager = towerManager;
    }

    public show(slotIndex: number, towerEntity: Entity, worldPos: { x: number; y: number }, upgradeCost: number, sellPrice: number, isCastle: boolean = false): void {
        this.selectedSlotIndex = slotIndex;
        this.selectedTowerEntity = towerEntity;
        this.upgradeCost = upgradeCost;
        this.sellPrice = sellPrice;

        if (this.TowerSellMoney) {
            this.TowerSellMoney.string = `${upgradeCost}`;
        }

        this.isUpgradeSelected = false;
        this.isSellSelected = false;
        
        if (this.IconSelectUpgradeTowerBG) this.IconSelectUpgradeTowerBG.active = false;
        if (this.IconSelectSellTowerBG) this.IconSelectSellTowerBG.active = false;

        // 城堡不显示出售节点
        if (isCastle && this.BtnSellTower) {
            this.BtnSellTower.node.active = false;
        } else if (this.BtnSellTower) {
            this.BtnSellTower.node.active = true;
        }

        if (this.TowerUpgradeNode) {
            this.TowerUpgradeNode.active = true;
            this.TowerUpgradeNode.setPosition(worldPos.x, worldPos.y, 0);
        }
    }

    public hide(): void {
        if (this.TowerUpgradeNode) {
            this.TowerUpgradeNode.active = false;
        }
        this.selectedSlotIndex = -1;
        this.selectedTowerEntity = null;
        this.isUpgradeSelected = false;
        this.isSellSelected = false;
    }

    private onBtnSelectMagicTowerClicked(): void {
        if (this.isUpgradeSelected) {
            this.performUpgrade();
        } else {
            this.isUpgradeSelected = true;
            this.isSellSelected = false;
            
            if (this.IconSelectSellTowerBG) this.IconSelectSellTowerBG.active = true;
            if (this.IconSelectUpgradeTowerBG) this.IconSelectUpgradeTowerBG.active = false;
        }
    }

    private onBtnSellTowerClicked(): void {
        if (this.isSellSelected) {
            this.performSell();
        } else {
            this.isSellSelected = true;
            this.isUpgradeSelected = false;
            
            if (this.IconSelectUpgradeTowerBG) this.IconSelectUpgradeTowerBG.active = true;
            if (this.IconSelectSellTowerBG) this.IconSelectSellTowerBG.active = false;
        }
    }

    private async performUpgrade(): Promise<void> {
        if (!this.world || !this.currency || !this.towerManager || !this.selectedTowerEntity) return;

        if (this.currency.getGold() < this.upgradeCost) {
            this.showTips('金币不足！');
            return;
        }

        const success = this.towerManager.upgradeTower(this.world, this.currency, this.selectedTowerEntity.id);
        
        if (success) {
            this.hide();
            this.refreshUI();
        }
    }

    private async performSell(): Promise<void> {
        if (!this.world || !this.currency || !this.towerManager || this.selectedSlotIndex === -1) return;

        const refund = this.towerManager.sellTower(this.world, this.currency, this.selectedSlotIndex);
        
        if (refund > 0) {
            this.hide();
            this.refreshUI();
        }
    }

    private refreshUI(): void {
        const gameMain = this.node.parent?.getComponent('GameMain') as any;
        if (gameMain && gameMain.gameUI) {
            gameMain.gameUI.refresh();
        }
    }

    private showTips(msg: string): void {
        console.log(`[TowerUpgradeUI] ${msg}`);
    }
}