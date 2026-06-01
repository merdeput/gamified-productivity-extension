/**
 * Garden storage module
 * Handles persisting garden state (plants) to chrome.storage.local
 */

import { isValidPlant } from './plantGrowth.js';

/**
 * Load garden state from storage
 * @returns {Promise<Object>} Garden object with plants array
 */
export async function loadGarden() {
  try {
    const result = await chrome.storage.local.get('gardenState');
    const gardenState = result.gardenState || { plants: [], coins: 0 };
    
    // Validate plants
    if (Array.isArray(gardenState.plants)) {
      gardenState.plants = gardenState.plants.filter(plant => {
        try {
          return isValidPlant(plant);
        } catch (e) {
          console.warn('Invalid plant data, skipping:', plant, e);
          return false;
        }
      });
    } else {
      gardenState.plants = [];
    }
    
    return gardenState;
  } catch (error) {
    console.error('Failed to load garden:', error);
    return { plants: [], coins: 0 };
  }
}

/**
 * Save garden state to storage
 * @param {Object} gardenState - Garden state with plants and coins
 * @returns {Promise<void>}
 */
export async function saveGarden(gardenState) {
  try {
    if (!gardenState || typeof gardenState !== 'object') {
      throw new Error('Invalid garden state');
    }
    
    const validatedState = {
      plants: Array.isArray(gardenState.plants) ? gardenState.plants.filter(isValidPlant) : [],
      coins: Math.max(0, Number(gardenState.coins) || 0)
    };
    
    await chrome.storage.local.set({ gardenState: validatedState });
  } catch (error) {
    console.error('Failed to save garden:', error);
    throw error;
  }
}

/**
 * Add a plant to the garden
 * @param {Object} gardenState - Current garden state
 * @param {Object} plantData - Plant to add
 * @returns {Promise<Object>} Updated garden state
 */
export async function addPlant(gardenState, plantData) {
  try {
    if (!isValidPlant(plantData)) {
      throw new Error('Invalid plant data');
    }
    
    const updatedState = {
      ...gardenState,
      plants: [...(gardenState.plants || []), plantData]
    };
    
    await saveGarden(updatedState);
    return updatedState;
  } catch (error) {
    console.error('Failed to add plant:', error);
    throw error;
  }
}

/**
 * Remove a plant from the garden
 * @param {Object} gardenState - Current garden state
 * @param {string} plantId - ID of plant to remove
 * @returns {Promise<Object>} Updated garden state
 */
export async function removePlant(gardenState, plantId) {
  try {
    if (!plantId || typeof plantId !== 'string') {
      throw new Error('Invalid plant ID');
    }
    
    const updatedState = {
      ...gardenState,
      plants: (gardenState.plants || []).filter(p => p.id !== plantId)
    };
    
    await saveGarden(updatedState);
    return updatedState;
  } catch (error) {
    console.error('Failed to remove plant:', error);
    throw error;
  }
}

/**
 * Update a plant in the garden
 * @param {Object} gardenState - Current garden state
 * @param {string} plantId - ID of plant to update
 * @param {Object} plantData - Updated plant data (merged with existing)
 * @returns {Promise<Object>} Updated garden state
 */
export async function updatePlant(gardenState, plantId, plantData) {
  try {
    if (!plantId || typeof plantId !== 'string') {
      throw new Error('Invalid plant ID');
    }
    
    const updatedPlants = (gardenState.plants || []).map(plant => {
      if (plant.id === plantId) {
        const updated = { ...plant, ...plantData, id: plantId };
        if (!isValidPlant(updated)) {
          throw new Error(`Invalid updated plant data for ${plantId}`);
        }
        return updated;
      }
      return plant;
    });
    
    const updatedState = {
      ...gardenState,
      plants: updatedPlants
    };
    
    await saveGarden(updatedState);
    return updatedState;
  } catch (error) {
    console.error('Failed to update plant:', error);
    throw error;
  }
}

/**
 * Get a plant by ID
 * @param {Object} gardenState - Current garden state
 * @param {string} plantId - ID of plant to find
 * @returns {Object|null} Plant object or null if not found
 */
export function getPlant(gardenState, plantId) {
  if (!gardenState || !Array.isArray(gardenState.plants)) {
    return null;
  }
  return gardenState.plants.find(p => p.id === plantId) || null;
}

/**
 * Get all plants at a specific tile
 * @param {Object} gardenState - Current garden state
 * @param {number} tileX - Tile X coordinate
 * @param {number} tileY - Tile Y coordinate
 * @returns {Array<Object>} Array of plants at this tile
 */
export function getPlantsAtTile(gardenState, tileX, tileY) {
  if (!gardenState || !Array.isArray(gardenState.plants)) {
    return [];
  }
  return gardenState.plants.filter(p => p.tileX === tileX && p.tileY === tileY);
}

/**
 * Update coins in the garden
 * @param {Object} gardenState - Current garden state
 * @param {number} amount - Amount to add (can be negative to subtract)
 * @returns {Promise<Object>} Updated garden state
 */
export async function updateCoins(gardenState, amount) {
  try {
    const currentCoins = Math.max(0, Number(gardenState.coins) || 0);
    const newCoins = Math.max(0, currentCoins + amount);
    
    const updatedState = {
      ...gardenState,
      coins: newCoins
    };
    
    await saveGarden(updatedState);
    return updatedState;
  } catch (error) {
    console.error('Failed to update coins:', error);
    throw error;
  }
}

export default {
  loadGarden,
  saveGarden,
  addPlant,
  removePlant,
  updatePlant,
  getPlant,
  getPlantsAtTile,
  updateCoins
};
