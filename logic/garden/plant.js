import { makeId } from '../utils.js';
import { plantRegistry } from './plantDefinitions.js';
import { growthResolver } from './growthResolver.js';

export class Plant {
  constructor(data, registry = plantRegistry, resolver = growthResolver) {
    this.registry = registry;
    this.resolver = resolver;
    this.id = data.id || makeId('plant');
    this.type = data.type;
    this.tileX = Number(data.tileX);
    this.tileY = Number(data.tileY);
    this.plantedAtFocusMinutes = Number(data.plantedAtFocusMinutes || 0);

    const definition = this.registry.get(this.type);
    this.growDurationMinutes = Number(
      data.growDurationMinutes || definition?.defaultGrowDurationMinutes || 90
    );
    this.state = data.state || 'growing';
    this.metadata = data.metadata || {};
  }

  static create(type, tileX, tileY, totalFocusMinutes = 0, options = {}) {
    const definition = plantRegistry.require(type);

    return new Plant({
      id: options.id,
      type,
      tileX,
      tileY,
      plantedAtFocusMinutes: totalFocusMinutes,
      growDurationMinutes: options.growDurationMinutes || definition.defaultGrowDurationMinutes,
      state: options.state,
      metadata: options.metadata
    });
  }

  static isValid(data, registry = plantRegistry) {
    return (
      data &&
      typeof data.id === 'string' &&
      typeof data.type === 'string' &&
      registry.has(data.type) &&
      typeof data.tileX === 'number' &&
      typeof data.tileY === 'number' &&
      typeof data.plantedAtFocusMinutes === 'number' &&
      typeof data.growDurationMinutes === 'number' &&
      data.id.length > 0 &&
      data.tileX >= 0 &&
      data.tileY >= 0 &&
      data.growDurationMinutes > 0
    );
  }

  get definition() {
    return this.registry.require(this.type);
  }

  getStageIndex(totalFocusMinutes = 0) {
    return this.resolver.getStageIndex(this, totalFocusMinutes);
  }

  getGrowthInfo(totalFocusMinutes = 0) {
    return this.resolver.getGrowthInfo(this, totalFocusMinutes);
  }

  getSprite(totalFocusMinutes = 0) {
    return this.resolver.getSpriteForPlant(this, totalFocusMinutes);
  }

  isAt(tileX, tileY) {
    return this.tileX === tileX && this.tileY === tileY;
  }

  serialize() {
    return {
      id: this.id,
      type: this.type,
      tileX: this.tileX,
      tileY: this.tileY,
      plantedAtFocusMinutes: this.plantedAtFocusMinutes,
      growDurationMinutes: this.growDurationMinutes,
      state: this.state,
      metadata: this.metadata
    };
  }
}

export default Plant;
