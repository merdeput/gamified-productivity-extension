/**
 * Static plant definitions.
 *
 * Each plant type defines its growth stages once. Game logic and rendering both
 * read from these definitions through the growth resolver.
 */

const DEFAULT_FRAME_SIZE = 16;

export class PlantDefinition {
  constructor(config) {
    this.id = config.id;
    this.type = config.id;
    this.displayName = config.displayName;
    this.price = config.price;
    this.description = config.description || '';
    this.defaultGrowDurationMinutes = config.defaultGrowDurationMinutes || 90;
    this.rarity = config.rarity || 'common';
    this.unlock = config.unlock || null;
    this.sprite = {
      filename: config.sprite.filename,
      frameWidth: config.sprite.frameWidth || DEFAULT_FRAME_SIZE,
      frameHeight: config.sprite.frameHeight || DEFAULT_FRAME_SIZE
    };
    this.stages = config.stages.map((stage, index) => ({
      id: stage.id || `stage_${index}`,
      name: stage.name || `Stage ${index}`,
      frameIndex: Number.isInteger(stage.frameIndex) ? stage.frameIndex : index,
      durationWeight: Number(stage.durationWeight || 1),
      isMature: Boolean(stage.isMature)
    }));
  }

  get stageCount() {
    return this.stages.length;
  }

  getStage(index) {
    const normalizedIndex = Math.min(Math.max(0, Number(index) || 0), this.stageCount - 1);
    return this.stages[normalizedIndex];
  }

  getMatureStage() {
    return this.stages.find(stage => stage.isMature) || this.stages[this.stageCount - 1];
  }

  getShopItem() {
    return {
      type: this.id,
      id: this.id,
      name: this.displayName,
      displayName: this.displayName,
      price: this.price,
      description: this.description,
      filename: this.sprite.filename,
      stages: this.stageCount,
      defaultGrowDurationMinutes: this.defaultGrowDurationMinutes,
      rarity: this.rarity,
      unlock: this.unlock,
      definition: this
    };
  }
}

export class PlantDefinitionRegistry {
  constructor(definitions = []) {
    this.definitions = new Map();
    definitions.forEach(definition => this.register(definition));
  }

  register(definition) {
    const normalized = definition instanceof PlantDefinition
      ? definition
      : new PlantDefinition(definition);

    this.definitions.set(normalized.id, normalized);
    return normalized;
  }

  get(type) {
    return this.definitions.get(type) || null;
  }

  require(type) {
    const definition = this.get(type);
    if (!definition) {
      throw new Error(`Unknown plant type: ${type}`);
    }
    return definition;
  }

  has(type) {
    return this.definitions.has(type);
  }

  list() {
    return [...this.definitions.values()];
  }

  shopItems() {
    return this.list().map(definition => definition.getShopItem());
  }
}

export const PLANT_DEFINITION_CONFIGS = [
  {
    id: 'rose',
    displayName: 'Rose',
    price: 50,
    description: 'A classic beauty',
    sprite: { filename: 'Rose-Red-grow.png' },
    stages: [
      { id: 'seed', name: 'Seed' },
      { id: 'sprout', name: 'Sprout' },
      { id: 'young', name: 'Young Plant' },
      { id: 'blooming', name: 'Blooming', isMature: true }
    ]
  },
  {
    id: 'dandelion',
    displayName: 'Dandelion',
    price: 40,
    description: 'Cheerful yellow flower',
    sprite: { filename: 'Dandelion-Grow.png' },
    stages: [
      { id: 'seed', name: 'Seed' },
      { id: 'sprout', name: 'Sprout' },
      { id: 'young', name: 'Young Plant' },
      { id: 'mature', name: 'Mature Plant' },
      { id: 'flowering', name: 'Flowering', isMature: true }
    ]
  },
  {
    id: 'sunflower',
    displayName: 'Sunflower',
    price: 40,
    description: 'Bright and bold',
    sprite: { filename: 'Sunflower-grow.png' },
    stages: [
      { id: 'seed', name: 'Seed' },
      { id: 'sprout', name: 'Sprout' },
      { id: 'young', name: 'Young Plant' },
      { id: 'blooming', name: 'Blooming', isMature: true }
    ]
  },
  {
    id: 'tulip',
    displayName: 'Tulip',
    price: 45,
    description: 'Elegant and graceful',
    sprite: { filename: 'Tulip-White-grow.png' },
    stages: [
      { id: 'seed', name: 'Seed' },
      { id: 'sprout', name: 'Sprout' },
      { id: 'young', name: 'Young Plant' },
      { id: 'mature', name: 'Mature Plant' },
      { id: 'blooming', name: 'Blooming', isMature: true }
    ]
  }
];

export const plantRegistry = new PlantDefinitionRegistry(PLANT_DEFINITION_CONFIGS);
export const FLOWER_DEFINITIONS = plantRegistry.shopItems();

export default plantRegistry;
