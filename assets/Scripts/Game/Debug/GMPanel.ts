import { _decorator, BlockInputEvents, Button, Color, Component, Graphics, Label, Node, UITransform, view } from 'cc';

const { ccclass } = _decorator;

export type GMSkillOption = { id: string; name: string };
export type GMHeroSkillOption = { id: string; level: number };

export type GMPanelHandlers = {
    getModeLabel: () => string;
    getGoldLabel: () => string;
    getQuadTreeLabel: () => string;
    getSkillHitboxLabel: () => string;
    toggleMode: () => void;
    toggleQuadTree: () => void;
    toggleSkillHitboxes: () => void;
    addGold: (amount: number) => void;
    openSkillSelect: () => void;
    removeLastSkill: () => void;
    upgradeLastSkill: () => void;
    getAllSkills: () => GMSkillOption[];
    getHeroSkills: () => GMHeroSkillOption[];
    addHeroSkill: (skillId: string) => void;
    removeHeroSkillAt: (index: number) => void;
};

@ccclass('GMPanel')
export class GMPanel extends Component {
    private handlers: GMPanelHandlers | null = null;
    private panel: Node | null = null;
    private backdrop: Node | null = null;
    private modeLabel: Label | null = null;
    private goldLabel: Label | null = null;
    private quadTreeLabel: Label | null = null;
    private skillHitboxLabel: Label | null = null;
    private skillManagePanel: Node | null = null;
    private skillManageTitle: Label | null = null;
    private selectedSkillLabel: Label | null = null;
    private skillOptionsContainer: Node | null = null;
    private heroSkillsContainer: Node | null = null;
    private selectedSkillId: string = '';
    private skillPage: number = 0;

    public init(handlers: GMPanelHandlers): void {
        this.handlers = handlers;
        this.buildUI();
        this.setVisible(false);
        this.refresh();
    }

    public toggle(): void {
        this.setVisible(!(this.panel?.active ?? false));
        this.refresh();
    }

    private setVisible(visible: boolean): void {
        if (this.panel) this.panel.active = visible;
        if (this.backdrop) this.backdrop.active = visible;
        if (!visible && this.skillManagePanel) this.skillManagePanel.active = false;
    }

