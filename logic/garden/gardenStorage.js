/**
 * Garden storage facade.
 *
 * The GardenRepository owns persistence and is ready for multiple gardens.
 * These functions preserve the existing garden module API.
 */

import { Garden } from './gardenModel.js';
import { gardenRepository } from './gardenRepository.js';
import { Plant } from './plant.js';

export async function loadGarden(gardenId) {
  return gardenRepository.loadGarden(gardenId);
}

export async function saveGarden(gardenState, gardenId) {
  const garden = gardenState instanceof Garden ? gardenState : new Garden(gardenState);
  return gardenRepository.saveGarden(garden, gardenId || garden.id);
}

export async function addPlant(plantData, gardenId) {
  return gardenRepository.updateGarden((garden) => {
    garden.addPlant(plantData);
  }, gardenId);
}

export async function removePlant(plantId, gardenId) {
  return gardenRepository.updateGarden((garden) => {
    garden.removePlant(plantId);
  }, gardenId);
}

export async function updatePlant(plantId, updates, gardenId) {
  return gardenRepository.updateGarden((garden) => {
    garden.updatePlant(plantId, updates);
  }, gardenId);
}

export async function updateCoins(amount, gardenId) {
  return gardenRepository.updateGarden((garden) => {
    garden.updateCoins(amount);
  }, gardenId);
}

export async function getPlant(plantId, gardenId) {
  const garden = await loadGarden(gardenId);
  return garden.plants.find(plant => plant.id === plantId) || null;
}

export function getPlantsAtTile(gardenOrTileX, tileXOrTileY, maybeTileY) {
  if (gardenOrTileX instanceof Garden || Array.isArray(gardenOrTileX?.plants)) {
    const garden = gardenOrTileX instanceof Garden ? gardenOrTileX : new Garden(gardenOrTileX);
    return garden.getPlantsAtTile(tileXOrTileY, maybeTileY);
  }

  return loadGarden().then(garden => garden.getPlantsAtTile(gardenOrTileX, tileXOrTileY));
}

export function createPlant(type, tileX, tileY, totalFocusMinutes = 0, options = {}) {
  return Plant.create(type, tileX, tileY, totalFocusMinutes, options).serialize();
}

export default {
  loadGarden,
  saveGarden,
  addPlant,
  removePlant,
  updatePlant,
  updateCoins,
  getPlant,
  getPlantsAtTile,
  createPlant
};
