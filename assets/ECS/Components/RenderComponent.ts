import { ECSComponent } from '../Core/ECSComponent';
import { ShapeData } from '../Data/ShapeData';

/**
 * 绘图组件：存储需要绘制的形状数据
 */
export class RenderComponent extends ECSComponent {
    /** 形状列表 */
    public shapes: ShapeData[] = [];
    
    /** 渲染偏移量 */
    public offset: { x: number, y: number } = { x: 0, y: 0 };

    constructor() {
        super();
    }

    /**
     * 添加圆形
     */
    public addCircle(radius: number, color: string = '#FFFFFF', fill: boolean = true): void {
        this.shapes.push({
            type: 0, // ShapeType.Circle
            radius,
            color,
            fill,
            lineWidth: 1
        });
    }

    /**
     * 添加三角形
     */
    public addTriangle(p1: {x: number, y: number}, p2: {x: number, y: number}, p3: {x: number, y: number}, color: string = '#FFFFFF', fill: boolean = true): void {
        this.shapes.push({
            type: 1, // ShapeType.Triangle
            points: [p1, p2, p3],
            color,
            fill,
            lineWidth: 1
        });
    }

    /**
     * 添加正方形
     */
    public addSquare(size: number, color: string = '#FFFFFF', fill: boolean = true): void {
        this.shapes.push({
            type: 2, // ShapeType.Square
            width: size,
            height: size,
            color,
            fill,
            lineWidth: 1
        });
    }

    /**
     * 添加线段
     */
    public addLine(start: {x: number, y: number}, end: {x: number, y: number}, lineWidth: number = 1, color: string = '#FFFFFF'): void {
        this.shapes.push({
            type: 3, // ShapeType.Line
            points: [start, end],
            color,
            lineWidth,
            fill: false
        });
    }

    public reset(): void {
        super.reset();
        this.shapes = [];
        this.offset = { x: 0, y: 0 };
    }
}
