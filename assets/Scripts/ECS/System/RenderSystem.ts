import { ECSSystem } from '../../../ECS/Core/ECSSystem';
import { Entity } from '../../../ECS/Core/Entity';
import { ECSComponent } from '../../../ECS/Core/ECSComponent';
import { RenderComponent } from '../../../ECS/Components/RenderComponent';
import { TransformComponent } from '../../../ECS/Components/TransformComponent';
import { ShapeType } from '../../../ECS/Data/ShapeData';
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
                // 使用 Cocos 的 Color.fromHEX 处理颜色字符串
                const color = new Color().fromHEX(shape.color);
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
                            ctx.rect(finalX - shape.width / 2, finalY - shape.height / 2, shape.width, shape.height);
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
        }
    }
}
