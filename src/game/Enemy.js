import { ExtendedObject3D, THREE } from '@enable3d/phaser-extension';
import { GAME_CONSTANTS } from './constants';

export class Enemy extends ExtendedObject3D {
  constructor(scene, id, enemyModel, playerBodyPosition) {
    super();
    this.scene = scene;
    this.id = id;
    this.enemyModel = enemyModel;
    this.playerBodyPosition = playerBodyPosition; // Player's current physics body position
    this.name = id; // Set name for collision detection

    this.create();
  }

  create() {
    const bytes = this.scene.stringToBytes(this.id); // Assuming MainScene has stringToBytes
    const origin = { x: bytes[2], y: bytes[4], z: bytes[6] };
    const initialPos = new THREE.Vector3(origin.x, origin.y, origin.z);

    const enemyMesh = this.enemyModel.scene.clone();
    this.add(enemyMesh);
    this.scale.set(0.5, 0.5, 0.5);
    this.position.copy(initialPos);

    this.scene.third.add.existing(this);
    this.scene.third.physics.add.existing(this, {
      shape: "box",
      width: 5,
      height: 5,
      depth: 15
    });
    // Add to scene's enemies map
    this.scene.enemies[this.id] = this;

    this.applyInitialForce();
    this.setupCollision();
    this.setupLifetime();
  }

  applyInitialForce() {
    const directionToPlayer = new THREE.Vector3().copy(this.playerBodyPosition).sub(this.position).normalize();
    const impulse = directionToPlayer.multiplyScalar(GAME_CONSTANTS.ENEMY_FORCE);
    this.body.applyForce(impulse.x, impulse.y, impulse.z);
  }

  setupCollision() {
    this.body.on.collision((otherObject) => {
      try {
        if (otherObject.name === this.scene.player.name) {
          this.scene.player.respawn();
        }
        this.destroyEnemy();
      } catch (err) {
        console.error("Enemy collision error:", err);
      }
    });
  }

  setupLifetime() {
    this.scene.time.addEvent({
      delay: GAME_CONSTANTS.ENEMY_LIFETIME_MS,
      callback: () => this.destroyEnemy()
    });
  }

  destroyEnemy() {
    try {
      this.scene.third.destroy(this);
      delete this.scene.enemies[this.id];
    } catch (err) {
      // ignore if already destroyed
    }
  }
}