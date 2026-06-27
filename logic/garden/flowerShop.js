import { plantRegistry } from './plantDefinitions.js';
import { growthResolver } from './growthResolver.js';
import { SHOP_ANIMAL_DEFINITIONS } from './animalDefinitions.js';

export class FlowerShop {
  constructor(container, options = {}) {
    this.container = container;
    this.optionsEl = container?.querySelector('.flower-options') || null;
    this.onSelect = options.onSelect || (() => {});
    this.onPurchaseAnimal = options.onPurchaseAnimal || (() => {});
    this.selectedPlantType = null;
    this.availablePlants = [];
    this.availableAnimals = SHOP_ANIMAL_DEFINITIONS;
  }

  renderForGarden(garden) {
    this.selectedPlantType = null;
    this.availablePlants = plantRegistry.shopItemsForLayers(garden.plantLayers);

    if (!this.optionsEl) return;

    this.optionsEl.innerHTML = '';
    this.optionsEl.appendChild(this.createSectionLabel('Flowers'));
    this.availablePlants.forEach(plant => {
      const button = this.createOptionButton(plant);
      this.optionsEl.appendChild(button);
    });

    this.optionsEl.appendChild(this.createSectionLabel('Animals'));
    this.availableAnimals.forEach(animal => {
      const button = this.createAnimalButton(animal, garden);
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

  createSectionLabel(text) {
    const label = document.createElement('div');
    label.className = 'shop-section-label';
    label.textContent = text;
    return label;
  }

  createAnimalButton(animal, garden) {
    const owned = Array.isArray(garden.animals) && garden.animals.includes(animal.id);
    const button = document.createElement('button');
    button.className = 'flower-option animal-option';
    button.dataset.animalType = animal.id;
    button.type = 'button';
    button.title = animal.description;
    button.disabled = owned;

    const preview = document.createElement('div');
    preview.className = 'flower-preview animal-preview';
    preview.style.backgroundImage = `url('${growthResolver.urlResolver(`assets/animal/${animal.folder}/${animal.fileNames.idle}`)}')`;
    preview.style.backgroundPosition = '0 0';
    preview.style.backgroundSize = `${animal.states.idle * animal.frameWidth}px ${animal.frameHeight}px`;
    preview.style.width = `${animal.frameWidth}px`;
    preview.style.height = `${animal.frameHeight}px`;

    const label = document.createElement('div');
    label.className = 'flower-label';
    label.textContent = owned ? `${animal.displayName} (owned)` : `${animal.displayName} (${animal.price})`;

    button.appendChild(preview);
    button.appendChild(label);
    button.addEventListener('click', () => this.onPurchaseAnimal(animal));

    return button;
  }
}

export default FlowerShop;
