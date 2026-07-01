import { _decorator, Button, Component, Label, Node, RichText, Sprite, SpriteFrame, resources, director } from 'cc';
import { World } from '../../Shared/ECS/Core/World';
import { t } from '../I18n/LocalizationManager';
import { SkillComponent } from '../ECS/Components/SkillComponent';
import { SkillStateComponent } from '../ECS/Components/SkillStateComponent';
import { SkillSystem } from '../ECS/Systems/SkillSystem';
import { UIEventBus, UIEvents, type HeroSkillsChangedPayload } from './UIEventBus';

const { ccclass } = _decorator;

type SkillUIEntry = {
    id: string;
    iconFrame: string;
    nameKey: string;
    descKey: string;
    shortDescKey: string;
};

type SkillUIConfig = {
    atlas: string;
    maxSlots: number;
    levelNumberFramePattern: string;
    skills: SkillUIEntry[];
};

type SkillPoolConfig = {
    maxSkillSlots?: number;
    skills: { id: string; category?: string; weight?: number }[];
};

type InitOptions = {
    getWorld: () => World | null;
    getHeroEntityId: () => number | null;
    setPaused: (paused: boolean) => void;
    skillPool: SkillPoolConfig;
    uiConfig: SkillUIConfig;
};

@ccclass('SkillPanelController')
export class SkillPanelController extends Component {
    private opts: InitOptions | null = null;
    private uiRoot: Node | null = null;

    private skillSlotNodes: (Node | null)[] = [];
    private skillSlotIconSprites: (Sprite | null)[] = [];
    private skillSlotLevelSprites: (Sprite | null)[] = [];
    private skillSlotCdSprites: (Sprite | null)[] = [];

    private cardSelectNode: Node | null = null;
    private splashNode: Node | null = null;
    private cardNodes: Node[] = [];
    private cardTitleLabels: (Label | null)[] = [];
    private cardIconSprites: (Sprite | null)[] = [];
    private cardDescRichTexts: (RichText | null)[] = [];

    private uiMap: Map<string, SkillUIEntry> = new Map();
    private spriteFramesByName: Map<string, SpriteFrame> = new Map();
    private atlasLoaded: boolean = false;
    private atlasLoading: boolean = false;
    private pendingChoices: string[] = [];

    public init(opts: InitOptions): void {
        this.opts = opts;
        const scene = director.getScene();
        this.uiRoot =
            this.findChildByName(this.node, 'UINode') ??
            (scene ? this.findChildByName(scene, 'UINode') : null) ??
            this.node;
        this.uiMap = new Map((opts.uiConfig.skills ?? []).map(s => [s.id, s]));
        this.collectSkillSlots();
        this.collectCardSelectUI();
        this.setCardSelectVisible(false);
        this.ensureAtlasLoaded();
        this.refreshSkillSlots();
    }

    protected onEnable(): void {
        UIEventBus.on(UIEvents.HeroSkillsChanged, this.onHeroSkillsChanged, this);
    }

    protected onDisable(): void {
        UIEventBus.off(UIEvents.HeroSkillsChanged, this.onHeroSkillsChanged, this);
    }

    update(): void {
        this.refreshSkillCooldownFills();
    }

    public openSkillSelect(): void {
        if (!this.opts) return;
        const world = this.opts.getWorld();
        const heroId = this.opts.getHeroEntityId();
        if (!world || heroId === null) return;
        const hero = world.getEntity(heroId);
        const skill = hero?.getComponent(SkillComponent);
        if (!hero || !skill) return;

        const maxSlots = Math.max(1, Math.floor(this.opts.skillPool.maxSkillSlots ?? this.opts.uiConfig.maxSlots ?? 6));
        if (skill.skillConfigIds.length >= maxSlots) return;

        const choices = this.rollSkillChoices(skill.skillConfigIds, 3);
        if (choices.length === 0) return;

        this.pendingChoices = choices;
        this.renderCards(choices);
        this.setCardSelectVisible(true);
        this.opts.setPaused(true);
    }

