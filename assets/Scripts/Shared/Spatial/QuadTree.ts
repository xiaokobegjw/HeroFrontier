export type QuadTreePoint = { x: number; y: number };
export type QuadTreeRect = { x: number; y: number; width: number; height: number };

export interface QuadTreeItem {
    bounds: QuadTreeRect;
}

export type QuadTreeOptions = {
    capacity?: number;
    maxDepth?: number;
};

export class QuadTree<T extends QuadTreeItem> {
    private readonly boundary: QuadTreeRect;
    private readonly capacity: number;
    private readonly maxDepth: number;
    private readonly depth: number;

    private items: T[] = [];
    private divided = false;
    private northeast: QuadTree<T> | null = null;
    private northwest: QuadTree<T> | null = null;
    private southeast: QuadTree<T> | null = null;
    private southwest: QuadTree<T> | null = null;

    constructor(boundary: QuadTreeRect, options: QuadTreeOptions = {}, depth: number = 0) {
        this.boundary = boundary;
        this.capacity = options.capacity ?? 8;
        this.maxDepth = options.maxDepth ?? 8;
        this.depth = depth;
    }

    public clear(): void {
        this.items = [];
        this.divided = false;
        this.northeast = null;
        this.northwest = null;
        this.southeast = null;
        this.southwest = null;
    }

    public insert(item: T): boolean {
        if (!this.intersectsRect(this.boundary, item.bounds)) return false;

        if (!this.divided && (this.items.length < this.capacity || this.depth >= this.maxDepth)) {
            this.items.push(item);
            return true;
        }

        if (!this.divided) {
            this.subdivide();
            const prev = this.items;
            this.items = [];
            for (const oldItem of prev) {
                this.insertIntoChildren(oldItem);
            }
        }

        return this.insertIntoChildren(item);
    }

    public query(range: QuadTreeRect, found: T[] = []): T[] {
        if (!this.intersectsRect(this.boundary, range)) return found;

        for (const item of this.items) {
            if (this.intersectsRect(item.bounds, range)) {
                found.push(item);
            }
        }

        if (this.divided) {
            this.northeast!.query(range, found);
            this.northwest!.query(range, found);
            this.southeast!.query(range, found);
            this.southwest!.query(range, found);
        }

        return found;
    }

    public getAllItems(out: T[] = []): T[] {
        out.push(...this.items);
        if (this.divided) {
            this.northeast!.getAllItems(out);
            this.northwest!.getAllItems(out);
            this.southeast!.getAllItems(out);
            this.southwest!.getAllItems(out);
        }
        return out;
    }

    public debugTraverse(visitor: (boundary: QuadTreeRect, depth: number, itemCount: number, divided: boolean) => void, includeEmpty: boolean = true): void {
        if (!includeEmpty && this.items.length === 0 && !this.divided) return;
        visitor(this.boundary, this.depth, this.items.length, this.divided);
        if (this.divided) {
            this.northeast!.debugTraverse(visitor, includeEmpty);
            this.northwest!.debugTraverse(visitor, includeEmpty);
            this.southeast!.debugTraverse(visitor, includeEmpty);
            this.southwest!.debugTraverse(visitor, includeEmpty);
        }
    }

    private insertIntoChildren(item: T): boolean {
        if (!this.divided) return false;
        return (
            this.northeast!.insert(item) ||
            this.northwest!.insert(item) ||
            this.southeast!.insert(item) ||
            this.southwest!.insert(item)
        );
    }

    private subdivide(): void {
        const x = this.boundary.x;
        const y = this.boundary.y;
        const w = this.boundary.width / 2;
        const h = this.boundary.height / 2;

        const opts: QuadTreeOptions = { capacity: this.capacity, maxDepth: this.maxDepth };
        const nextDepth = this.depth + 1;

        this.northeast = new QuadTree<T>({ x: x + w, y: y + h, width: w, height: h }, opts, nextDepth);
        this.northwest = new QuadTree<T>({ x, y: y + h, width: w, height: h }, opts, nextDepth);
        this.southeast = new QuadTree<T>({ x: x + w, y, width: w, height: h }, opts, nextDepth);
        this.southwest = new QuadTree<T>({ x, y, width: w, height: h }, opts, nextDepth);
        this.divided = true;
    }

    private intersectsRect(a: QuadTreeRect, b: QuadTreeRect): boolean {
        return !(
            b.x > a.x + a.width ||
            b.x + b.width < a.x ||
            b.y > a.y + a.height ||
            b.y + b.height < a.y
        );
    }
}
