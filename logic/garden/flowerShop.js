import { plantRegistry } from './plantDefinitions.js';
import { growthResolver } from './growthResolver.js';

export class FlowerShop {
  constructor(container, options = {}) {
    this.container = container;
    this.optionsEl = container?.querySelector('.flower-options') || null;
    this.onSelect = options.onSelect || (() => {});
    this.selectedPlantType = null;
    this.availablePlants = [];
  }

  renderForGarden(garden) {
    this.selectedPlantType = null;
    this.availablePlants = plantRegistry.shopItemsForLayers(garden.plantLayers);

    if (!this.optionsEl) return;

    this.optionsEl.innerHTML = '';
    this.availablePlants.forEach(plant => {
      const button = this.createOptionButton(plant);
      this.optionsEl.appendChild(button);
    });
  }

  getSelectedDefinition() {
    return this.selectedPlantType ? plantRegistry.get(this.selectedPlantType) : null;
  }

  clearSelection() {
    this.selectedPlantType = null;
    this.optionsEl?.querySelectorAll('.flower-option').forEach(button => {
      button.classList.remove('selected');
    });
  }

  createOptionButton(plant) {
    const definition = plant.definition || plantRegistry.require(plant.type);
    const button = document.createElement('button');
    button.className = 'flower-option';
    button.dataset.flowerType = plant.type;
    button.type = 'button';
    button.title = plant.description;

    const preview = document.createElement('div');
    preview.className = 'flower-preview';
    const matureStage = definition.getMatureStage();
    const sprite = growthResolver.getSprite(plant.type, definition.stages.indexOf(matureStage));
    preview.style.backgroundImage = `url('${sprite.url}')`;
    preview.style.backgroundPosition = growthResolver.getSpriteBackgroundPosition(sprite);
    preview.style.backgroundSize = `${sprite.stageCount * sprite.spriteWidth}px ${sprite.spriteHeight}px`;
    preview.style.width = `${Math.max(32, sprite.spriteWidth)}px`;
    preview.style.height = `${sprite.spriteHeight}px`;

    const label = document.createElement('div');
    label.className = 'flower-label';
    label.textContent = `${plant.name} (${plant.price})`;

    button.appendChild(preview);
    button.appendChild(label);

    button.addEventListener('click', () => {
      this.selectedPlantType = plant.type;
      this.optionsEl?.querySelectorAll('.flower-option').forEach(option => {
        option.classList.remove('selected');
      });
      button.classList.add('selected');
      this.onSelect(definition);
    });

    return button;
  }
}

export default FlowerShop;
