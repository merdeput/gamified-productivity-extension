/**
 * Garden main module
 * Orchestrates garden functionality: loading, rendering, and interaction
 */

import { getPlantStage, FLOWER_DEFINITIONS } from './plantGrowth.js';
import { getState, saveState } from '../storage.js';

import { 
  loadGarden, 
  saveGarden, 
  addPlant, 
  updateCoins,
  removePlant,
  getPlantsAtTile
} from './gardenStorage.js';
import {
  loadMapData,
  renderMap,
  renderPlants,
  getTileFromEvent,
  isPlantableTile,
  getMapDimensions
} from './gardenRenderer.js';

/**
 * Initialize the garden view
 * @param {HTMLElement} container - Garden screen container
 * @param {Object} state - Application state with totalFocusMinutes
 * @returns {Promise<Object>} Garden controller object
 */
export async function initGarden(container, state) {
  const gardenContainer = container.querySelector('#gardenContainer');
  const mapLayer = container.querySelector('#mapLayer');
  const plantLayer = container.querySelector('#plantLayer');
  const loadingEl = container.querySelector('#gardenLoading');
  const actionsEl = container.querySelector('#gardenActions');
  const flowerStore = container.querySelector('#flowerStore');
  const gardenCoinsEl = container.querySelector('#gardenCoins');
  const gardenInfoEl = container.querySelector('#gardenInfo');
  
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
    
    // Setup event listeners
    setupGardenEvents(mapLayer, plantLayer, container, state);
    
    return {
      refresh: (currentState) => refreshGarden(container, currentState),
      getState: () => loadGarden()
    };
    
  } catch (error) {
    console.error('Failed to initialize garden:', error);
    loadingEl.textContent = 'Failed to load garden. Please check the console.';
  }
}

/**
 * Setup event listeners for garden interactions
 * @param {HTMLElement} mapLayer - Map layer element
 * @param {HTMLElement} plantLayer - Plant layer element
 * @param {HTMLElement} container - Garden container
 * @param {Object} state - Application state
 */
function setupGardenEvents(mapLayer, plantLayer, container, state) {
  const plantButton = container.querySelector('#plantTestRoseBtn');
  const flowerStore = container.querySelector('#flowerStore');
  const flowerOptionsDiv = flowerStore?.querySelector('.flower-options');
  const gardenInfoEl = container.querySelector('#gardenInfo');
  
  let plantingMode = false;
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
      
      // Create preview with sprite
      const preview = document.createElement('div');
      preview.className = 'flower-preview';
      const spriteUrl = chrome.runtime.getURL(`assets/plants/${flower.filename}`);
      preview.style.backgroundImage = `url('${spriteUrl}')`;
      // Show the mature stage (last frame)
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
  
  // Plant flower button - show store
  plantButton?.addEventListener('click', () => {
    if (!plantingMode) {
      // Show store
      plantingMode = true;
      selectedFlowerType = null;
      selectedFlowerName = null;
      plantButton.textContent = 'Cancel';
      plantButton.classList.add('active');
      flowerStore?.classList.remove('hidden');
      gardenInfoEl.textContent = 'Select a flower to plant, then click a tile.';
    } else {
      // Exit store
      plantingMode = false;
      selectedFlowerType = null;
      selectedFlowerName = null;
      plantButton.textContent = 'Plant a Flower';
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
    // Always load latest garden state
    let gardenState = await loadGarden();

    // Check occupied tile
    const existingPlants = getPlantsAtTile(
      gardenState,
      tile.tileX,
      tile.tileY
    );

    if (existingPlants.length > 0) {
      gardenInfoEl.textContent = 'This tile already has a plant!';
      return;
    }

    // Flower cost
    const flowerDef = FLOWER_DEFINITIONS.find(
      f => f.type === selectedFlowerType
    );

    const cost = flowerDef?.price || 10;
    const currentCoins = gardenState.coins || 0;

    if (currentCoins < cost) {
      gardenInfoEl.textContent =
        `Not enough coins! Need ${cost}, have ${currentCoins}.`;
      return;
    }

    // Create plant
    const currentState = await getState();
    console.log("currstate =", state);
    const plant = createPlant(
      selectedFlowerType,
      tile.tileX,
      tile.tileY,
      currentState.totalFocusMinutes || 0,
      60
    );

    console.log(
      "current focus:",
      state.totalFocusMinutes,
      "plant focus:",
      plant.plantedAtFocusMinutes
    );

    // Add plant
    gardenState = await addPlant(plant);

    // Deduct coins
    gardenState = await updateCoins(-cost);

    // Keep popup state in sync
    state.garden = gardenState;

    // Update UI
    updateGardenDisplay(container, gardenState, state);

    // Exit planting mode
    const plantedName = selectedFlowerName;

    plantingMode = false;
    selectedFlowerType = null;
    selectedFlowerName = null;

    plantButton.textContent = 'Plant a Flower';
    plantButton.classList.remove('active');

    flowerStore?.classList.add('hidden');

    flowerOptionsDiv
      ?.querySelectorAll('.flower-option')
      .forEach(b => b.classList.remove('selected'));

    gardenInfoEl.textContent =
      `Planted a ${plantedName} at (${tile.tileX}, ${tile.tileY})! (-${cost} coins)`;

  } catch (error) {
    console.error('Failed to plant:', error);
    gardenInfoEl.textContent =
      'Failed to plant. Please try again.';
  }
});
}

/**
 * Create a new plant object
 * @param {string} type - Plant type (rose, dandelion, etc.)
 * @param {number} tileX - Tile X coordinate
 * @param {number} tileY - Tile Y coordinate
 * @param {number} totalFocusMinutes - Current total focus minutes
 * @returns {Object} Plant object
 */
function createPlant(type, tileX, tileY, totalFocusMinutes, growDurationMins) {
  return {
    id: `plant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: type,
    tileX: tileX,
    tileY: tileY,
    plantedAtFocusMinutes: totalFocusMinutes || 0,
    growDurationMinutes: growDurationMins // Default 60 minute growth cycle
  };
}

/**
 * Update the garden display
 * @param {HTMLElement} container - Garden container
 * @param {Object} gardenState - Garden state from storage
 * @param {Object} appState - Application state
 */
function updateGardenDisplay(container, gardenState, appState) {
  const plantLayer = container.querySelector('#plantLayer');
  const gardenCoinsEl = container.querySelector('#gardenCoins');
  
  // Render plants
  const totalFocusMinutes = appState?.totalFocusMinutes || 0;
  console.log("Focus = ", totalFocusMinutes);
  renderPlants(plantLayer, gardenState.plants || [], totalFocusMinutes);
  
  // Update coin display
  updateCoinDisplays(container, gardenState.coins || 0)
}

function updateCoinDisplays(container, coins) {
  const coinCountEl = document.getElementById('coinCount');
  if (coinCountEl) coinCountEl.textContent = coins;
  const gardenCoinsEl = container.querySelector('#gardenCoins');
  if (gardenCoinsEl) gardenCoinsEl.textContent = `${coins} coin${coins === 1 ? '' : 's'}`;
}

/**
 * Refresh the garden view
 * @param {HTMLElement} container - Garden container
 * @param {Object} state - Current application state
 * @returns {Promise<void>}
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
 * @param {string} plantId - ID of plant to remove
 * @returns {Promise<Object>} Updated garden state
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
  removeGardenPlant
};