    private buildUI(): void {
        if (this.panel) return;
        const root = this.node;
        root.getComponent(UITransform) ?? root.addComponent(UITransform);

        const rootUi = root.getComponent(UITransform)!;
        const viewSize = view.getVisibleSize();
        const w = rootUi.contentSize.width > 0 ? rootUi.contentSize.width : viewSize.width;
        const h = rootUi.contentSize.height > 0 ? rootUi.contentSize.height : viewSize.height;
        const left = -rootUi.anchorX * w;
        const bottom = -rootUi.anchorY * h;

        const backdrop = new Node('GMBackdrop');
        backdrop.layer = root.layer;
        const backdropTransform = backdrop.addComponent(UITransform);
        backdropTransform.setContentSize(w, h);
        backdrop.setPosition(0, 0, 0);
        const block = backdrop.addComponent(BlockInputEvents);
        void block;
        const bg = backdrop.addComponent(Graphics);
        bg.fillColor = new Color(0, 0, 0, 140);
        bg.rect(left, bottom, w, h);
        bg.fill();
        root.addChild(backdrop);
        backdrop.setSiblingIndex(root.children.length - 1);
        backdrop.active = false;
        this.backdrop = backdrop;

        const panel = new Node('GMPanelRoot');
        const panelW = 360;
        const panelH = 340;
        panel.addComponent(UITransform).setContentSize(panelW, panelH);
        panel.layer = root.layer;
        panel.setPosition(0, 0, 0);
        root.addChild(panel);
        panel.setSiblingIndex(root.children.length - 1);
        this.panel = panel;

        const panelBg = new Node('PanelBg');
        panelBg.layer = root.layer;
        panelBg.addComponent(UITransform).setContentSize(panelW, panelH);
        panelBg.setPosition(0, 0, 0);
        const panelGfx = panelBg.addComponent(Graphics);
        panelGfx.fillColor = new Color(0, 0, 0, 140);
        panelGfx.rect(-panelW * 0.5, -panelH * 0.5, panelW, panelH);
        panelGfx.fill();
        panel.addChild(panelBg);
        panelBg.setSiblingIndex(0);

        const title = this.createLabel('GM', 18, new Color(255, 220, 120, 255), 300, 26);
        title.node.setPosition(0, 112, 0);
        panel.addChild(title.node);

        const mode = this.createLabel('', 14, new Color(255, 255, 255, 255), 300, 40);
        mode.node.setPosition(0, 78, 0);
        panel.addChild(mode.node);
        this.modeLabel = mode;

        const gold = this.createLabel('', 14, new Color(200, 255, 200, 255), 300, 24);
        gold.node.setPosition(0, 46, 0);
        panel.addChild(gold.node);
        this.goldLabel = gold;

        const qt = this.createLabel('', 14, new Color(200, 220, 255, 255), 300, 24);
        qt.node.setPosition(0, 22, 0);
        panel.addChild(qt.node);
        this.quadTreeLabel = qt;

        const hb = this.createLabel('', 14, new Color(255, 220, 200, 255), 320, 24);
        hb.node.setPosition(0, 0, 0);
        panel.addChild(hb.node);
        this.skillHitboxLabel = hb;

        this.createButton(panel, '切换显示', -100, -40, () => {
            this.handlers?.toggleMode();
            this.refresh();
        });
        this.createButton(panel, '四叉树', 0, -40, () => {
            this.handlers?.toggleQuadTree();
            this.refresh();
        });
        this.createButton(panel, '+1000 金币', 100, -40, () => {
            this.handlers?.addGold(1000);
            this.refresh();
        });
        this.createButton(panel, '碰撞盒', 0, -80, () => {
            this.handlers?.toggleSkillHitboxes();
            this.refresh();
        });
        this.createButton(panel, '技能管理', 0, -120, () => {
            this.toggleSkillManager();
        });
        this.createButton(panel, '技能抽取', 0, -150, () => {
            this.handlers?.openSkillSelect();
            this.refresh();
        });
        this.createButton(panel, '删最后技能', -100, -160, () => {
            this.handlers?.removeLastSkill();
            this.refresh();
        });
        this.createButton(panel, '升最后技能', 100, -160, () => {
            this.handlers?.upgradeLastSkill();
            this.refresh();
        });

        const sp = new Node('SkillManagePanel');
        const spW = 420;
        const spH = 320;
        sp.addComponent(UITransform).setContentSize(spW, spH);
        sp.layer = root.layer;
        sp.setPosition(panelW * 0.5 + 18 + spW * 0.5, 0, 0);
        root.addChild(sp);
        sp.setSiblingIndex(root.children.length - 1);
        sp.active = false;
        this.skillManagePanel = sp;

        const spBg = new Node('PanelBg');
        spBg.layer = root.layer;
        spBg.addComponent(UITransform).setContentSize(spW, spH);
        spBg.setPosition(0, 0, 0);
        const spGfx = spBg.addComponent(Graphics);
        spGfx.fillColor = new Color(0, 0, 0, 140);
        spGfx.rect(-spW * 0.5, -spH * 0.5, spW, spH);
        spGfx.fill();
        sp.addChild(spBg);
        spBg.setSiblingIndex(0);

        const sTitle = this.createLabel('技能管理', 18, new Color(255, 220, 120, 255), spW - 20, 28);
        sTitle.node.setPosition(0, spH * 0.5 - 22, 0);
        sp.addChild(sTitle.node);
        this.skillManageTitle = sTitle;

        const sel = this.createLabel('', 14, new Color(255, 255, 255, 255), spW - 20, 24);
        sel.node.setPosition(0, spH * 0.5 - 54, 0);
        sp.addChild(sel.node);
        this.selectedSkillLabel = sel;

        this.createButton(sp, '上一页', -120, spH * 0.5 - 90, () => {
            this.skillPage = Math.max(0, this.skillPage - 1);
            this.refreshSkillManager();
        });
        this.createButton(sp, '下一页', 120, spH * 0.5 - 90, () => {
            this.skillPage = this.skillPage + 1;
            this.refreshSkillManager();
        });
        this.createButton(sp, '添加所选', 0, spH * 0.5 - 126, () => {
            if (this.selectedSkillId) this.handlers?.addHeroSkill(this.selectedSkillId);
            this.refreshSkillManager();
        });

        const opt = new Node('SkillOptions');
        opt.addComponent(UITransform).setContentSize(spW - 20, 160);
        opt.setPosition(0, 20, 0);
        sp.addChild(opt);
        this.skillOptionsContainer = opt;

        const curTitle = this.createLabel('当前技能(点击删除)', 14, new Color(200, 255, 200, 255), spW - 20, 20);
        curTitle.node.setPosition(0, -70, 0);
        sp.addChild(curTitle.node);

        const cur = new Node('HeroSkills');
        cur.addComponent(UITransform).setContentSize(spW - 20, 90);
        cur.setPosition(0, -115, 0);
        sp.addChild(cur);
        this.heroSkillsContainer = cur;
    }

