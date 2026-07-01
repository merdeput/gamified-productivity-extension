import { AnimalSprite, DIRECTION, vectorToDirection } from './animalSprite.js';
import { CAT_DEFINITION } from './animalDefinitions.js';

const STATE_DURATIONS = {
  idle: () => 1200 + Math.random() * 2200,
  walk: () => 1400 + Math.random() * 2600
};

export class Cat extends AnimalSprite {
  constructor(baseUrl) {
    super({
      name: CAT_DEFINITION.id,
      folder: CAT_DEFINITION.folder,
      moveType: CAT_DEFINITION.moveType,
      states: CAT_DEFINITION.states,
      stateOrder: ['idle', 'walk'],
      frameWidth: CAT_DEFINITION.frameWidth,
      frameHeight: CAT_DEFINITION.frameHeight,
      directionRows: 1,
      fileNames: CAT_DEFINITION.fileNames,
      baseUrl
    });

    this._stateTimer = 0;
    this._stateDur = STATE_DURATIONS.idle();
    this._vx = 0;
    this._vy = 0;
    this._frameDuration = 130;
    this.setState('idle', DIRECTION.S);
  }

  update(dt, bounds) {
    this._stateTimer += dt;
    this.tickAnimation(dt);

    if (this.currentState === 'walk') {
      const speed = 40;
      const nx = this.x + this._vx * speed * (dt / 1000);
      const ny = this.y + this._vy * speed * (dt / 1000);
      const canMove = bounds.isPositionWalkable
        ? bounds.isPositionWalkable(nx, ny, this.frameWidth, this.frameHeight)
        : !this._checkBorder(nx, ny, bounds);

      if (canMove) {
        this.setPosition(nx, ny);
      } else {
        this._enterState('idle');
      }
    }

    if (this._stateTimer >= this._stateDur) {
      this._enterState(this.currentState === 'idle' ? 'walk' : 'idle');
    }
  }

  _enterState(state) {
    this._stateTimer = 0;
    this._stateDur = STATE_DURATIONS[state]();

    if (state === 'walk') {
      const angle = Math.random() * Math.PI * 2;
      this._vx = Math.cos(angle);
      this._vy = Math.sin(angle);
      this.flipX = this._vx < 0;
      this.setState('walk', vectorToDirection(this._vx, this._vy));
      return;
    }

    this._vx = 0;
    this._vy = 0;
    this.setState('idle');
  }

  _checkBorder(nx, ny, bounds) {
    return nx < bounds.minX || nx > bounds.maxX || ny < bounds.minY || ny > bounds.maxY;
  }
}

export default Cat;
