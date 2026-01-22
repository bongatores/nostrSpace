import { ExtendedObject3D, THREE } from '@enable3d/phaser-extension';
import { GAME_CONSTANTS } from './constants';

export class Projectile { // Projectiles don't necessarily need to be ExtendedObject3D themselves, just manage their physics body
  constructor(scene, type, data, color = 0x202020) {
    this.scene = scene;
    this.type = type; // 'bullet', 'antimatter', 'blackhole'
    this.data = data; // { direction, origin, velocity } or bytesEvent for Nostr
    this.color = color;
    this.physicsBody = null; // This will hold the ExtendedObject3D returned by physics.add.sphere

    this.create();
  }

  create() {
    const pos = new THREE.Vector3();
    let radius, mass;

    switch (this.type) {
      case 'bullet':
        pos.copy(this.data.direction).add(this.data.origin);
        radius = 0.050;
        mass = 10;
        break;
      case 'antimatter':
        pos.copy(this.data.direction).add(this.data.origin);
        radius = 2.50;
        mass = 10;
        this.color = "#FF0000";
        break;
      case 'blackhole':
        pos.set(this.data.x * 10, this.data.y * 10, this.data.z * 10);
        radius = 15;
        mass = 10000000000000; // Large mass for blackhole
        break;
      default:
        console.warn("Unknown projectile type:", this.type);
        return;
    }

    // physics.add.sphere already returns an ExtendedObject3D that wraps the mesh and physics body
    this.physicsBody = this.scene.third.physics.add.sphere(
      { radius: radius, x: pos.x, y: pos.y, z: pos.z, mass: mass, bufferGeometry: true },
      { phong: { color: this.color } }
    );
    this.physicsBody.name = `${this.type}_${Date.now()}`; // Give it a unique name for identification

    this.applyForce();
    this.setupCollision();
    this.setupLifetime();
  }

  applyForce() {
    const force = GAME_CONSTANTS.BULLET_FORCE; // Shared constant for simplicity

    if (this.type === 'bullet') {
      const impulse = new THREE.Vector3().copy(this.data.direction).multiplyScalar(48 * force);
      // Set initial velocity based on player's velocity
      this.physicsBody.body.setVelocity(this.data.velocity.x, this.data.velocity.y, this.data.velocity.z);
      this.physicsBody.body.applyForce(impulse.x, impulse.y, impulse.z);
    } else if (this.type === 'antimatter') {
      const impulse = new THREE.Vector3().copy(this.data.direction).multiplyScalar(8 * force);
      this.physicsBody.body.applyForce(impulse.x, impulse.y, impulse.z);
    }
    // Blackholes are static or have initial position only, no continuous force usually
  }

  setupCollision() {
    this.physicsBody.body.on.collision((otherObject) => {
      try {
        // Ensure player is valid before calling respawn
        if (this.scene.player && otherObject.name === this.scene.player.name) {
          this.scene.player.respawn();
        }
        this.destroyProjectile();
      } catch (err) {
        console.error(`${this.type} collision error:`, err);
      }
    });
  }

  setupLifetime() {
    let delayMs;
    switch (this.type) {
      case 'bullet':
        delayMs = GAME_CONSTANTS.BULLET_LIFETIME_MS;
        break;
      case 'antimatter':
        delayMs = GAME_CONSTANTS.ANTIMATTER_LIFETIME_MS;
        break;
      default:
        return; // Blackholes might not despawn or have a different mechanic
    }

    this.scene.time.addEvent({
      delay: delayMs,
      callback: () => this.destroyProjectile()
    });
  }

  destroyProjectile() {
    try {
      if (this.physicsBody) {
        this.scene.third.destroy(this.physicsBody);
        this.physicsBody = null; // Clear reference
      }
    } catch (err) {
      // ignore if already destroyed (e.g., by collision)
    }
  }
}