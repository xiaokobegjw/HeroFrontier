import { EventKeyboard, Input, KeyCode, input } from 'cc';

export type MoveDirection = {
    x: number;
    y: number;
};

export class PlayerMoveInputAdapter {
    private up = false;
    private down = false;
    private left = false;
    private right = false;

    public enable(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    public disable(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        this.reset();
    }

    public getDirection(): MoveDirection {
        let x = 0;
        let y = 0;

        if (this.left && !this.right) x = -1;
        else if (this.right && !this.left) x = 1;

        if (this.up && !this.down) y = 1;
        else if (this.down && !this.up) y = -1;

        if (x === 0 && y === 0) return { x: 0, y: 0 };

        const len = Math.sqrt(x * x + y * y);
        return { x: x / len, y: y / len };
    }

    public hasInput(): boolean {
        const dir = this.getDirection();
        return Math.abs(dir.x) > 0 || Math.abs(dir.y) > 0;
    }

    public reset(): void {
        this.up = false;
        this.down = false;
        this.left = false;
        this.right = false;
    }

    private onKeyDown(e: EventKeyboard): void {
        switch (e.keyCode) {
            case KeyCode.KEY_W:
                this.up = true;
                break;
            case KeyCode.KEY_S:
                this.down = true;
                break;
            case KeyCode.KEY_A:
                this.left = true;
                break;
            case KeyCode.KEY_D:
                this.right = true;
                break;
        }
    }

    private onKeyUp(e: EventKeyboard): void {
        switch (e.keyCode) {
            case KeyCode.KEY_W:
                this.up = false;
                break;
            case KeyCode.KEY_S:
                this.down = false;
                break;
            case KeyCode.KEY_A:
                this.left = false;
                break;
            case KeyCode.KEY_D:
                this.right = false;
                break;
        }
    }
}

