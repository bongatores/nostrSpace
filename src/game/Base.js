import { ExtendedObject3D, THREE, FLAT } from '@enable3d/phaser-extension';
import { nip19 } from 'nostr-tools';
import makeBlockie from 'ethereum-blockies-base64';

export class Base extends ExtendedObject3D {
  constructor(scene, profile, stationModel) {
    super();
    this.scene = scene;
    this.profile = profile;
    this.stationModel = stationModel;
    this.name = profile.pubkey; // Use pubkey as name for identification

    this.metadata = {};
    this.create();
  }

  async create() {
    try {
      let content = {};
      if (this.profile.content) {
        try {
          content = JSON.parse(this.profile.content);
        } catch (err) {
          console.warn("Failed to parse base profile content:", err);
        }
      }

      this.metadata = {
        name: content.name || content.display_name || nip19.npubEncode(this.profile.pubkey),
        description: content.about,
        image: content.picture || makeBlockie(nip19.npubEncode(this.profile.pubkey)),
      };

      // Name Text
      const nameTexture = new FLAT.TextTexture(`${this.metadata.name}'s base`, { color: "blue" });
      const nameSprite3d = new FLAT.TextSprite(nameTexture);
      nameSprite3d.position.y = 3.2;
      nameSprite3d.setScale(0.0015);
      this.add(nameSprite3d);

      // Description Text
      if (this.metadata.description) {
        const descTexture = new FLAT.TextTexture(this.metadata.description);
        const descSprite3d = new FLAT.TextSprite(descTexture);
        descSprite3d.position.y = 2.8;
        descSprite3d.setScale(0.001);
        this.add(descSprite3d);
      }

      // Profile Image
      let profileImage = this.scene.images[this.profile.pubkey]; // Check scene cache first
      if (!profileImage) {
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin("anonymous");
        try {
          profileImage = await loader.load(this.metadata.image.replace("nostr.build/i/", "image.nostr.build/"));
        } catch (err) {
          console.error("Failed to load base profile image, using blockie:", err);
          profileImage = await loader.load(makeBlockie(this.profile.pubkey));
        }
        this.scene.images[this.profile.pubkey] = profileImage; // Cache in scene
      }

      const spriteMaterial = new THREE.SpriteMaterial({ map: profileImage });
      const profileSprite = new THREE.Sprite(spriteMaterial);
      profileSprite.position.y = 2.6;
      profileSprite.scale.set(0.5, 0.5, 1);
      this.add(profileSprite);

      // Station Model
      const stationMesh = this.stationModel.scene.clone();
      this.add(stationMesh);

      // Add to scene and physics
      this.scene.third.add.existing(this);
      this.scene.third.physics.add.existing(this, {
        collisionFlags: 2, // Static object
        shape: "box",
        height: 5,
        width: 5,
        depth: 5,
      });

      // Add collider interaction with player
      this.scene.third.physics.add.collider(this, this.scene.player, async () => {
        if (this.scene.keys.e.isDown) {
          const confirmOpen = window.confirm(
            `Open https://iris.to/${nip19.npubEncode(this.profile.pubkey)} in a new tab?`
          );
          if (confirmOpen) {
            window.open(`https://iris.to/${nip19.npubEncode(this.profile.pubkey)}`, "_blank");
          }
        }
      });

      this.scene.profiles[this.profile.pubkey] = this; // Store in scene's profiles map

    } catch (err) {
      console.error("Error creating Base object:", err);
    }
  }

  updatePosition(newPos) {
    this.body.needUpdate = true;
    this.position.set(newPos.x, newPos.y, newPos.z);
  }

  // Bases currently don't spin, but if they did, a method here would be good.
  // spin() {
  //   this.rotation.y += 0.005;
  // }
}