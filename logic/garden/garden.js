/**
 * Garden main module.
 * Coordinates garden selection, map rendering, shop filtering, and planting.
 */

import { getState } from '../storage.js';
import {
  createPlant,
  getPlantsAtTile,
  listGardens,
  loadActiveGarden,
  loadGarden,
  purchaseAnimal,
  purchaseGarden,
  removePlant,
  saveGarden,
  setActiveGarden
} from './gardenStorage.js';
import {
  getMapDimensions,
  getMoveableTiles,
  getTileFromEvent,
  loadMapData,
  renderMap,
  renderPlants
} from './gardenRenderer.js';
import { FlowerShop } from './flowerShop.js';
import { GardenAnimals } from './gardenAnimals.js';

let _animalManager = null;

export async function initGarden(container, state) {
  const gardenContainer = container.querySelector('#gardenContainer');
  const mapLayer = container.querySelector('#mapLayer');
  const animalLayer = container.querySelector('#animalLayer');
  const loadingEl = container.querySelector('#gardenLoading');
  const actionsEl = container.querySelector('#gardenActions');

  try {
    loadingEl?.classList.add('hidden');
    gardenContainer?.classList.remove('hidden');
    actionsEl?.classList.remove('hidden');

    const controller = await setupGardenEvents(mapLayer, animalLayer, container, state);

    return {
      refresh: currentState => controller.refresh(currentState),
      getState: () => loadActiveGarden(),
      destroy: () => {
        _animalManager?.destroy();
        _animalManager = null;
      }
    };
  } catch (error) {
    console.error('Failed to initialize garden:', error);
    loadingEl.textContent = 'Failed to load garden. Please check the console.';
  }
}

async function setupGardenEvents(mapLayer, animalLayer, container, state) {
  const plantButton = container.querySelector('#plantTestRoseBtn');
  const flowerStore = container.querySelector('#flowerStore');
  const gardenListEl = container.querySelector('#gardenList');
  const gardenInfoEl = container.querySelector('#gardenInfo');

  let activeGarden = await loadActiveGarden();
  let plantingMode = false;
  let selectedPlantDefinition = null;

  const flowerShop = new FlowerShop(flowerStore, {
    onSelect: definition => {
      selectedPlantDefinition = definition;
      updatePlantingHighlights(mapLayer, selectedPlantDefinition, plantingMode);
      gardenInfoEl.textContent = `Click a highlighted tile to plant a ${definition.displayName}.`;
    },
    onPurchaseAnimal: async definition => {
      try {
        let gardenState = await purchaseAnimal(definition.id, activeGarden.id);
        activeGarden = gardenState;
        syncLocalGardenState(state, gardenState);
        await renderGardenScene(container, mapLayer, animalLayer, activeGarden, state, flowerShop);
        await renderGardenList(gardenListEl, activeGarden, switchGarden);
        gardenInfoEl.textContent = `${definition.displayName} joined your garden! (-${definition.price} coins)`;
      } catch (error) {
        console.error('Failed to purchase animal:', error);
        gardenInfoEl.textContent = error.message || 'Could not purchase that animal.';
      }
    }
  });

  await renderGardenList(gardenListEl, activeGarden, switchGarden);
  await renderGardenScene(container, mapLayer, animalLayer, activeGarden, state, flowerShop);

  plantButton?.addEventListener('click', () => {
    if (!plantingMode) {
      plantingMode = true;
      selectedPlantDefinition = null;
      plantButton.textContent = 'Cancel';
      plantButton.classList.add('active');
      flowerStore?.classList.remove('hidden');
      flowerShop.clearSelection();
      updatePlantingHighlights(mapLayer, null, plantingMode);
      gardenInfoEl.textContent = 'Select a flower to plant, or buy an animal for this garden.';
      return;
    }

    closePlantingMode();
  });

  mapLayer?.addEventListener('click', async event => {
    if (!plantingMode || !selectedPlantDefinition) return;

    const tile = getTileFromEvent(event, mapLayer, selectedPlantDefinition.plantableLayers);
    if (!tile) {
      gardenInfoEl.textContent = 'That plant cannot grow on this tile.';
      return;
    }

    try {
      let gardenState = await loadGarden(activeGarden.id);
      const existingPlants = getPlantsAtTile(gardenState, tile.tileX, tile.tileY);

      if (existingPlants.length > 0) {
        gardenInfoEl.textContent = 'This tile already has a plant!';
        return;
      }

      if (!gardenState.canPlantDefinitionAt(selectedPlantDefinition, tile)) {
        gardenInfoEl.textContent = 'That plant cannot grow on this tile.';
        return;
      }

      const cost = selectedPlantDefinition.price || 10;
      const currentCoins = gardenState.coins || 0;

      if (currentCoins < cost) {
        gardenInfoEl.textContent = `Not enough coins! Need ${cost}, have ${currentCoins}.`;
        return;
      }

      const currentState = await getState();
      const plant = createPlant(
        selectedPlantDefinition.id,
        tile.tileX,
        tile.tileY,
        currentState.totalFocusMinutes || 0,
        {
          growDurationMinutes: selectedPlantDefinition.defaultGrowDurationMinutes,
          layer: tile.layerName
        }
      );

      gardenState.addPlant(plant);
      gardenState.spendCoins(cost);
      gardenState = await saveGarden(gardenState, activeGarden.id);
      activeGarden = gardenState;
      syncLocalGardenState(state, gardenState);

      updateGardenDisplay(container, gardenState, state);
      restartAnimals(animalLayer, gardenState);
      await renderGardenList(gardenListEl, activeGarden, switchGarden);

      const plantedName = selectedPlantDefinition.displayName;
      closePlantingMode();
      gardenInfoEl.textContent = `Planted a ${plantedName} at (${tile.tileX}, ${tile.tileY})! (-${cost} coins)`;
    } catch (error) {
      console.error('Failed to plant:', error);
      gardenInfoEl.textContent = 'Failed to plant. Please try again.';
    }
  });

  async function switchGarden(gardenId, action = 'select') {
    try {
      closePlantingMode();
      activeGarden = action === 'purchase'
        ? await purchaseGarden(gardenId)
        : await setActiveGarden(gardenId);

      syncLocalGardenState(state, activeGarden);
      await renderGardenScene(container, mapLayer, animalLayer, activeGarden, state, flowerShop);
      await renderGardenList(gardenListEl, activeGarden, switchGarden);
      gardenInfoEl.textContent = `${activeGarden.name} selected.`;
    } catch (error) {
      console.error('Failed to switch garden:', error);
      gardenInfoEl.textContent = error.message || 'Could not switch garden.';
    }
  }

  function closePlantingMode() {
    plantingMode = false;
    selectedPlantDefinition = null;
    plantButton.textContent = 'Garden Shop';
    plantButton.classList.remove('active');
    flowerStore?.classList.add('hidden');
    flowerShop.clearSelection();
    updatePlantingHighlights(mapLayer, null, false);
  }

  return {
    refresh: async currentState => {
      activeGarden = await loadGarden(activeGarden.id);
      await renderGardenList(gardenListEl, activeGarden, switchGarden);
      updateGardenDisplay(container, activeGarden, currentState);
    }
  };
}

