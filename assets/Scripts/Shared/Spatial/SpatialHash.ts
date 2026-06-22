export type SpatialHashRect = { x: number; y: number; width: number; height: number };

export interface SpatialHashItem {
    id: number;
    bounds: SpatialHashRect;
}

export class SpatialHash<T extends SpatialHashItem> {
    private readonly cellSize: number;
    private readonly grid: Map<string, T[]> = new Map();

    constructor(cellSize: number = 64) {
        this.cellSize = cellSize;
    }

    public clear(): void {
        this.grid.clear();
    }

    public insert(item: T): void {
        const cells = this.getCellsForRect(item.bounds);
        for (const cellKey of cells) {
            let list = this.grid.get(cellKey);
            if (!list) {
                list = [];
                this.grid.set(cellKey, list);
            }
            list.push(item);
        }
    }

    public query(rect: SpatialHashRect): T[] {
        const cells = this.getCellsForRect(rect);
        const results: T[] = [];
        const seen = new Set<number>();

        for (const cellKey of cells) {
            const list = this.grid.get(cellKey);
            if (!list) continue;

            for (const item of list) {
                if (seen.has(item.id)) continue;
                seen.add(item.id);

                if (this.intersectsRect(item.bounds, rect)) {
                    results.push(item);
                }
            }
        }

        return results;
    }

    private getCellsForRect(rect: SpatialHashRect): string[] {
        const minCellX = Math.floor(rect.x / this.cellSize);
        const minCellY = Math.floor(rect.y / this.cellSize);
        const maxCellX = Math.floor((rect.x + rect.width) / this.cellSize);
        const maxCellY = Math.floor((rect.y + rect.height) / this.cellSize);

        const cells: string[] = [];
        for (let x = minCellX; x <= maxCellX; x++) {
            for (let y = minCellY; y <= maxCellY; y++) {
                cells.push(`${x},${y}`);
            }
        }
        return cells;
    }

    private intersectsRect(a: SpatialHashRect, b: SpatialHashRect): boolean {
        return !(
            b.x > a.x + a.width ||
            b.x + b.width < a.x ||
            b.y > a.y + a.height ||
            b.y + b.height < a.y
        );
    }
}