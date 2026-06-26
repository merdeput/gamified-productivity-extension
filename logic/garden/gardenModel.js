import { Plant } from './plant.js';
import { DEFAULT_GARDEN_ID, gardenDefinitionRegistry } from './gardenDefinitions.js';

export { DEFAULT_GARDEN_ID };

export class Garden {
  constructor(data = {}) {
    this.id = data.id || DEFAULT_GARDEN_ID;
    this.definition = gardenDefinitionRegistry.get(this.id);
    this.name = data.name || this.definition?.name || 'Garden';
    this.layoutId = data.layoutId || this.id;
    this.mapFile = data.mapFile || this.definition?.mapFile || 'growingMap.tmj';
    this.plantLayers = data.plantLayers || this.definition?.plantLayers || ['Plantable'];
    this.theme = data.theme || this.definition?.theme || 'default';
    this.unlocked = data.unlocked ?? this.definition?.defaultUnlocked ?? true;
    this.unlocks = data.unlocks || {};
    this.upgrades = data.upgrades || {};
    this.coins = Math.max(0, Number(data.coins || 0));
    this.plants = Array.isArray(data.plants)
      ? data.plants.map(plant => plant instanceof Plant ? plant : new Plant(plant)).filter(plant => Plant.isValid(plant.serialize()))
      : [];
  }

  static fromState(data = {}, fallback = {}) {
    return new Garden({
      ...fallback,
      ...data,
      plants: Array.isArray(data.plants) ? data.plants : fallback.plants,
      coins: data.coins ?? fallback.coins
    });
  }

  canPlantAt(tileX, tileY) {
    return !this.hasPlantAt(tileX, tileY);
  }

  canPlantDefinitionAt(definition, tile) {
    if (!definition || !tile || !this.canPlantAt(tile.tileX, tile.tileY)) {
      return false;
    }

    return definition.plantableLayers.includes(tile.layerName);
  }

  hasPlantAt(tileX, tileY) {
    return this.plants.some(plant => plant.isAt(tileX, tileY));
  }

  getPlantsAtTile(tileX, tileY) {
    return this.plants.filter(plant => plant.isAt(tileX, tileY));
  }

  addPlant(plant) {
    const normalizedPlant = plant instanceof Plant ? plant : new Plant(plant);

    if (!Plant.isValid(normalizedPlant.serialize())) {
      throw new Error('Invalid plant data');
    }

    if (this.hasPlantAt(normalizedPlant.tileX, normalizedPlant.tileY)) {
      throw new Error('Tile already has a plant');
    }

    this.plants = [...this.plants, normalizedPlant];
    return normalizedPlant;
  }

  removePlant(plantId) {
    this.plants = this.plants.filter(plant => plant.id !== plantId);
  }

  updatePlant(plantId, updates) {
    this.plants = this.plants.map(plant => {
      if (plant.id !== plantId) return plant;
      const updatedPlant = new Plant({
        ...plant.serialize(),
        ...updates,
        id: plant.id
      });

      if (!Plant.isValid(updatedPlant.serialize())) {
        throw new Error(`Invalid plant update for ${plantId}`);
      }

      return updatedPlant;
    });
  }

  updateCoins(amount) {
    this.coins = Math.max(0, this.coins + Number(amount || 0));
    return this.coins;
  }

  spendCoins(amount) {
    const cost = Math.max(0, Number(amount || 0));
    if (this.coins < cost) {
      return false;
    }

    this.coins -= cost;
    return true;
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      layoutId: this.layoutId,
      mapFile: this.mapFile,
      plantLayers: this.plantLayers,
      theme: this.theme,
      unlocked: this.unlocked,
      unlocks: this.unlocks,
      upgrades: this.upgrades,
      plants: this.plants.map(plant => plant.serialize()),
      coins: this.coins
    };
  }
}

export default Garden;
