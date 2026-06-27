export const DEFAULT_GARDEN_ID = 'growing';

export class GardenDefinition {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description || '';
    this.mapFile = config.mapFile;
    this.plantLayers = config.plantLayers || ['Plantable'];
    this.price = Number(config.price || 0);
    this.defaultUnlocked = config.defaultUnlocked !== false;
    this.theme = config.theme || 'default';
  }

  supportsLayer(layerName) {
    return this.plantLayers.includes(layerName);
  }
}

export class GardenDefinitionRegistry {
  constructor(definitions = []) {
    this.definitions = new Map();
    definitions.forEach(definition => this.register(definition));
  }

  register(definition) {
    const normalized = definition instanceof GardenDefinition
      ? definition
      : new GardenDefinition(definition);
    this.definitions.set(normalized.id, normalized);
    return normalized;
  }

  get(gardenId) {
    return this.definitions.get(gardenId) || null;
  }

  require(gardenId) {
    const definition = this.get(gardenId);
    if (!definition) {
      throw new Error(`Unknown garden: ${gardenId}`);
    }
    return definition;
  }

  list() {
    return [...this.definitions.values()];
  }
}

export const GARDEN_DEFINITION_CONFIGS = [
  {
    id: 'growing',
    name: 'Growing Garden',
    description: 'A sunny plot for soil flowers.',
    mapFile: 'growingMap.tmj',
    plantLayers: ['Plantable'],
    price: 0,
    defaultUnlocked: true,
    theme: 'growing'
  },
  {
    id: 'water',
    name: 'Water Garden',
    description: 'A river garden with soil banks and aquatic tiles.',
    mapFile: 'watermap.tmj',
    plantLayers: ['Plantable', 'Aquatic'],
    price: 150,
    defaultUnlocked: false,
    theme: 'water'
  }
];

export const gardenDefinitionRegistry = new GardenDefinitionRegistry(GARDEN_DEFINITION_CONFIGS);

export default gardenDefinitionRegistry;
