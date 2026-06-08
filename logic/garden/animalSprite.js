/**
 * animalSprite.js
 *
 * Base class for all garden animals.
 * Handles sprite sheet rendering, directional animation, and DOM management.
 *
 * Sprite sheet convention:
 *   - Each STATE has its own file: assets/animal/<name>/<name>_<state>.png
 *   - Each file is a horizontal strip: [stateFrameCount * 8] columns × 8 rows
 *     (8 directions, each direction occupies one ROW)
 *   - Each frame is FRAME_SIZE × FRAME_SIZE px (default 32)
 *   - Direction rows (standard 8-dir, top = row 0):
 *       0 = N, 1 = NE, 2 = E, 3 = SE, 4 = S, 5 = SW, 6 = W, 7 = NW
 */

export const DIRECTION = {
  N:  0,
  NE: 1,
  E:  2,
  SE: 3,
  S:  4,
  SW: 5,
  W:  6,
  NW: 7,
};

// Maps a [dx, dy] movement vector to the closest DIRECTION index
export function vectorToDirection(dx, dy) {
  if (dx === 0 && dy === 0) return DIRECTION.S;
  const angle = Math.atan2(dy, dx); // -π … π  (right = 0)
  // Convert to 0–360 from North clockwise
  let deg = (angle * 180) / Math.PI + 90; // east→south offset
  if (deg < 0) deg += 360;
  // 8 sectors of 45°, offset by half a sector so N is centred at 0
  const sector = Math.round(deg / 45) % 8;
  // sector 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW  ✓
  return sector;
}

/**
 * AnimalSprite – base class
 *
 * @param {Object} config
 * @param {string}   config.name          – animal folder name, e.g. "frog"
 * @param {Object}   config.states        – { stateName: frameCount, … }
 * @param {string[]} config.stateOrder    – cycle order used for wandering
 * @param {number}   [config.frameSize=32]
 * @param {string}   [config.baseUrl]     – chrome.runtime.getURL('assets/') or similar
 */
export class AnimalSprite {
  constructor(config) {
    this.name       = config.name;
    this.states     = config.states;       // { idle: 3, hop: 5, … }
    this.stateOrder = config.stateOrder;   // ['idle', 'hop', …]
    this.frameSize  = config.frameSize || 32;
    this.baseUrl    = config.baseUrl   || '';

    // Runtime state
    this.currentState     = this.stateOrder[0];
    this.currentFrame     = 0;
    this.currentDirection = DIRECTION.S;
    this.x                = 0;   // pixel position (top-left of sprite)
    this.y                = 0;
    this.el               = null; // DOM element
    this._frameTimer      = 0;
    this._frameDuration   = 150; // ms per frame (override per state if needed)
    this._lastTimestamp   = null;
  }

  // ─── DOM ─────────────────────────────────────────────────────────────────────

  /** Create & return the DOM element (does NOT append to document) */
  createElement() {
    const el = document.createElement('div');
    const scale = 1.25;
    el.className = `garden-animal garden-animal--${this.name}`;
    el.style.cssText = `
      position: absolute;
      width: ${this.frameSize}px;
      height: ${this.frameSize}px;
      transform: scale(${scale});
      transform-origin: top left;
      image-rendering: pixelated;
      pointer-events: none;
      z-index: 10;
    `;
    this.el = el;
    this._applySprite();
    return el;
  }

  /** Attach to a parent container at position (px, py) */
  mount(parent, px, py) {
    this.x = px;
    this.y = py;
    if (!this.el) this.createElement();
    this._applyPosition();
    parent.appendChild(this.el);
  }

  unmount() {
    this.el?.remove();
    this.el = null;
  }

  // ─── Sprite helpers ───────────────────────────────────────────────────────────

  _spriteUrl(state) {
    return `${this.baseUrl}animal/${this.name}/${this.name}_${state}.png`;
  }

  _applySprite() {
    if (!this.el) return;
    const state      = this.currentState;
    const frameCount = this.states[state] || 1;
    const url        = this._spriteUrl(state);
    const fw         = this.frameSize;

    // Background-size covers the entire sheet: frameCount cols × 8 rows
    this.el.style.backgroundImage    = `url('${url}')`;
    this.el.style.backgroundSize     = `${frameCount * fw}px ${8 * fw}px`;
    this.el.style.backgroundRepeat   = 'no-repeat';
    this._applyFrame();
  }

  _applyFrame() {
    if (!this.el) return;
    const fw  = this.frameSize;
    const col = this.currentFrame;
    const row = this.currentDirection;
    this.el.style.backgroundPosition = `-${col * fw}px -${row * fw}px`;
  }

  _applyPosition() {
    if (!this.el) return;
    this.el.style.left = `${Math.round(this.x)}px`;
    this.el.style.top  = `${Math.round(this.y)}px`;
  }

  // ─── State control ────────────────────────────────────────────────────────────

  setState(state, direction) {
    if (!(state in this.states)) return;
    const changed = state !== this.currentState;
    this.currentState = state;
    if (direction !== undefined) this.currentDirection = direction;
    if (changed) {
      this.currentFrame = 0;
      this._applySprite();
    } else {
      this._applyFrame();
    }
  }

  setDirection(direction) {
    if (direction === this.currentDirection) return;
    this.currentDirection = direction;
    this._applyFrame();
  }

  setPosition(px, py) {
    this.x = px;
    this.y = py;
    this._applyPosition();
  }

  // ─── Animation tick ──────────────────────────────────────────────────────────

  /**
   * Advance the sprite animation by `dt` milliseconds.
   * Call this from your RAF loop.
   * @param {number} dt
   */
  tickAnimation(dt) {
    const frameCount = this.states[this.currentState] || 1;
    this._frameTimer += dt;
    if (this._frameTimer >= this._frameDuration) {
      this._frameTimer -= this._frameDuration;
      this.currentFrame = (this.currentFrame + 1) % frameCount;
      this._applyFrame();
    }
  }

  // ─── Movement / AI hook (override in subclasses) ─────────────────────────────

  /**
   * Update position/state/AI each frame.
   * @param {number} dt          – milliseconds since last frame
   * @param {Object} bounds      – { minX, minY, maxX, maxY } in px (the walkable area)
   */
  // eslint-disable-next-line no-unused-vars
  update(dt, bounds) {
    this.tickAnimation(dt);
  }
}
