import { CAT_DEFINITION, INSECT_DEFINITIONS } from './animalDefinitions.js';
import { Cat } from './cat.js';
import { Frog } from './frog.js';
import { Insect } from './insect.js';

const ANIMAL_REGISTRY = {
  frog: (baseUrl) => new Frog(baseUrl),
  [CAT_DEFINITION.id]: (baseUrl) => new Cat(baseUrl)
};

export class GardenAnimals {
  constructor(container, mapDims = {}, baseUrl = '') {
    this.container = container;
    this.baseUrl = baseUrl;
    this.animals = [];
    this._rafId = null;
    this._lastTime = null;
    this.mapDims = mapDims;
    this.moveableTiles = Array.isArray(mapDims.moveableTiles) ? mapDims.moveableTiles : [];

    const tw = mapDims.tileWidth || 32;
    const th = mapDims.tileHeight || 32;
    const mapPixelWidth = (mapDims.width || 0) * tw;
    const mapPixelHeight = (mapDims.height || 0) * th;

    this.bounds = {
      minX: 0,
      maxX: Math.max(0, mapPixelWidth - 32),
      minY: th,
      maxY: Math.max(th, mapPixelHeight - th - 32),
      randomPosition: (width = 32, height = 32) => this._randomWalkablePosition(width, height),
      isPositionWalkable: (x, y, width = 32, height = 32) => this._isPositionWalkable(x, y, width, height)
    };
  }

  spawnFrog() {
    return this.spawnAnimal('frog');
  }

  spawnAnimal(type, options = {}) {
    const factory = ANIMAL_REGISTRY[type];
    if (!factory) {
      console.warn(`[GardenAnimals] Unknown animal type: "${type}"`);
      return null;
    }

    const animal = factory(this.baseUrl);
    const spawn = options.position || this.bounds.randomPosition(animal.frameWidth, animal.frameHeight);

    animal.mount(this.container, spawn.x, spawn.y);
    this.animals.push(animal);
    if (!this._rafId) this._startLoop();

    return animal;
  }

  spawnGardenAnimals(gardenState) {
    this.spawnFrog();

    const purchasedAnimals = Array.isArray(gardenState?.animals) ? gardenState.animals : [];
    purchasedAnimals.forEach(type => this.spawnAnimal(type));

    this.spawnInsectsForGarden(gardenState);
  }

  spawnInsectsForGarden(gardenState) {
    const plants = Array.isArray(gardenState?.plants) ? gardenState.plants : [];
    if (plants.length === 0) return;

    const species = new Set(plants.map(plant => plant.type).filter(Boolean));

    INSECT_DEFINITIONS.forEach(definition => {
      const matchingPlants = plants.filter(plant => {
        const matchesType = definition.plantTypes?.includes(plant.type);
        const matchesLayer = definition.plantLayers?.includes(plant.layer);
        return matchesType || matchesLayer;
      });

      if (matchingPlants.length === 0) return;

      const matchingSpecies = new Set(matchingPlants.map(plant => plant.type).filter(Boolean));
      const chance = Math.min(
        0.88,
        (definition.baseChance || 0) +
        matchingPlants.length * (definition.perPlantChance || 0) +
        species.size * (definition.perSpeciesChance || 0) +
        matchingSpecies.size * 0.04
      );

      if (Math.random() > chance) return;

      const count = 1 + (matchingPlants.length >= 8 && Math.random() < 0.35 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        this.spawnInsect(definition);
      }
    });
  }

  spawnInsect(definition) {
    const insect = new Insect(this.baseUrl, definition);
    const spawn = this.bounds.randomPosition(insect.frameWidth, insect.frameHeight);

    insect.mount(this.container, spawn.x, spawn.y);
    this.animals.push(insect);
    if (!this._rafId) this._startLoop();

    return insect;
  }

  destroy() {
    this._stopLoop();
    this.animals.forEach(animal => animal.unmount());
    this.animals = [];
  }

  _startLoop() {
    const tick = (timestamp) => {
      if (this._lastTime === null) this._lastTime = timestamp;
      const dt = Math.min(timestamp - this._lastTime, 100);
      this._lastTime = timestamp;

      for (const animal of this.animals) {
        animal.update(dt, this.bounds);
      }

      this._rafId = requestAnimationFrame(tick);
    };

    this._rafId = requestAnimationFrame(tick);
  }

  _stopLoop() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
      this._lastTime = null;
    }
  }

  _randomWalkablePosition(width = 32, height = 32) {
    if (this.moveableTiles.length > 0) {
      const tile = this.moveableTiles[Math.floor(Math.random() * this.moveableTiles.length)];
      const tw = this.mapDims.tileWidth || 32;
      const th = this.mapDims.tileHeight || 32;
      return {
        x: tile.tileX * tw + (tw - width) / 2,
        y: tile.tileY * th + (th - height) / 2
      };
    }

    return {
      x: this.bounds.minX + Math.random() * Math.max(0, this.bounds.maxX - this.bounds.minX),
      y: this.bounds.minY + Math.random() * Math.max(0, this.bounds.maxY - this.bounds.minY)
    };
  }

  _isPositionWalkable(x, y, width = 32, height = 32) {
    if (this.moveableTiles.length === 0) {
      return x >= this.bounds.minX && x <= this.bounds.maxX && y >= this.bounds.minY && y <= this.bounds.maxY;
    }

    const tw = this.mapDims.tileWidth || 32;
    const th = this.mapDims.tileHeight || 32;
    const centerX = Math.floor((x + width / 2) / tw);
    const centerY = Math.floor((y + height / 2) / th);
    return this.moveableTiles.some(tile => tile.tileX === centerX && tile.tileY === centerY);
  }
}

export default GardenAnimals;