async function renderGardenScene(container, mapLayer, animalLayer, gardenState, appState, flowerShop) {
  await loadMapData(gardenState);
  await renderMap(mapLayer, gardenState);
  updateGardenDisplay(container, gardenState, appState);
  flowerShop.renderForGarden(gardenState);
  restartAnimals(animalLayer, gardenState);
}

function restartAnimals(animalLayer, gardenState) {
  _animalManager?.destroy();

  const baseUrl = chrome.runtime.getURL('assets/');
  const mapDims = {
    ...getMapDimensions(),
    moveableTiles: getMoveableTiles()
  };
  _animalManager = new GardenAnimals(animalLayer, mapDims, baseUrl);
  _animalManager.spawnGardenAnimals(gardenState);
}

async function renderGardenList(container, activeGarden, onGardenAction) {
  if (!container) return;

  const gardens = await listGardens();
  container.innerHTML = '';

  gardens.forEach(garden => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'garden-card';
    card.classList.toggle('active', garden.id === activeGarden.id);
    card.classList.toggle('locked', !garden.unlocked);

    const title = document.createElement('strong');
    title.textContent = garden.name;

    const meta = document.createElement('span');
    meta.textContent = garden.unlocked
      ? `${garden.plantCount} planted`
      : `Locked - ${garden.price} coins`;

    card.appendChild(title);
    card.appendChild(meta);

    card.addEventListener('click', () => {
      onGardenAction(garden.id, garden.unlocked ? 'select' : 'purchase');
    });

    container.appendChild(card);
  });
}

function updatePlantingHighlights(mapLayer, plantDefinition, isPlanting) {
  mapLayer.classList.toggle('planting-mode', Boolean(isPlanting && plantDefinition));

  mapLayer.querySelectorAll('.planting-tile').forEach(tile => {
    const tileLayers = String(tile.dataset.plantLayers || '').split(',').filter(Boolean);
    const isCompatible = Boolean(
      plantDefinition &&
      plantDefinition.plantableLayers.some(layerName => tileLayers.includes(layerName))
    );

    tile.classList.toggle('is-compatible', isCompatible);
    tile.classList.toggle('is-incompatible', Boolean(isPlanting && plantDefinition && !isCompatible));
  });
}

function syncLocalGardenState(appState, gardenState) {
  const serialized = gardenState.serialize();
  appState.gardens = {
    ...(appState.gardens || {}),
    [gardenState.id]: serialized
  };
  appState.activeGardenId = gardenState.id;

  if (gardenState.id === 'growing') {
    appState.garden = serialized;
  } else {
    appState.garden = {
      ...(appState.garden || {}),
      coins: serialized.coins
    };
  }
}

function updateGardenDisplay(container, gardenState, appState) {
  const plantLayer = container.querySelector('#plantLayer');
  const totalFocusMinutes = appState?.totalFocusMinutes || 0;
  renderPlants(plantLayer, gardenState.plants || [], totalFocusMinutes);
  updateCoinDisplays(container, gardenState.coins || 0);
}

function updateCoinDisplays(container, coins) {
  const coinCountEl = document.getElementById('coinCount');
  if (coinCountEl) coinCountEl.textContent = coins;
  const gardenCoinsEl = container.querySelector('#gardenCoins');
  if (gardenCoinsEl) gardenCoinsEl.textContent = `${coins} coin${coins === 1 ? '' : 's'}`;
}

export async function refreshGarden(container, state) {
  try {
    const gardenState = await loadActiveGarden();
    updateGardenDisplay(container, gardenState, state);
  } catch (error) {
    console.error('Failed to refresh garden:', error);
  }
}

export async function removeGardenPlant(plantId) {
  try {
    return await removePlant(plantId);
  } catch (error) {
    console.error('Failed to remove plant:', error);
    throw error;
  }
}

export default {
  initGarden,
  refreshGarden,
  removeGardenPlant
};
