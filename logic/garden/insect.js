import { AnimalSprite, vectorToDirection } from './animalSprite.js';

export class Insect extends AnimalSprite {
  constructor(baseUrl, definition) {
    super({
      name: definition.id,
      folder: 'insects',
      moveType: definition.moveType || 'fly',
      states: { fly: 4 },
      stateOrder: ['fly'],
      frameWidth: definition.frameWidth || 16,
      frameHeight: definition.frameHeight || 16,
      directionRows: 1,
      fileNames: { fly: definition.fileName },
      renderScale: definition.renderScale || 1.15,
      baseUrl
    });

    this.definition = definition;
    this._frameDuration = 110 + Math.random() * 45;
    this._turnTimer = 0;
    this._turnDur = 500 + Math.random() * 1000;
    this._speed = 18 + Math.random() * 22;
    this._vx = 0;
    this._vy = 0;
    this._pickDirection();
  }

  update(dt, bounds) {
    this.tickAnimation(dt);
    this._turnTimer += dt;

    if (this._turnTimer >= this._turnDur) {
      this._pickDirection();
    }

    const wobble = Math.sin(performance.now() / 240 + this.x * 0.07) * 0.35;
    const nx = this.x + (this._vx + wobble * 0.2) * this._speed * (dt / 1000);
    const ny = this.y + (this._vy + wobble) * this._speed * (dt / 1000);
    const canMove = bounds.isPositionAllowed
      ? bounds.isPositionAllowed(nx, ny, this.frameWidth, this.frameHeight, this.moveType)
      : nx >= bounds.minX && nx <= bounds.maxX && ny >= bounds.minY && ny <= bounds.maxY;

    if (canMove) {
      this.setPosition(nx, ny);
      this.setDirection(vectorToDirection(this._vx, this._vy));
    } else {
      this._pickDirection();
    }
  }

  _pickDirection() {
    const angle = Math.random() * Math.PI * 2;
    this._vx = Math.cos(angle);
    this._vy = Math.sin(angle);
    this._turnTimer = 0;
    this._turnDur = 450 + Math.random() * 1400;
  }
}

export default Insect;
