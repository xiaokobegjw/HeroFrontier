import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export type MemoryRecord = {
    entityId: number;
    lastSeenX: number;
    lastSeenY: number;
    lastSeenTime: number;
};

export class MemoryComponent extends ECSComponent {
    public memorySeconds: number = 3;
    public maxTargets: number = 5;
    public records: MemoryRecord[] = [];

    reset(): void {
        super.reset();
        this.memorySeconds = 3;
        this.maxTargets = 5;
        this.records = [];
    }
}