    private refresh(): void {
        if (!this.panel?.active) return;
        if (this.modeLabel) this.modeLabel.string = `显示模式: ${this.handlers?.getModeLabel() ?? '-'}`;
        if (this.goldLabel) this.goldLabel.string = `金币: ${this.handlers?.getGoldLabel() ?? '-'}`;
        if (this.quadTreeLabel) this.quadTreeLabel.string = `四叉树: ${this.handlers?.getQuadTreeLabel() ?? '-'}`;
        if (this.skillHitboxLabel) this.skillHitboxLabel.string = `技能碰撞: ${this.handlers?.getSkillHitboxLabel() ?? '-'}`;
        if (this.skillManagePanel?.active) this.refreshSkillManager();
    }

    private toggleSkillManager(): void {
        if (!this.skillManagePanel) return;
        this.skillManagePanel.active = !this.skillManagePanel.active;
        this.skillPage = 0;
        if (this.skillManagePanel.active) {
            this.refreshSkillManager();
        }
    }

    private refreshSkillManager(): void {
        if (!this.skillManagePanel?.active) return;
        const all = this.handlers?.getAllSkills() ?? [];
        const hero = this.handlers?.getHeroSkills() ?? [];

        if (!this.selectedSkillId && all.length > 0) {
            this.selectedSkillId = all[0].id;
        }
        const selectedName = all.find(s => s.id === this.selectedSkillId)?.name ?? this.selectedSkillId;
        if (this.selectedSkillLabel) this.selectedSkillLabel.string = `所选: ${selectedName || '-'}`;

        const pageSize = 10;
        const start = this.skillPage * pageSize;
        const end = Math.min(all.length, start + pageSize);
        this.rebuildSkillOptions(all.slice(start, end));
        this.rebuildHeroSkills(hero);
    }

    private rebuildSkillOptions(items: GMSkillOption[]): void {
        const container = this.skillOptionsContainer;
        if (!container) return;
        for (const ch of container.children.slice()) ch.destroy();

        const colW = 200;
        const rowH = 30;
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const x = i % 2 === 0 ? -110 : 110;
            const y = 65 - Math.floor(i / 2) * rowH;
            const node = new Node(`Opt_${it.id}`);
            node.addComponent(UITransform).setContentSize(colW, 26);
            node.setPosition(x, y, 0);
            const label = node.addComponent(Label);
            label.string = it.name;
            label.fontSize = 12;
            label.color = new Color(255, 255, 255, 255);
            label.overflow = Label.Overflow.CLAMP;
            const btn = node.addComponent(Button);
            btn.transition = Button.Transition.NONE;
            node.on(Button.EventType.CLICK, () => {
                this.selectedSkillId = it.id;
                if (this.selectedSkillLabel) this.selectedSkillLabel.string = `所选: ${it.name}`;
            });
            container.addChild(node);
        }
    }

    private rebuildHeroSkills(items: GMHeroSkillOption[]): void {
        const container = this.heroSkillsContainer;
        if (!container) return;
        for (const ch of container.children.slice()) ch.destroy();

        const rowH = 28;
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const node = new Node(`HeroSkill_${i}`);
            node.addComponent(UITransform).setContentSize(380, 24);
            node.setPosition(0, 32 - i * rowH, 0);
            const label = node.addComponent(Label);
            label.string = `${it.id} Lv.${it.level}`;
            label.fontSize = 12;
            label.color = new Color(255, 255, 255, 255);
            label.overflow = Label.Overflow.CLAMP;
            const btn = node.addComponent(Button);
            btn.transition = Button.Transition.NONE;
            node.on(Button.EventType.CLICK, () => {
                this.handlers?.removeHeroSkillAt(i);
                this.refreshSkillManager();
            });
            container.addChild(node);
        }
    }

    private createLabel(text: string, fontSize: number, color: Color, w: number, h: number): Label {
        const node = new Node('Label');
        node.layer = this.node.layer;
        node.addComponent(UITransform).setContentSize(w, h);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.color = color;
        label.overflow = Label.Overflow.CLAMP;
        label.enableWrapText = true;
        return label;
    }

    private createButton(parent: Node, text: string, x: number, y: number, onClick: () => void): void {
        const node = new Node(`Btn_${text}`);
        node.layer = this.node.layer;
        node.addComponent(UITransform).setContentSize(140, 34);
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
}
