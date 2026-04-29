import { Breed } from '../Data/Breed';

const breedsMap: Map<number, Breed> = new Map();

export class BreedManager {
    static register(id: number, breed: Breed): void {
        breedsMap.set(id, breed);
    }

    static get(id: number): Breed | undefined {
        return breedsMap.get(id);
    }

    static clear(): void {
        breedsMap.clear();
    }
}