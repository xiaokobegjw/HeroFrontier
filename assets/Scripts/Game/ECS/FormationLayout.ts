import { BaseProductionComponent } from './Components/BaseProductionComponent';

export type SlotPosition = { x: number; y: number };

/** 驻守网格：formationIndex 从 0 起按列优先排布 */
export function garrisonSlotPosition(
    baseX: number,
    baseY: number,
    prod: BaseProductionComponent,
    formationIndex: number
): SlotPosition {
    const rows = Math.max(1, Math.floor(prod.garrisonRows));
    const col = Math.floor(formationIndex / rows);
    const row = formationIndex % rows;
    const centerRow = (rows - 1) * 0.5;
    return {
        x: baseX - prod.garrisonOffsetX - col * prod.garrisonColSpacing,
        y: baseY + (row - centerRow) * prod.garrisonRowSpacing
    };
}

/** 随从环绕英雄 */
export function followerSlotPosition(
    heroX: number,
    heroY: number,
    prod: BaseProductionComponent,
    formationIndex: number,
    total: number
): SlotPosition {
    const r = Math.max(12, prod.followerRadius);
    const n = Math.max(1, total);
    const a = (formationIndex / n) * Math.PI * 2;
    return {
        x: heroX + Math.cos(a) * r,
        y: heroY + Math.sin(a) * r
    };
}
