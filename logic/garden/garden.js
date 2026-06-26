/**
 * Garden main module
 * Orchestrates garden functionality: loading, rendering, and interaction
 */

import { FLOWER_DEFINITIONS } from './plantGrowth.js';
import { getState } from '../storage.js';

import {
  loadGarden,
  saveGarden,
  removePlant,
  getPlantsAtTile,
  createPlant
} from './gardenStorage.js';
import {
  loadMapData,
  renderMap,
  renderPlants,
  getTileFromEvent,
  getMapDimensions
} from './gardenRenderer.js';
import { GardenAnimals } from './gardenAnimals.js';

// Module-level reference so we can destroy on teardown
let _animalManager = null;

/**
 * Initialize the garden view
 * @param {HTMLElement} container - Garden screen container
 * @param {Object} state - Application state with totalFocusMinutes
 * @returns {Promise<Object>} Garden controller object
 */
export async function initGarden(container, state) {
  const gardenContainer = container.querySelector('#gardenContainer');
  const mapLayer        = container.querySelector('#mapLayer');
  const animalLayer     = container.querySelector('#animalLayer');
  const loadingEl       = container.querySelector('#gardenLoading');
  const actionsEl       = container.querySelector('#gardenActions');

  try {
    // Load map data
    await loadMapData();

    // Render the map
    await renderMap(mapLayer);

    // Hide loading, show garden
    loadingEl?.classList.add('hidden');
    gardenContainer?.classList.remove('hidden');
    actionsEl?.classList.remove('hidden');

    // Load and render plants
    const gardenState = await loadGarden();
    updateGardenDisplay(container, gardenState, state);

    // ── Spawn frog ──────────────────────────────────────────────────────────
    // Destroy any previous manager (e.g. garden re-opened without full teardown)
    if (_animalManager) {
      _animalManager.destroy();
      _animalManager = null;
    }

    const baseUrl  = chrome.runtime.getURL('assets/');
    const mapDims  = getMapDimensions();
    // animalLayer is a separate div above plantLayer so plant re-renders
    // (which do plantLayer.innerHTML = '') never wipe the frog
    _animalManager = new GardenAnimals(animalLayer, mapDims, baseUrl);
    _animalManager.spawnFrog();
    // ── End frog ────────────────────────────────────────────────────────────

    // Setup event listeners
    setupGardenEvents(mapLayer, container, state);

    return {
      refresh:  (currentState) => refreshGarden(container, currentState),
      getState: () => loadGarden(),
      destroy:  () => {
        _animalManager?.destroy();
        _animalManager = null;
      },
    };

  } catch (error) {
    console.error('Failed to initialize garden:', error);
    loadingEl.textContent = 'Failed to load garden. Please check the console.';
  }
}

/**
 * Setup event listeners for garden interactions
 */
