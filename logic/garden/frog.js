/**
 * frog.js
 *
 * Frog animal – wanders the garden using a simple state-machine AI.
 *
 * States & frame counts:
 *   idle  – 3  frames
 *   croak – 4  frames
 *   hop   – 5  frames
 *   jump  – 4  frames
 *   shock – 5  frames
 *
 * Each sprite sheet row = one of the 8 directions (N, NE, E, SE, S, SW, W, NW).
 */

import { AnimalSprite, vectorToDirection, DIRECTION } from './animalSprite.js';

// ─── Frog-specific constants ──────────────────────────────────────────────────

const FROG_STATES = {
  idle:  3,
  croak: 4,
  hop:   5,
  jump:  4,
  shock: 5,
};

// AI behaviour weights: how many "ticks" each state lasts
const STATE_DURATIONS = {
  idle:  () => 1500 + Math.random() * 2000,  // stand still 1.5–3.5 s
  croak: () =>  800 + Math.random() *  800,  // croak 0.8–1.6 s
  hop:   () =>  600 + Math.random() *  800,  // short hop 0.6–1.4 s
  jump:  () =>  400 + Math.random() *  800,  // quick jump 0.4–1.0 s
  shock: () =>  500 + Math.random() *  500,  // shock (border bounce) ~0.5–1 s
};

// Movement speed in px/s per state
const MOVE_SPEEDS = {
  idle:  0,
  croak: 0,
  hop:   50,
  jump:  60,
  shock: 0,
};

// After shock the frog bounces in the opposite half-circle
const NEXT_STATE_AFTER = {
  idle:  ['hop', 'hop', 'croak', 'jump'],
  croak: ['idle', 'idle', 'hop'],
  hop:   ['idle', 'hop', 'jump'],
  jump:  ['idle', 'hop'],
  shock: ['idle', 'hop'],
};

function pickNext(state) {
  const opts = NEXT_STATE_AFTER[state];
  return opts[Math.floor(Math.random() * opts.length)];
}

// ─── Frog class ───────────────────────────────────────────────────────────────

export class Frog extends AnimalSprite {
  /**
   * @param {string} baseUrl  – chrome.runtime.getURL('assets/')
   */
  constructor(baseUrl) {
    super({
      name:       'frog',
      states:     FROG_STATES,
      stateOrder: ['idle', 'hop', 'jump', 'croak', 'shock'],
      frameSize:  32,
      baseUrl,
    });

    // AI state
    this._stateTimer  = 0;
    this._stateDur    = STATE_DURATIONS.idle();
    this._vx          = 0;
    this._vy          = 0;
    this._borderBounce = false;

    // Start idle, facing south
    this.setState('idle', DIRECTION.S);
    this._frameDuration = 130;
  }

  // ─── AI update ──────────────────────────────────────────────────────────────

  update(dt, bounds) {
    this._stateTimer += dt;

    // Advance sprite animation
    this.tickAnimation(dt);

    // Move if the state has velocity
    const speed = MOVE_SPEEDS[this.currentState] || 0;
    if (speed > 0) {
      const nx = this.x + this._vx * speed * (dt / 1000);
      const ny = this.y + this._vy * speed * (dt / 1000);

      // Border check
      const hitBorder = bounds.isPositionWalkable
        ? !bounds.isPositionWalkable(nx, ny, this.frameWidth, this.frameHeight)
        : this._checkBorder(nx, ny, bounds);
      if (hitBorder && !this._borderBounce) {
        this._borderBounce = true;
        this._enterState('shock', this._bounceDirection());
        return;
      }
      this._borderBounce = false;
      this.setPosition(
        Math.max(bounds.minX, Math.min(bounds.maxX, nx)),
        Math.max(bounds.minY, Math.min(bounds.maxY, ny)),
      );
    }

    // State transition
    if (this._stateTimer >= this._stateDur) {
      const next = pickNext(this.currentState);
      this._enterState(next);
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  _enterState(state, forcedDirection) {
    this._stateTimer = 0;
    this._stateDur   = STATE_DURATIONS[state]();

    if (forcedDirection !== undefined) {
      this.setState(state, forcedDirection);
    } else {
      // Pick a random direction for moving states
      if (MOVE_SPEEDS[state] > 0) {
        const dir = Math.floor(Math.random() * 8);
        this.setState(state, dir);
        // Convert direction to velocity unit vector
        [this._vx, this._vy] = this._dirToVector(dir);
      } else {
        this.setState(state);
      }
    }
  }

  _checkBorder(nx, ny, bounds) {
    return (
      nx < bounds.minX || nx > bounds.maxX ||
      ny < bounds.minY || ny > bounds.maxY
    );
  }

  /** When hitting a border, face back toward the interior */
  _bounceDirection() {
    // Invert velocity and pick the closest direction
    return vectorToDirection(-this._vx, -this._vy);
  }

  _dirToVector(dir) {
    const table = [
      [ 0,  1],  // N
      [ 1,  1],  // NE
      [ 1,  0],  // E
      [ 1, -1],  // SE
      [ 0, -1],  // S
      [-1, -1],  // SW
      [-1,  0],  // W
      [-1,  1],  // NW
    ];
    const [x, y] = table[dir] || [0, 1];
    // Normalise diagonals
    const len = Math.sqrt(x * x + y * y);
    return [x / len, y / len];
  }
}
