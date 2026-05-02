import { ICommand } from './ICommand';

export class CommandBus {
    private queue: ICommand[] = [];

    public enqueue(cmd: ICommand): void {
        this.queue.push(cmd);
    }

    public flush(): void {
        if (this.queue.length === 0) return;
        const cmds = this.queue;
        this.queue = [];
        for (const cmd of cmds) cmd.execute();
    }

    public clear(): void {
        this.queue = [];
    }
}