function setupGardenEvents(mapLayer, container, state) {
  const plantButton     = container.querySelector('#plantTestRoseBtn');
  const flowerStore     = container.querySelector('#flowerStore');
  const flowerOptionsDiv = flowerStore?.querySelector('.flower-options');
  const gardenInfoEl    = container.querySelector('#gardenInfo');

  let plantingMode      = false;
  let selectedFlowerType = null;
  let selectedFlowerName = null;

  // Generate store buttons from FLOWER_DEFINITIONS
  if (flowerOptionsDiv) {
    flowerOptionsDiv.innerHTML = '';
    FLOWER_DEFINITIONS.forEach(flower => {
      const btn = document.createElement('button');
      btn.className = 'flower-option';
      btn.dataset.flowerType = flower.type;
      btn.type = 'button';
      btn.title = flower.description;

      const preview = document.createElement('div');
      preview.className = 'flower-preview';
      const spriteUrl = chrome.runtime.getURL(`assets/plants/${flower.filename}`);
      preview.style.backgroundImage = `url('${spriteUrl}')`;
      const matureFrame = flower.stages - 1;
      preview.style.backgroundPosition = `-${matureFrame * 16}px 0px`;
      preview.style.backgroundSize = `${flower.stages * 16}px 16px`;

      const label = document.createElement('div');
      label.className = 'flower-label';
      label.textContent = `${flower.name} (${flower.price})`;

      btn.appendChild(preview);
      btn.appendChild(label);

      btn.addEventListener('click', () => {
        selectedFlowerType = flower.type;
        selectedFlowerName = flower.name;
        flowerOptionsDiv.querySelectorAll('.flower-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        gardenInfoEl.textContent = `Click a plantable tile to plant a ${flower.name}.`;
      });

      flowerOptionsDiv.appendChild(btn);
    });
  }

  // Plant flower button — show store
  plantButton?.addEventListener('click', () => {
    if (!plantingMode) {
      plantingMode = true;
      selectedFlowerType = null;
      selectedFlowerName = null;
      plantButton.textContent = 'Cancel';
      plantButton.classList.add('active');
      flowerStore?.classList.remove('hidden');
      gardenInfoEl.textContent = 'Select a flower to plant, then click a tile.';
    } else {
      plantingMode = false;
      selectedFlowerType = null;
      selectedFlowerName = null;
      plantButton.textContent = 'Plant Flower';
      plantButton.classList.remove('active');
      flowerStore?.classList.add('hidden');
      gardenInfoEl.textContent = '';
      flowerOptionsDiv?.querySelectorAll('.flower-option').forEach(b => b.classList.remove('selected'));
    }
  });

  // Click handler for planting
  mapLayer?.addEventListener('click', async (event) => {
    if (!plantingMode || !selectedFlowerType) return;

    const tile = getTileFromEvent(event, mapLayer);
    if (!tile) {
      gardenInfoEl.textContent = 'That tile is not plantable. Please choose another.';
      return;
    }

    try {
      let gardenState = await loadGarden();

      const existingPlants = getPlantsAtTile(gardenState, tile.tileX, tile.tileY);
      if (existingPlants.length > 0) {
        gardenInfoEl.textContent = 'This tile already has a plant!';
        return;
      }

      const flowerDef    = FLOWER_DEFINITIONS.find(f => f.type === selectedFlowerType);
      const cost         = flowerDef?.price || 10;
      const currentCoins = gardenState.coins || 0;

      if (currentCoins < cost) {
        gardenInfoEl.textContent = `Not enough coins! Need ${cost}, have ${currentCoins}.`;
        return;
      }

      const currentState = await getState();
      const plant = createPlant(
        selectedFlowerType,
        tile.tileX,
        tile.tileY,
        currentState.totalFocusMinutes || 0,
        { growDurationMinutes: flowerDef?.defaultGrowDurationMinutes }
      );

      gardenState.addPlant(plant);
      gardenState.spendCoins(cost);
      gardenState = await saveGarden(gardenState);

      state.garden = gardenState.serialize();

      updateGardenDisplay(container, gardenState, state);

      const plantedName = selectedFlowerName;
      plantingMode       = false;
      selectedFlowerType = null;
      selectedFlowerName = null;

      plantButton.textContent = 'Plant Flower';
      plantButton.classList.remove('active');
      flowerStore?.classList.add('hidden');
      flowerOptionsDiv?.querySelectorAll('.flower-option').forEach(b => b.classList.remove('selected'));

      gardenInfoEl.textContent = `Planted a ${plantedName} at (${tile.tileX}, ${tile.tileY})! (-${cost} coins)`;

    } catch (error) {
      console.error('Failed to plant:', error);
      gardenInfoEl.textContent = 'Failed to plant. Please try again.';
    }
  });
}

/**
 * Update the garden display
 */
function updateGardenDisplay(container, gardenState, appState) {
  const plantLayer       = container.querySelector('#plantLayer');
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

/**
 * Refresh the garden view
 */
export async function refreshGarden(container, state) {
  try {
    const gardenState = await loadGarden();
    gardenState.coins = state.garden?.coins || 0;
    updateGardenDisplay(container, gardenState, state);
  } catch (error) {
    console.error('Failed to refresh garden:', error);
  }
}

/**
 * Remove a plant from the garden
 */
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
  removeGardenPlant,
};