    private onHeroSkillsChanged(payload?: HeroSkillsChangedPayload): void {
        if (!this.opts) return;
        const heroId = this.opts.getHeroEntityId();
        if (payload && typeof payload.heroEntityId === 'number' && heroId !== null && payload.heroEntityId !== heroId) {
            return;
        }
        if (this.skillSlotNodes.length === 0 || !this.skillSlotNodes.some(n => !!n)) {
            this.collectSkillSlots();
        }
        this.refreshSkillSlots();
    }

    private ensureAtlasLoaded(): void {
        if (!this.opts) return;
        if (this.atlasLoaded || this.atlasLoading) return;
        this.atlasLoading = true;
        const dir = this.opts.uiConfig.atlas;
        resources.loadDir(dir, SpriteFrame, (err, spriteFrames) => {
            this.atlasLoading = false;
            if (err || !Array.isArray(spriteFrames)) {
                return;
            }
            for (const sf of spriteFrames) {
                if (!sf) continue;
                this.spriteFramesByName.set(sf.name, sf);
                if (sf.name.endsWith('.png')) {
                    this.spriteFramesByName.set(sf.name.slice(0, -4), sf);
                } else {
                    this.spriteFramesByName.set(`${sf.name}.png`, sf);
                }
            }
            this.atlasLoaded = true;
            this.refreshSkillSlots();
            if (this.pendingChoices.length > 0) this.renderCards(this.pendingChoices);
        });
    }

    private collectSkillSlots(): void {
        if (!this.opts || !this.uiRoot) return;
        const container =
            this.findChildByName(this.uiRoot, 'HeroSkillNode') ??
            this.findChildByName(this.uiRoot, 'SkillNode') ??
            this.uiRoot;

        const max = Math.max(1, Math.floor(this.opts.uiConfig.maxSlots ?? 6));
        this.skillSlotNodes = new Array(max).fill(null);
        this.skillSlotIconSprites = new Array(max).fill(null);
        this.skillSlotLevelSprites = new Array(max).fill(null);
        this.skillSlotCdSprites = new Array(max).fill(null);

        for (let i = 1; i <= max; i++) {
            const slot =
                container.getChildByName(`SkillNode${i}`) ??
                this.findChildByName(container, `SkillNode${i}`);
            if (!slot) continue;
            slot.active = false;
            this.skillSlotNodes[i - 1] = slot;
            const iconNode = slot.getChildByName('SkillIcon');
            const levelNode = slot.getChildByName('SkillLevel');
            const cdNode = slot.getChildByName('SkillCD');
            this.skillSlotIconSprites[i - 1] = iconNode ? iconNode.getComponent(Sprite) : null;
            this.skillSlotLevelSprites[i - 1] = levelNode ? levelNode.getComponent(Sprite) : null;
            const cdSprite = cdNode ? cdNode.getComponent(Sprite) : null;
            if (cdSprite) {
                cdSprite.fillRange = 0;
                cdSprite.node.active = false;
            }
            this.skillSlotCdSprites[i - 1] = cdSprite;
        }
    }


    private collectCardSelectUI(): void {
        if (!this.uiRoot) return;
        const cs = this.findChildByName(this.uiRoot, 'CardSelectNode');
        if (!cs) return;
        this.cardSelectNode = cs;
        this.splashNode = cs.getChildByName('SpriteSplash') ?? null;

        this.cardNodes = [];
        this.cardTitleLabels = [];
        this.cardIconSprites = [];
        this.cardDescRichTexts = [];

        for (let i = 1; i <= 3; i++) {
            const card = cs.getChildByName(`Card${i}`);
            if (!card) continue;
            this.cardNodes.push(card);

            const titleNode = card.getChildByName('TitleBG');
            const iconNode = card.getChildByName('Icon');
            const descNode = card.getChildByName('DescBG')?.getChildByName('Desc') ?? null;

            this.cardTitleLabels.push(titleNode ? this.findLabel(titleNode) : null);
            this.cardIconSprites.push(iconNode ? iconNode.getComponent(Sprite) : null);
            this.cardDescRichTexts.push(descNode ? descNode.getComponent(RichText) : null);

            const btn = card.getComponent(Button) ?? card.addComponent(Button);
            btn.transition = Button.Transition.NONE;
            card.on(Button.EventType.CLICK, () => this.onCardChosen(i - 1), this);
        }

        if (this.splashNode) {
            const btn = this.splashNode.getComponent(Button) ?? this.splashNode.addComponent(Button);
            btn.transition = Button.Transition.NONE;
            this.splashNode.on(Button.EventType.CLICK, () => this.closeCardSelect(false), this);
        }
    }

