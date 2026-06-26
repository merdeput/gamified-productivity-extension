import { getState, saveState } from '../storage.js';
import { DEFAULT_GARDEN_ID, Garden } from './gardenModel.js';

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

  loadGardenFromState(state, gardenId = this.defaultGardenId) {
    const gardens = state.gardens || null;
    const gardenData = gardens?.[gardenId] || (gardenId === this.defaultGardenId ? state.garden : null);

    return Garden.fromState(gardenData || {}, {
      id: gardenId,
      plants: gardenId === this.defaultGardenId ? state.garden?.plants || [] : [],
      coins: gardenId === this.defaultGardenId ? state.garden?.coins || 0 : 0
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
      activeGardenId: state.activeGardenId || gardenId
    };

    if (gardenId === this.defaultGardenId) {
      nextState.garden = this.toLegacyGarden(serializedGarden);
    }

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
      coins: Math.max(0, Number(garden?.coins || 0))
    };
  }
}

export const gardenRepository = new GardenRepository();

export default gardenRepository;
