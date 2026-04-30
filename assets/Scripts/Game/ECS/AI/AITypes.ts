export type Vec2 = { x: number; y: number };

export type ActionRequest =
    | { type: 'None' }
    | { type: 'Stop' }
    | { type: 'MoveTo'; x: number; y: number };

export type GoalContext = {
    selfId: number;
    selfPos: Vec2;
    targetId: number | null;
    targetPos: Vec2 | null;
    weaponRange: number;
};

