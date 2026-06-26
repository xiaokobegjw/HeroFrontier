import { ECSSystem } from '../Core/ECSSystem';
import { Entity } from '../Core/Entity';
import { ECSComponent } from '../Core/ECSComponent';
import { RenderComponent } from '../Components/RenderComponent';
import { TransformComponent } from '../Components/TransformComponent';
import { ShapeType } from '../../Data/ShapeData';
import { Color } from 'cc';

/**
 * 绘图接口抽象，适配底层 API (如 Cocos Graphics)
 */
export interface IGraphicsContext {
    clear(): void;
    circle(x: number, y: number, radius: number): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    rect(x: number, y: number, w: number, h: number): void;
    close(): void;
    stroke(): void;
    fill(): void;
    strokeColor: Color;
    fillColor: Color;
    lineWidth: number;
}

/**
 * 渲染系统：调用底层绘图 API 绘制形状
 */
export class RenderSystem extends ECSSystem {
    private ctx: IGraphicsContext | null = null;

    constructor(priority: number = 100) {
        super("RenderSystem", priority);
    }

    /**
     * 设置底层绘图上下文 (例如 Cocos 的 Graphics 组件)
     */
    public setContext(ctx: IGraphicsContext): void {
        this.ctx = ctx;
    }

    public clear(): void {
        this.ctx?.clear();
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [RenderComponent, TransformComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        if (!this.ctx) return;

        const ctx = this.ctx;
        ctx.clear();

        for (const entity of entities) {
            const render = entity.getComponent(RenderComponent);
            const transform = entity.getComponent(TransformComponent);
            if (!render || !transform) continue;

            for (const shape of render.shapes) {
                // 处理颜色：支持 HEX 字符串或 [R, G, B] 数组
                let color: Color;
                if (typeof shape.color === 'string') {
                    color = new Color().fromHEX(shape.color);
                } else if (Array.isArray(shape.color)) {
                    color = new Color(shape.color[0], shape.color[1], shape.color[2], shape.color[3] ?? 255);
                } else {
                    color = Color.WHITE;
                }
                
                ctx.strokeColor = color;
                ctx.fillColor = color;
                ctx.lineWidth = shape.lineWidth;

                // 最终位置 = 实体坐标 + 形状偏移
                const finalX = transform.x + render.offset.x;
                const finalY = transform.y + render.offset.y;

                switch (shape.type) {
                    case ShapeType.Circle:
                        if (shape.radius !== undefined) {
                            ctx.circle(finalX, finalY, shape.radius);
                        }
                        break;

                    case ShapeType.Triangle:
                        if (shape.points && shape.points.length >= 3) {
                            ctx.moveTo(shape.points[0].x + finalX, shape.points[0].y + finalY);
                            ctx.lineTo(shape.points[1].x + finalX, shape.points[1].y + finalY);
                            ctx.lineTo(shape.points[2].x + finalX, shape.points[2].y + finalY);
                            ctx.close();
                        }
                        break;

                    case ShapeType.Square:
                        if (shape.width !== undefined && shape.height !== undefined) {
                            const rad = (transform.rotation * Math.PI) / 180;
                            const cos = Math.cos(rad);
                            const sin = Math.sin(rad);
                            const hw = shape.width / 2;
                            const hh = shape.height / 2;

                            ctx.moveTo(finalX + cos * (-hw) - sin * (-hh), finalY + sin * (-hw) + cos * (-hh));
                            ctx.lineTo(finalX + cos * (hw) - sin * (-hh), finalY + sin * (hw) + cos * (-hh));
                            ctx.lineTo(finalX + cos * (hw) - sin * (hh), finalY + sin * (hw) + cos * (hh));
                            ctx.lineTo(finalX + cos * (-hw) - sin * (hh), finalY + sin * (-hw) + cos * (hh));
                            ctx.close();
                        }
                        break;

                    case ShapeType.Line:
                        if (shape.points && shape.points.length >= 2) {
                            ctx.moveTo(shape.points[0].x + finalX, shape.points[0].y + finalY);
                            ctx.lineTo(shape.points[1].x + finalX, shape.points[1].y + finalY);
                        }
                        break;
                }

                if (shape.fill) {
                    ctx.fill();
                } else {
                    ctx.stroke();
                }
            }

            const finalX = transform.x + render.offset.x;
            const finalY = transform.y + render.offset.y;
            const rad = (transform.rotation * Math.PI) / 180;
            const len = 24;
            ctx.strokeColor = new Color(255, 255, 0, 255);
            ctx.lineWidth = 2;
            ctx.moveTo(finalX, finalY);
            ctx.lineTo(finalX + Math.cos(rad) * len, finalY + Math.sin(rad) * len);
            ctx.stroke();
        }
    }
}
