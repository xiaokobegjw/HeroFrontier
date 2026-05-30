import { _decorator, Button, Color, Component, Label, Node, UITransform, view } from 'cc';

const { ccclass } = _decorator;

export type GMPanelHandlers = {
    getModeLabel: () => string;
    getGoldLabel: () => string;
    getQuadTreeLabel: () => string;
    toggleMode: () => void;
    toggleQuadTree: () => void;
    addGold: (amount: number) => void;
};

@ccclass('GMPanel')
export class GMPanel extends Component {
    private handlers: GMPanelHandlers | null = null;
    private panel: Node | null = null;
    private modeLabel: Label | null = null;
    private goldLabel: Label | null = null;
    private quadTreeLabel: Label | null = null;

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
    }

    private buildUI(): void {
        if (this.panel) return;
        const size = view.getVisibleSize();
        const root = this.node;
        root.getComponent(UITransform) ?? root.addComponent(UITransform).setContentSize(size);

        const panel = new Node('GMPanelRoot');
        panel.addComponent(UITransform).setContentSize(320, 160);
        panel.setPosition(size.width * 0.5 - 180, size.height * 0.5 - 100, 0);
        root.addChild(panel);
        this.panel = panel;

        const title = this.createLabel('GM', 18, new Color(255, 220, 120, 255), 300, 26);
        title.node.setPosition(0, 56, 0);
        panel.addChild(title.node);

        const mode = this.createLabel('', 14, new Color(255, 255, 255, 255), 300, 40);
        mode.node.setPosition(0, 20, 0);
        panel.addChild(mode.node);
        this.modeLabel = mode;

        const gold = this.createLabel('', 14, new Color(200, 255, 200, 255), 300, 24);
        gold.node.setPosition(0, -10, 0);
        panel.addChild(gold.node);
        this.goldLabel = gold;

        const qt = this.createLabel('', 14, new Color(200, 220, 255, 255), 300, 24);
        qt.node.setPosition(0, -34, 0);
        panel.addChild(qt.node);
        this.quadTreeLabel = qt;

        this.createButton(panel, '切换显示', -90, -50, () => {
            this.handlers?.toggleMode();
            this.refresh();
        });
        this.createButton(panel, '四叉树', 0, -50, () => {
            this.handlers?.toggleQuadTree();
            this.refresh();
        });
        this.createButton(panel, '+1000 金币', 90, -50, () => {
            this.handlers?.addGold(1000);
            this.refresh();
        });
    }

    private refresh(): void {
        if (!this.panel?.active) return;
        if (this.modeLabel) this.modeLabel.string = `显示模式: ${this.handlers?.getModeLabel() ?? '-'}`;
        if (this.goldLabel) this.goldLabel.string = `金币: ${this.handlers?.getGoldLabel() ?? '-'}`;
        if (this.quadTreeLabel) this.quadTreeLabel.string = `四叉树: ${this.handlers?.getQuadTreeLabel() ?? '-'}`;
    }

    private createLabel(text: string, fontSize: number, color: Color, w: number, h: number): Label {
        const node = new Node('Label');
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
