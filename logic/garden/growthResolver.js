import { plantRegistry } from './plantDefinitions.js';

const DEFAULT_PLANT_TYPE = 'rose';

export class GrowthResolver {
  constructor(registry = plantRegistry, urlResolver = null) {
    this.registry = registry;
    this.urlResolver = urlResolver || ((path) => {
      if (globalThis.chrome?.runtime?.getURL) {
        return chrome.runtime.getURL(path);
      }
      return path;
    });
  }

  getDefinition(type) {
    return this.registry.get(type) || this.registry.require(DEFAULT_PLANT_TYPE);
  }

  getStageIndex(plant, totalFocusMinutes = 0) {
    if (!plant || Number(plant.growDurationMinutes) <= 0) {
      return 0;
    }

    const definition = this.getDefinition(plant.type);
    const elapsed = this.getElapsedMinutes(plant, totalFocusMinutes);
    const progress = Math.min(1, elapsed / plant.growDurationMinutes);

    if (progress >= 1) {
      return definition.stageCount - 1;
    }

    const totalWeight = definition.stages.reduce(
      (sum, stage) => sum + Math.max(0, stage.durationWeight),
      0
    );

    if (totalWeight <= 0) {
      return Math.min(Math.floor(progress * definition.stageCount), definition.stageCount - 1);
    }

    const progressedWeight = progress * totalWeight;
    let accumulated = 0;

    for (let index = 0; index < definition.stages.length; index += 1) {
      accumulated += Math.max(0, definition.stages[index].durationWeight);
      if (progressedWeight < accumulated) {
        return index;
      }
    }

    return definition.stageCount - 1;
  }

  getStage(plantOrType, stageIndexOrFocusMinutes = 0) {
    if (typeof plantOrType === 'string') {
      return this.getDefinition(plantOrType).getStage(stageIndexOrFocusMinutes);
    }

    const stageIndex = this.getStageIndex(plantOrType, stageIndexOrFocusMinutes);
    return this.getDefinition(plantOrType?.type).getStage(stageIndex);
  }

  getElapsedMinutes(plant, totalFocusMinutes = 0) {
    return Math.max(0, Number(totalFocusMinutes || 0) - Number(plant?.plantedAtFocusMinutes || 0));
  }

  getGrowthInfo(plant, totalFocusMinutes = 0) {
    const definition = this.getDefinition(plant?.type);
    const elapsed = this.getElapsedMinutes(plant, totalFocusMinutes);
    const growDuration = Math.max(1, Number(plant?.growDurationMinutes || definition.defaultGrowDurationMinutes));
    const stage = this.getStageIndex({ ...plant, growDurationMinutes: growDuration }, totalFocusMinutes);
    const remaining = Math.max(0, growDuration - elapsed);
    const percentage = Math.min(100, (elapsed / growDuration) * 100);

    return {
      stage,
      stageData: definition.getStage(stage),
      stageCount: definition.stageCount,
      elapsed,
      remaining,
      percentage,
      isComplete: stage >= definition.stageCount - 1
    };
  }

  getSprite(plantType, stageIndex = 0) {
    const definition = this.getDefinition(plantType);
    const stage = definition.getStage(stageIndex);
    const spritePath = `assets/plants/${definition.sprite.folder}/${definition.sprite.filename}`;

    return {
      url: this.urlResolver(spritePath),
      filename: definition.sprite.filename,
      folder: definition.sprite.folder,
      stage: definition.stages.indexOf(stage),
      stageId: stage.id,
      stageCount: definition.stageCount,
      stageName: stage.name,
      spriteWidth: definition.sprite.frameWidth,
      spriteHeight: definition.sprite.frameHeight,
      frameWidth: definition.sprite.frameWidth,
      frameHeight: definition.sprite.frameHeight,
      frameIndex: stage.frameIndex
    };
  }

  getSpriteForPlant(plant, totalFocusMinutes = 0) {
    return this.getSprite(plant?.type, this.getStageIndex(plant, totalFocusMinutes));
  }

  getSpriteBackgroundPosition(sprite) {
    const frameX = sprite.frameIndex * sprite.frameWidth;
    return `-${frameX}px 0px`;
  }
}

export const growthResolver = new GrowthResolver();

export default growthResolver;
