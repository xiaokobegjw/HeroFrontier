export enum ShapeType {
    Circle,
    Triangle,
    Square,
    Line
}

export interface Point {
    x: number;
    y: number;
}

export interface ShapeData {
    type: ShapeType;
    color: string; // 例如 '#FF0000'
    lineWidth: number;
    fill: boolean;
    
    // 圆形属性
    radius?: number;
    
    // 三角形/线段属性
    points?: Point[]; // 三角形需3个点，线段需2个点
    
    // 正方形/矩形属性
    width?: number;
    height?: number;
}
