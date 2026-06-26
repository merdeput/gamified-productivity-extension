/**
 * Compatibility facade for plant growth.
 *
 * New code should prefer Plant, Garden, plantRegistry, and growthResolver
 * directly. These functions keep existing UI modules on the same public API
 * while delegating to the OOP model layer.
 */

import { FLOWER_DEFINITIONS, plantRegistry } from './plantDefinitions.js';
import { growthResolver } from './growthResolver.js';
import { Plant } from './plant.js';

export { FLOWER_DEFINITIONS, plantRegistry, growthResolver, Plant };

export function getPlantStage(plant, totalFocusMinutes) {
  return growthResolver.getStageIndex(plant, totalFocusMinutes);
}

export function getPlantSprite(plantType, stage) {
  return growthResolver.getSprite(plantType, stage);
}

export function getSpriteBackgroundPosition(sprite) {
  return growthResolver.getSpriteBackgroundPosition(sprite);
}

export function getPlantGrowthInfo(plant, totalFocusMinutes) {
  return growthResolver.getGrowthInfo(plant, totalFocusMinutes);
}

export function isValidPlant(plant) {
  return Plant.isValid(plant);
}

export default {
  getPlantStage,
  getPlantSprite,
  getSpriteBackgroundPosition,
  getPlantGrowthInfo,
  isValidPlant,
  FLOWER_DEFINITIONS,
  plantRegistry,
  growthResolver,
  Plant
};
