/**
 * Garden storage module
 * Uses the application's main state as the single source of truth.
 */

import { isValidPlant } from './plantGrowth.js';
import { getState, saveState } from '../../storage.js';

/**
 * Load garden data from the main application state
 */
export async function loadGarden() {
  try {
    const state = await getState();

    const garden = {
      plants: Array.isArray(state.garden?.plants)
        ? state.garden.plants.filter(isValidPlant)
        : [],
      coins: Math.max(0, Number(state.garden?.coins || 0))
    };

    return garden;
  } catch (error) {
    console.error('Failed to load garden:', error);

    return {
      plants: [],
      coins: 0
    };
  }
}

/**
 * Save garden data into the main application state
 */
export async function saveGarden(gardenState) {
  try {
    const state = await getState();

    state.garden = {
      plants: Array.isArray(gardenState?.plants)
        ? gardenState.plants.filter(isValidPlant)
        : [],
      coins: Math.max(0, Number(gardenState?.coins || 0))
    };

    await saveState(state);
  } catch (error) {
    console.error('Failed to save garden:', error);
    throw error;
  }
}

/**
 * Add a plant
 */
export async function addPlant(plantData) {
  try {
    if (!isValidPlant(plantData)) {
      throw new Error('Invalid plant data');
    }

    const state = await getState();

    state.garden ??= {
      plants: [],
      coins: 0
    };

    state.garden.plants.push(plantData);

    await saveState(state);

    return state.garden;
  } catch (error) {
    console.error('Failed to add plant:', error);
    throw error;
  }
}

/**
 * Remove a plant
 */
export async function removePlant(plantId) {
  try {
    const state = await getState();

    state.garden ??= {
      plants: [],
      coins: 0
    };

    state.garden.plants =
      (state.garden.plants || []).filter(
        plant => plant.id !== plantId
      );

    await saveState(state);

    return state.garden;
  } catch (error) {
    console.error('Failed to remove plant:', error);
    throw error;
  }
}

/**
 * Update a plant
 */
export async function updatePlant(plantId, updates) {
  try {
    const state = await getState();

    state.garden ??= {
      plants: [],
      coins: 0
    };

    state.garden.plants =
      (state.garden.plants || []).map(plant => {
        if (plant.id !== plantId) {
          return plant;
        }

        const updatedPlant = {
          ...plant,
          ...updates,
          id: plant.id
        };

        if (!isValidPlant(updatedPlant)) {
          throw new Error(
            `Invalid plant update for ${plantId}`
          );
        }

        return updatedPlant;
      });

    await saveState(state);

    return state.garden;
  } catch (error) {
    console.error('Failed to update plant:', error);
    throw error;
  }
}

/**
 * Update coins
 */
export async function updateCoins(amount) {
  try {
    const state = await getState();

    state.garden ??= {
      plants: [],
      coins: 0
    };

    state.garden.coins = Math.max(
      0,
      Number(state.garden.coins || 0) + amount
    );

    await saveState(state);

    return state.garden;
  } catch (error) {
    console.error('Failed to update coins:', error);
    throw error;
  }
}

/**
 * Find plant by id
 */
export async function getPlant(plantId) {
  const garden = await loadGarden();

  return (
    garden.plants.find(
      plant => plant.id === plantId
    ) || null
  );
}

/**
 * Find plants at tile
 */
export async function getPlantsAtTile(tileX, tileY) {
  const garden = await loadGarden();

  return garden.plants.filter(
    plant =>
      plant.tileX === tileX &&
      plant.tileY === tileY
  );
}

export default {
  loadGarden,
  saveGarden,
  addPlant,
  removePlant,
  updatePlant,
  updateCoins,
  getPlant,
  getPlantsAtTile
};