    private refreshSkillSlots(): void {
        if (!this.opts) return;
        const world = this.opts.getWorld();
        const heroId = this.opts.getHeroEntityId();
        if (!world || heroId === null) return;
        const hero = world.getEntity(heroId);
        const skill = hero?.getComponent(SkillComponent);
        const state = hero?.getComponent(SkillStateComponent);
        if (!hero || !skill) return;
        const sys = world.getSystem(SkillSystem);

        for (let i = 0; i < this.skillSlotNodes.length; i++) {
            const slotNode = this.skillSlotNodes[i];
            if (!slotNode) continue;
            const configId = skill.skillConfigIds[i] ?? '';
            const level = Math.max(0, Math.floor(skill.skillLevels[i] ?? 0));
            if (!configId) {
                slotNode.active = false;
                const cd = this.skillSlotCdSprites[i];
                if (cd) cd.node.active = false;
                continue;
            }
            slotNode.active = true;

            const entry = this.uiMap.get(configId) ?? null;
            const iconName = entry?.iconFrame ?? '';
            const iconSprite = this.skillSlotIconSprites[i];
            if (iconSprite) {
                const sf = this.getSpriteFrame(iconName);
                if (sf) iconSprite.spriteFrame = sf;
            }

            const lvlSprite = this.skillSlotLevelSprites[i];
            if (lvlSprite) {
                const name = this.buildLevelFrameName(level);
                const sf = this.getSpriteFrame(name);
                if (sf) lvlSprite.spriteFrame = sf;
            }

            const cdSprite = this.skillSlotCdSprites[i];
            if (cdSprite && state && sys) {
                const cooldown = sys.getCooldownSeconds(configId, level);
                const remaining = Math.max(0, Number(state.skillCooldownRemaining[i] ?? 0));
                const ratio = cooldown > 0 ? Math.max(0, Math.min(1, remaining / cooldown)) : 0;
                cdSprite.fillRange = ratio;
                cdSprite.node.active = ratio > 0.0001;
            } else if (cdSprite) {
                cdSprite.fillRange = 0;
                cdSprite.node.active = false;
            }
        }
    }

    private refreshSkillCooldownFills(): void {
        if (!this.opts) return;
        if (this.skillSlotNodes.length === 0) return;
        const world = this.opts.getWorld();
        const heroId = this.opts.getHeroEntityId();
        if (!world || heroId === null) return;
        const hero = world.getEntity(heroId);
        const skill = hero?.getComponent(SkillComponent);
        const state = hero?.getComponent(SkillStateComponent);
        if (!hero || !skill || !state) return;
        const sys = world.getSystem(SkillSystem);
        if (!sys) return;

        for (let i = 0; i < this.skillSlotNodes.length; i++) {
            const slotNode = this.skillSlotNodes[i];
            const cdSprite = this.skillSlotCdSprites[i];
            if (!slotNode || !cdSprite) continue;
            if (!slotNode.active) {
                cdSprite.node.active = false;
                continue;
            }
            const configId = skill.skillConfigIds[i] ?? '';
            if (!configId) {
                cdSprite.node.active = false;
                continue;
            }
            const level = Math.max(0, Math.floor(skill.skillLevels[i] ?? 0));
            const cooldown = sys.getCooldownSeconds(configId, level);
            const remaining = Math.max(0, Number(state.skillCooldownRemaining[i] ?? 0));
            const ratio = cooldown > 0 ? Math.max(0, Math.min(1, remaining / cooldown)) : 0;
            cdSprite.fillRange = ratio;
            cdSprite.node.active = ratio > 0.0001;
        }
    }

