import {
    ExtendedObject3D,
    THREE,
    FLAT,
    ThirdPersonControls
} from '@enable3d/phaser-extension';
import { nip19 } from 'nostr-tools';
import makeBlockie from 'ethereum-blockies-base64';
import { GAME_CONSTANTS } from './constants';

export class Player extends ExtendedObject3D {
    constructor(scene, playerProfile, shipModel, defaultImageTexture) {
        super();
        this.scene = scene;
        this.playerProfile = playerProfile;
        this.shipModel = shipModel;
        this.defaultImageTexture = defaultImageTexture;

        this.playerName = "Spectator " + Math.floor(Math.random() * 1000);
        this.profileContent = {};

        this.controls = null;
        this.currentLinearVelocity = new THREE.Vector3(); // To store Ammo.js linear velocity
    }

    async create() {
        // Parse player profile content
        if (this.playerProfile && this.playerProfile.content) {
            try {
                this.profileContent = JSON.parse(this.playerProfile.content);
                this.playerName = this.profileContent.name || this.profileContent.display_name || nip19.npubEncode(this.playerProfile.pubkey);
            } catch (err) {
                console.error("Failed to parse player profile content:", err);
                this.playerName = nip19.npubEncode(this.playerProfile.pubkey);
            }
        } else if (this.playerProfile && this.playerProfile.pubkey) {
            this.playerName = nip19.npubEncode(this.playerProfile.pubkey);
        }

        // Name texture
        const nameTexture = new FLAT.TextTexture(this.playerName);
        const nameSprite3d = new FLAT.TextSprite(nameTexture);
        nameSprite3d.setScale(0.003);
        nameSprite3d.position.y = -0.5;
        this.add(nameSprite3d);

        // Profile picture circle
        let playerImgTexture = this.defaultImageTexture;
        if (this.profileContent.picture) {
            try {
                const loader = new THREE.TextureLoader();
                loader.setCrossOrigin('anonymous'); // CRITICAL FOR CORS
                playerImgTexture = await loader.load(this.profileContent.picture.replace("nostr.build/i/", "image.nostr.build/"));
            } catch (err) {
                console.error("Failed to load player profile picture, attempting makeBlockie:", err);
                if (this.playerProfile && this.playerProfile.pubkey) {
                    playerImgTexture = await this.scene.third.load.texture(makeBlockie(nip19.npubEncode(this.playerProfile.pubkey)));
                } else {
                    console.warn("No pubkey available for makeBlockie fallback.");
                }
            }
        } else if (this.playerProfile && this.playerProfile.pubkey) {
            // Fallback to makeBlockie if no picture URL or parsing failed
            playerImgTexture = await this.scene.third.load.texture(makeBlockie(nip19.npubEncode(this.playerProfile.pubkey)));
        }

        const circleMaterial = new THREE.MeshBasicMaterial({
            map: playerImgTexture,
            side: THREE.DoubleSide,
            transparent: true
        });
        const circleGeometry = new THREE.CircleGeometry(0.5, 32);
        const profileCircle = new THREE.Mesh(circleGeometry, circleMaterial);
        profileCircle.position.y = -0.1;
        profileCircle.scale.set(0.5, 0.5, 0.5);
        this.add(profileCircle);

        // Ship model
        const shipMesh = this.shipModel.scene.clone();
        shipMesh.scale.set(0.005, 0.005, 0.005);
        shipMesh.position.y = -1;
        shipMesh.rotateY(Math.PI + 0.1);
        this.add(shipMesh);

        this.scale.set(0.25, 0.25, 0.25);
        this.rotateY(Math.PI + 0.1);

        this.name = `player_${this.playerProfile.pubkey}`;

        this.scene.third.add.existing(this);

        this.scene.third.physics.add.existing(this, {
            shape: "box",
            height: 1,
            width: 1,
            depth: 1
        });
        this.body.setFriction(0.8);
        this.body.setAngularFactor(0, 0, 0); // Prevent rotation around X, Z axes

        this.respawn();

        // Initialize ThirdPersonControls for *this* player
        this.controls = new ThirdPersonControls(this.scene.third.camera, this, {
            offset: new THREE.Vector3(0, 0.2, 0),
            targetRadius: 2,
        });

        // Set initial camera angles for ThirdPersonControls
        this.controls.theta = 90;
        this.controls.phi = 0; // Look horizontally initially

        console.log(`Player ${this.playerName} created and added to scene.`);
    }

    destroyPlayer() {
        if (this.body) {
            this.scene.third.physics.destroy(this);
        }
        this.scene.third.remove(this);
        this.destroy(); // Destroy the ExtendedObject3D itself
        console.log(`Player ${this.playerName} destroyed.`);
    }

