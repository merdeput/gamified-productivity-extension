/**
 * gardenAnimals.js
 *
 * Manages all wandering animals in the garden view.
 * Starts a single requestAnimationFrame loop that ticks every animal.
 *
 * Usage:
 *   import { GardenAnimals } from './gardenAnimals.js';
 *  minX: mapPixelWidth * 0.25,
  maxX: mapPixelWidth * 0.75 - fs,

  minY: mapPixelHeight * 0.25,
  maxY: mapPixelHeight * 0.75 - fs,
 *   const mgr = new GardenAnimals(plantLayer, mapDimensions, baseUrl);
 *   mgr.spawnFrog();          // or mgr.spawnAnimal('frog')
 *   // later:
 *   mgr.destroy();
 *
 * To add a new animal (cat, dog …):
 *   1. Create a class in cat.js extending AnimalSprite (same pattern as frog.js).
 *   2. Import it here and add an entry to ANIMAL_REGISTRY.
 *   3. Call mgr.spawnAnimal('cat') — done.
 */

import { Frog } from './frog.js';

// ─── Registry — add new animals here ─────────────────────────────────────────

const ANIMAL_REGISTRY = {
  frog: (baseUrl) => new Frog(baseUrl),
  // cat: (baseUrl) => new Cat(baseUrl),
  // dog: (baseUrl) => new Dog(baseUrl),
};

// ─── GardenAnimals ───────────────────────────────────────────────────────────

export class GardenAnimals {
  /**
   * @param {HTMLElement} container    – the plant/overlay layer to render animals into
   * @param {Object}      mapDims      – { width, height, tileWidth, tileHeight }
   * @param {string}      baseUrl      – chrome.runtime.getURL('assets/')
   */
  constructor(container, mapDims, baseUrl) {
    this.container = container;
    this.baseUrl   = baseUrl;
    this.animals   = [];
    this._rafId    = null;
    this._lastTime = null;

    // Calculate walkable pixel bounds (leave a 1-tile margin)
    const tw = mapDims.tileWidth  || 32;
    const th = mapDims.tileHeight || 32;
    const fs = 32; // animal sprite size

    const mapPixelWidth  = mapDims.width * tw;
    const mapPixelHeight = mapDims.height * th;

    this.bounds = {
      minX: mapPixelWidth * 0.25,
      maxX: mapPixelWidth * 0.75 - fs,
      minY: th,
      maxY: mapDims.height * th - th - fs,
    };
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Convenience: spawn the default frog mascot */
  spawnFrog() {
    return this.spawnAnimal('frog');
  }

  /**
   * Spawn any registered animal at a random position.
   * @param {string} type  – key in ANIMAL_REGISTRY
   * @returns {AnimalSprite|null}
   */
  spawnAnimal(type) {
    const factory = ANIMAL_REGISTRY[type];
    if (!factory) {
      console.warn(`[GardenAnimals] Unknown animal type: "${type}"`);
      return null;
    }

    const animal = factory(this.baseUrl);

    // Random spawn position within bounds
    const sx = this.bounds.minX + Math.random() * (this.bounds.maxX - this.bounds.minX);
    const sy = this.bounds.minY + Math.random() * (this.bounds.maxY - this.bounds.minY);

    animal.mount(this.container, sx, sy);
    this.animals.push(animal);

    // Start the RAF loop if not running
    if (!this._rafId) this._startLoop();

    return animal;
  }

  /** Remove all animals and stop the loop */
  destroy() {
    this._stopLoop();
    this.animals.forEach(a => a.unmount());
    this.animals = [];
  }

  // ─── RAF loop ──────────────────────────────────────────────────────────────

  _startLoop() {
    const tick = (timestamp) => {
      if (this._lastTime === null) this._lastTime = timestamp;
      const dt = Math.min(timestamp - this._lastTime, 100); // cap at 100 ms
      this._lastTime = timestamp;

      for (const animal of this.animals) {
        animal.update(dt, this.bounds);
      }

      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _stopLoop() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId    = null;
      this._lastTime = null;
    }
  }
}