    private renderCards(skillIds: string[]): void {
        for (let i = 0; i < 3; i++) {
            const card = this.cardNodes[i];
            if (!card) continue;
            const id = skillIds[i] ?? '';
            if (!id) {
                card.active = false;
                continue;
            }
            card.active = true;

            const entry = this.uiMap.get(id) ?? null;
            const nameKey = entry?.nameKey ?? id;
            const shortDescKey = entry?.shortDescKey ?? entry?.descKey ?? id;
            const iconName = entry?.iconFrame ?? '';

            const title = this.cardTitleLabels[i];
            if (title) title.string = t(nameKey);

            const icon = this.cardIconSprites[i];
            if (icon) {
                const sf = this.getSpriteFrame(iconName);
                if (sf) icon.spriteFrame = sf;
            }

            const desc = this.cardDescRichTexts[i];
            if (desc) desc.string = t(shortDescKey);
        }
    }

    private onCardChosen(index: number): void {
        if (!this.opts) return;
        const chosen = this.pendingChoices[index] ?? '';
        if (!chosen) return;

        const world = this.opts.getWorld();
        const heroId = this.opts.getHeroEntityId();
        if (!world || heroId === null) return;
        const hero = world.getEntity(heroId);
        const skill = hero?.getComponent(SkillComponent);
        if (!hero || !skill) return;

        if (skill.skillConfigIds.indexOf(chosen) !== -1) {
            this.closeCardSelect(false);
            return;
        }

        skill.skillConfigIds.push(chosen);
        skill.skillLevels.push(1);
        skill.autoCastEnabled.push(true);
        UIEventBus.emit(UIEvents.HeroSkillsChanged, { heroEntityId: heroId } as HeroSkillsChangedPayload);
        this.closeCardSelect(true);
    }

    private closeCardSelect(resume: boolean): void {
        this.pendingChoices = [];
        this.setCardSelectVisible(false);
        if (resume && this.opts) {
            this.opts.setPaused(false);
        } else if (this.opts) {
            this.opts.setPaused(false);
        }
    }

    private setCardSelectVisible(visible: boolean): void {
        if (this.cardSelectNode) this.cardSelectNode.active = visible;
    }

    private buildLevelFrameName(level: number): string {
        const l = Math.max(0, Math.min(9, Math.floor(level)));
        const pattern = this.opts?.uiConfig.levelNumberFramePattern ?? 'pixel_number{level}.png';
        if (pattern.indexOf('{level}') !== -1) {
            return pattern.replace('{level}', String(l));
        }
        if (pattern.indexOf('%d') !== -1) {
            return pattern.replace('%d', String(l));
        }
        return pattern;
    }

    private getSpriteFrame(name: string): SpriteFrame | null {
        if (!name) return null;
        const key = name.endsWith('.png') ? name.slice(0, -4) : name;
        return this.spriteFramesByName.get(key) ?? null;
    }

    private rollSkillChoices(owned: string[], count: number): string[] {
        if (!this.opts) return [];
        const pool = (this.opts.skillPool.skills ?? []).map(s => s.id).filter(id => !!id);
        const available = pool.filter(id => owned.indexOf(id) === -1);
        const result: string[] = [];
        const max = Math.min(Math.max(0, Math.floor(count)), 10);
        for (let i = 0; i < max; i++) {
            if (available.length === 0) break;
            const pickIndex = Math.floor(Math.random() * available.length);
            const id = available.splice(pickIndex, 1)[0];
            if (id) result.push(id);
        }
        return result;
    }

    private findChildByName(root: Node, name: string): Node | null {
        if (root.name === name) return root;
        const stack: Node[] = [root];
        while (stack.length > 0) {
            const n = stack.pop()!;
            if (n.name === name) return n;
            for (const ch of n.children) stack.push(ch);
        }
        return null;
    }

    private findLabel(root: Node): Label | null {
        const direct = root.getComponent(Label);
        if (direct) return direct;
        const stack: Node[] = [root];
        while (stack.length > 0) {
            const n = stack.pop()!;
            const lab = n.getComponent(Label);
            if (lab) return lab;
            for (const ch of n.children) stack.push(ch);
        }
        return null;
    }
}
