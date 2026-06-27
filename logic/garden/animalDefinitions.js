export const CAT_DEFINITION = {
  id: 'orange_cat',
  type: 'orange_cat',
  displayName: 'Orange Cat',
  price: 120,
  description: 'A calm orange garden cat.',
  folder: 'orange_cat',
  frameWidth: 32,
  frameHeight: 32,
  states: { idle: 7, walk: 7 },
  fileNames: {
    idle: 'orange_cat_idle.png',
    walk: 'orange_cat_walk.png'
  }
};

export const INSECT_DEFINITIONS = [
  {
    id: 'bee1',
    displayName: 'Honey Bee',
    fileName: 'bee1.png',
    plantLayers: ['Plantable'],
    plantTypes: ['rose', 'sunflower', 'tulip', 'dandelion'],
    baseChance: 0.08,
    perPlantChance: 0.05,
    perSpeciesChance: 0.06
  },
  {
    id: 'bee2',
    displayName: 'Garden Bee',
    fileName: 'bee2.png',
    plantLayers: ['Plantable'],
    plantTypes: ['rose', 'sunflower', 'tulip'],
    baseChance: 0.06,
    perPlantChance: 0.045,
    perSpeciesChance: 0.07
  },
  {
    id: 'bee3',
    displayName: 'Tiny Bee',
    fileName: 'bee3.png',
    plantLayers: ['Plantable'],
    plantTypes: ['dandelion', 'sunflower'],
    baseChance: 0.05,
    perPlantChance: 0.05,
    perSpeciesChance: 0.05
  },
  {
    id: 'blue_butterfly',
    displayName: 'Blue Butterfly',
    fileName: 'blue-butterfly.png',
    frameHeight: 15,
    plantLayers: ['Plantable'],
    plantTypes: ['tulip', 'rose', 'hyacinth', 'flower_lily'],
    baseChance: 0.04,
    perPlantChance: 0.035,
    perSpeciesChance: 0.09
  },
  {
    id: 'pink_butterfly',
    displayName: 'Pink Butterfly',
    fileName: 'pink-butterfly.png',
    plantLayers: ['Plantable', 'Aquatic'],
    plantTypes: ['rose', 'tulip', 'flower_lily', 'hyacinth'],
    baseChance: 0.04,
    perPlantChance: 0.035,
    perSpeciesChance: 0.09
  },
  {
    id: 'blue_dragon_fly',
    displayName: 'Blue Dragonfly',
    fileName: 'blue-dragon-fly.png',
    plantLayers: ['Aquatic'],
    plantTypes: ['lily_pad', 'flower_lily', 'hyacinth', 'big_duckweed', 'small_duckweed'],
    baseChance: 0.02,
    perPlantChance: 0.04,
    perSpeciesChance: 0.08
  },
  {
    id: 'green_dragon_fly',
    displayName: 'Green Dragonfly',
    fileName: 'green-dragon-fly.png',
    plantLayers: ['Aquatic'],
    plantTypes: ['single_cattail', 'double_cattail', 'lily_pad', 'big_duckweed'],
    baseChance: 0.02,
    perPlantChance: 0.04,
    perSpeciesChance: 0.08
  }
];

export const SHOP_ANIMAL_DEFINITIONS = [CAT_DEFINITION];

export const animalDefinitionRegistry = new Map(
  SHOP_ANIMAL_DEFINITIONS.map(definition => [definition.id, definition])
);

export function getShopAnimalDefinition(type) {
  return animalDefinitionRegistry.get(type) || null;
}