    respawn() {
        const pubkey = this.playerProfile.pubkey;
        const base = this.scene.profiles[pubkey];
        if (base) {
            this.position.set(base.position.x, base.position.y + 5, base.position.z);
        } else {
            this.position.set(
                GAME_CONSTANTS.INITIAL_SPAWN_X + (Math.random() * 20 - 10),
                GAME_CONSTANTS.INITIAL_SPAWN_Y + (Math.random() * 20 - 10),
                GAME_CONSTANTS.INITIAL_SPAWN_Z + (Math.random() * 20 - 10)
            );
        }
        if (this.body) {
            this.body.setVelocity(0, 0, 0);
            this.body.setAngularVelocity(0, 0, 0);
            this.body.needUpdate = true;
            this.body.setCollisionFlags(1); // Set to kinematic temporarily to allow direct position set
            this.body.setCollisionFlags(0); // Reset to dynamic
        }
    }

    updateControls(moveRight, moveTop) {
        if (this.controls) {
            this.controls.update(moveRight * 2, -moveTop * 2);
        }
    }

    updatePositionAndVelocity(position, velocity) {
        if (this.body) {
            this.body.needUpdate = true;
            this.body.setCollisionFlags(1); // Temporarily kinematic
            this.position.set(position.x, position.y, position.z);
            this.body.setVelocity(velocity.x, velocity.y, velocity.z);
            this.body.setCollisionFlags(0); // Back to dynamic
        } else {
            this.position.set(position.x, position.y, position.z);
        }
    }

    updateMovement(speed, keys, moveFlag) {
        if (!keys || !this.body) {
            return;
        }

        // Get current Ammo.js linear velocity
        const ammoVelocity = this.body.ammo.getLinearVelocity();
        this.currentLinearVelocity.set(ammoVelocity.x(), ammoVelocity.y(), ammoVelocity.z());

        const forward = new THREE.Vector3();
        this.scene.third.camera.getWorldDirection(forward); // Get direction camera is looking
        forward.y = 0; // Keep movement horizontal
        forward.normalize();

        const right = new THREE.Vector3();
        right.setFromMatrixColumn(this.scene.third.camera.matrix, 0); // Get camera's right vector
        right.y = 0; // Keep movement horizontal
        right.normalize();

        let desiredVelocityX = 0;
        let desiredVelocityZ = 0;
        const baseSpeed = speed;

        if (keys.w.isDown || moveFlag) {
            desiredVelocityX += forward.x * baseSpeed;
            desiredVelocityZ += forward.z * baseSpeed;
        }
        if (keys.s.isDown) {
            desiredVelocityX -= forward.x * baseSpeed;
            desiredVelocityZ -= forward.z * baseSpeed;
        }
        if (keys.a.isDown) {
            desiredVelocityX -= right.x * baseSpeed;
            desiredVelocityZ -= right.z * baseSpeed;
        }
        if (keys.d.isDown) {
            desiredVelocityX += right.x * baseSpeed;
            desiredVelocityZ += right.z * baseSpeed;
        }

        const desiredMovementVector = new THREE.Vector3(desiredVelocityX, 0, desiredVelocityZ);

        if (desiredMovementVector.lengthSq() > 0.01) { // Apply movement if there's a significant desired velocity
            this.body.setVelocity(desiredMovementVector.x, this.currentLinearVelocity.y, desiredMovementVector.z);
        } else {
            // Apply damping when no movement keys are pressed to gradually stop
            this.body.setVelocity(
                this.currentLinearVelocity.x * 0.9, // Damp X
                this.currentLinearVelocity.y,
                this.currentLinearVelocity.z * 0.9  // Damp Z
            );
        }
    }

    getShootRaycasterData() {
        const raycaster = new THREE.Raycaster();
        // Raycast from the center of the camera's view, slightly up to originate from "gun"
        raycaster.setFromCamera({ x: 0, y: 0.3 }, this.scene.third.camera);

        // Get current Ammo.js body velocity
        if (this.body) {
            const ammoVelocity = this.body.ammo.getLinearVelocity();
            this.currentLinearVelocity.set(ammoVelocity.x(), ammoVelocity.y(), ammoVelocity.z());
        }

        return {
            direction: raycaster.ray.direction,
            origin: raycaster.ray.origin,
            velocity: this.currentLinearVelocity.clone() // Return a clone
        };
    }

    getName() {
        return this.playerName;
    }

    getPubKey() {
        return this.playerProfile.pubkey;
    }
}