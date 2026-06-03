/**
 * Plant growth system
 * Manages plant growth stages based on focus time
 */

/**
 * Plant growth stage thresholds
 * Based on percentage of growth duration
 */


/**
 * Flower shop definitions with metadata
 */
export const FLOWER_DEFINITIONS = [
  {
    type: 'rose',
    name: 'Rose',
    price: 50,
    filename: 'Rose-Red-grow.png',
    stages: 4,
    description: 'A classic beauty'
  },
  {
    type: 'dandelion',
    name: 'Dandelion',
    price: 40,
    filename: 'Dandelion-Grow.png',
    stages: 5,
    description: 'Cheerful yellow flower'
  },
  {
    type: 'sunflower',
    name: 'Sunflower',
    price: 40,
    filename: 'Sunflower-grow.png',
    stages: 4,
    description: 'Bright and bold'
  },
  {
    type: 'tulip',
    name: 'Tulip',
    price: 45,
    filename: 'Tulip-White-grow.png',
    stages: 5,
    description: 'Elegant and graceful'
  }
];

/**
 * Plant type to sprite asset mapping
 */
const PLANT_SPRITES = {
  rose: {
    filename: 'Rose-Red-grow.png',
    stages: 4,
    names: ['Seed', 'Sprout', 'Young Plant','Blooming']
  },
  dandelion: {
    filename: 'Dandelion-Grow.png',
    stages: 5,
    names: ['Seed', 'Sprout', 'Young Plant', 'Mature Plant', 'Flowering']
  },
  sunflower: {
    filename: 'Sunflower-grow.png',
    stages: 4,
    names: ['Seed', 'Sprout', 'Young Plant', 'Blooming']
  },
  tulip: {
    filename: 'Tulip-White-grow.png',
    stages: 5,
    names: ['Seed', 'Sprout', 'Young Plant', 'Mature Plant', 'Blooming']
  }
};

/**
 * Calculate the growth stage of a plant based on elapsed focus time
 * @param {Object} plant - The plant object
 * @param {number} totalFocusMinutes - Total focus minutes from productivity system
 * @returns {number} Growth stage (0 to stageCount-1, with stageCount-1 being fully mature)
 */
export function getPlantStage(plant, totalFocusMinutes) {
  if (!plant || plant.growDurationMinutes <= 0) {
    return 0;
  }

  // Get plant sprite info to determine how many stages this plant type has
  const plantInfo = PLANT_SPRITES[plant.type];
  const stageCount = plantInfo ? plantInfo.stages : 4; // Default to 4 if unknown type

  const elapsed = totalFocusMinutes - plant.plantedAtFocusMinutes;
  if (elapsed < 0) return 0;

  const progress = elapsed / plant.growDurationMinutes;

  // If fully mature, show the last stage
  if (progress >= 1.0) return stageCount - 1;
  
  // Map progress percentage to stage index (0 to stageCount - 1)
  const stage = Math.floor(progress * stageCount);
  return Math.min(stage, stageCount - 1);
}

/**
 * Get plant sprite information for rendering
 * @param {string} plantType - Type of plant (e.g., 'rose', 'dandelion')
 * @param {number} stage - Growth stage (0-4)
 * @returns {Object} Sprite info with url and properties
 */
export function getPlantSprite(plantType, stage) {
  const plantInfo = PLANT_SPRITES[plantType];
  
  if (!plantInfo) {
    console.warn(`Unknown plant type: ${plantType}, using default`);
    return getDefaultSprite(stage);
  }

  const normalizedStage = Math.min(stage, plantInfo.stages - 1);
  const spriteUrl = `assets/plants/${plantInfo.filename}`;
  
  return {
    url: chrome.runtime.getURL(spriteUrl),
    stage: normalizedStage,
    stageCount: plantInfo.stages,
    stageName: plantInfo.names[normalizedStage] || `Stage ${normalizedStage}`,
    spriteWidth: 16,
    spriteHeight: 16,
    frameWidth: 16,
    frameIndex: normalizedStage
  };
}

/**
 * Get default sprite for unknown plant types
 * @param {number} stage - Growth stage
 * @returns {Object} Default sprite info
 */
function getDefaultSprite(stage) {
  return {
    url: chrome.runtime.getURL('assets/plants/Rose-Red-grow.png'),
    stage: Math.min(stage, 4),
    stageCount: 4,
    stageName: `Stage ${stage}`,
    spriteWidth: 16,
    spriteHeight: 16,
    frameWidth: 16,
    frameIndex: Math.min(stage, 4)
  };
}

/**
 * Get background position for sprite sheet rendering
 * Used for CSS background-position property
 * @param {Object} sprite - Sprite info from getPlantSprite
 * @returns {string} CSS background-position value
 */
export function getSpriteBackgroundPosition(sprite) {
  const frameX = sprite.frameIndex * sprite.frameWidth;
  return `-${frameX}px 0px`;
}

/**
 * Get growth info for a plant
 * @param {Object} plant - The plant object
 * @param {number} totalFocusMinutes - Total focus minutes
 * @returns {Object} Growth information
 */
export function getPlantGrowthInfo(plant, totalFocusMinutes) {
  const stage = getPlantStage(plant, totalFocusMinutes);
  const elapsed = totalFocusMinutes - plant.plantedAtFocusMinutes;
  const remainingMinutes = Math.max(0, plant.growDurationMinutes - elapsed);
  const progressPercentage = Math.min(100, (elapsed / plant.growDurationMinutes) * 100);

  // Get plant info to determine max stage for this plant type
  const plantInfo = PLANT_SPRITES[plant.type];
  const maxStage = plantInfo ? plantInfo.stages - 1 : 3;

  return {
    stage,
    elapsed: Math.max(0, elapsed),
    remaining: remainingMinutes,
    percentage: progressPercentage,
    isComplete: stage >= maxStage
  };
}

/**
 * Validate plant data structure
 * @param {Object} plant - Plant object to validate
 * @returns {boolean} Whether plant data is valid
 */
export function isValidPlant(plant) {
  return (
    plant &&
    typeof plant.id === 'string' &&
    typeof plant.type === 'string' &&
    typeof plant.tileX === 'number' &&
    typeof plant.tileY === 'number' &&
    typeof plant.plantedAtFocusMinutes === 'number' &&
    typeof plant.growDurationMinutes === 'number' &&
    plant.id.length > 0 &&
    plant.type.length > 0 &&
    plant.tileX >= 0 &&
    plant.tileY >= 0 &&
    plant.growDurationMinutes > 0
  );
}

export default {
  getPlantStage,
  getPlantSprite,
  getSpriteBackgroundPosition,
  getPlantGrowthInfo,
  isValidPlant,
  FLOWER_DEFINITIONS
};
