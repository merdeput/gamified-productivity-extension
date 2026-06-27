import { getState, saveState } from '../storage.js';
import { DEFAULT_GARDEN_ID, Garden } from './gardenModel.js';
import { gardenDefinitionRegistry } from './gardenDefinitions.js';

export class GardenRepository {
  constructor(options = {}) {
    this.defaultGardenId = options.defaultGardenId || DEFAULT_GARDEN_ID;
    this.getState = options.getState || getState;
    this.saveState = options.saveState || saveState;
  }

  async loadGarden(gardenId = this.defaultGardenId) {
    const state = await this.getState();
    return this.loadGardenFromState(state, gardenId);
  }

  async loadActiveGarden() {
    const state = await this.getState();
    return this.loadGardenFromState(state, state.activeGardenId || this.defaultGardenId);
  }

  async listGardens() {
    const state = await this.getState();
    return gardenDefinitionRegistry.list().map(definition => {
      const garden = this.loadGardenFromState(state, definition.id);
      return {
        ...definition,
        unlocked: garden.unlocked,
        plantCount: garden.plants.length
      };
    });
  }

  async setActiveGarden(gardenId) {
    gardenDefinitionRegistry.require(gardenId);
    const state = await this.getState();
    const garden = this.loadGardenFromState(state, gardenId);

    if (!garden.unlocked) {
      throw new Error(`${garden.name} is locked`);
    }

    const nextState = {
      ...state,
      activeGardenId: gardenId
    };

    await this.saveState(nextState);
    return garden;
  }

  async purchaseGarden(gardenId) {
    const definition = gardenDefinitionRegistry.require(gardenId);
    const state = await this.getState();
    const walletGarden = this.loadGardenFromState(state, this.defaultGardenId);
    const garden = this.loadGardenFromState(state, gardenId);

    if (garden.unlocked) {
      return garden;
    }

    if (walletGarden.coins < definition.price) {
      throw new Error(`Not enough coins! Need ${definition.price}, have ${walletGarden.coins}.`);
    }

    walletGarden.spendCoins(definition.price);
    garden.unlocked = true;
    garden.coins = walletGarden.coins;

    const gardens = {
      ...(state.gardens || {}),
      [this.defaultGardenId]: walletGarden.serialize(),
      [gardenId]: garden.serialize()
    };

    const nextState = {
      ...state,
      gardens,
      garden: this.toLegacyGarden(walletGarden.serialize()),
      activeGardenId: gardenId
    };

    await this.saveState(nextState);
    return garden;
  }

  loadGardenFromState(state, gardenId = this.defaultGardenId) {
    const gardens = state.gardens || null;
    const definition = gardenDefinitionRegistry.require(gardenId);
    const gardenData = gardens?.[gardenId] || (gardenId === this.defaultGardenId ? state.garden : null);
    const normalizedGardenData = gardenId === this.defaultGardenId
      ? gardenData
      : { ...(gardenData || {}), coins: state.garden?.coins || 0 };

    return Garden.fromState(normalizedGardenData || {}, {
      id: gardenId,
      name: definition.name,
      layoutId: definition.id,
      mapFile: definition.mapFile,
      plantLayers: definition.plantLayers,
      theme: definition.theme,
      unlocked: definition.defaultUnlocked,
      plants: gardenId === this.defaultGardenId ? state.garden?.plants || [] : [],
      animals: gardenId === this.defaultGardenId ? state.garden?.animals || [] : [],
      coins: state.garden?.coins || 0
    });
  }

  async saveGarden(garden, gardenId = garden.id || this.defaultGardenId) {
    const state = await this.getState();
    const serializedGarden = garden instanceof Garden ? garden.serialize() : new Garden(garden).serialize();
    const gardens = {
      ...(state.gardens || {}),
      [gardenId]: {
        ...serializedGarden,
        id: gardenId
      }
    };

    const nextState = {
      ...state,
      gardens,
      activeGardenId: gardenId
    };

    nextState.garden = {
      ...this.toLegacyGarden(state.garden || {}),
      coins: Math.max(0, Number(serializedGarden.coins || 0))
    };

    if (gardenId === this.defaultGardenId) {
      nextState.garden.plants = serializedGarden.plants;
      nextState.garden.animals = serializedGarden.animals;
    }

    nextState.gardens[this.defaultGardenId] = {
      ...(nextState.gardens[this.defaultGardenId] || {}),
      coins: nextState.garden.coins
    };

    await this.saveState(nextState);
    return this.loadGardenFromState(nextState, gardenId);
  }

  async updateGarden(mutator, gardenId = this.defaultGardenId) {
    const garden = await this.loadGarden(gardenId);
    const result = await mutator(garden);
    await this.saveGarden(garden, gardenId);
    return result === undefined ? garden : result;
  }

  toLegacyGarden(garden) {
    return {
      plants: Array.isArray(garden?.plants) ? garden.plants : [],
      animals: Array.isArray(garden?.animals) ? garden.animals : [],
      coins: Math.max(0, Number(garden?.coins || 0))
    };
  }
}

export const gardenRepository = new GardenRepository();

export default gardenRepository;
