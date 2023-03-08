import Phaser from 'phaser';

import {
  enable3d,
  Scene3D,
  ExtendedObject3D,
  THREE,
  FLAT,
  JoyStick,
  ThirdPersonControls,
  PointerLock,
  PointerDrag,
  Canvas,
} from '@enable3d/phaser-extension';
import makeBlockie from 'ethereum-blockies-base64';

import { getAddressInfo, connectWallet,relays } from './utils';
import {
  SimplePool,
  nip19
} from 'nostr-tools'
/**
 * Is touch device?
 */
const isTouchDevice = 'ontouchstart' in window;

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

const delay = ms => new Promise(res => setTimeout(res, ms));

const pool = new SimplePool()

class MainScene extends Scene3D {
  constructor() {
    super({ key: 'MainScene' })
  }

  init() {
    this.accessThirdDimension({ maxSubSteps: 10, fixedTimeStep: 1 / 120 })
    this.third.renderer.outputEncoding = THREE.LinearEncoding
    this.canJump = true
    this.move = false
    this.moveTop = 0
    this.moveRight = 0;
    this.profiles = [];
    this.publickeys = [];
    this.maxProfiles = 100;

  }

  async connect() {
    const newNostrPubKey = await connectWallet();
    const newProfile = await pool.get(relays, {
      authors: [
        newNostrPubKey
      ],
      kinds: [0]
    })
    this.playerProfile = newProfile;
    console.log(newProfile)
    if(this.player){
      this.third.destroy(this.player);
      await this.generatePlayer()
    }
    this.connecting = false;

  }

  async create() {
    const { lights } = await this.third.warpSpeed('-ground', '-orbitControls')

    const { hemisphereLight, ambientLight, directionalLight } = lights
    const intensity = 0.65
    hemisphereLight.intensity = intensity
    ambientLight.intensity = intensity
    directionalLight.intensity = intensity

    this.third.physics.add.box({ y: 10, x: 35 }, { lambert: { color: 'red' } })

    // this.third.physics.debug.enable()

    /**
     * Medieval Fantasy Book by Pixel (https://sketchfab.com/stefan.lengyel1)
     * https://sketchfab.com/3d-models/medieval-fantasy-book-06d5a80a04fc4c5ab552759e9a97d91a
     * Attribution 4.0 International (CC BY 4.0)
     */
    this.third.load.gltf('/assets/gltf/scene.gltf').then(object => {
      const scene = object.scenes[0]

      const book = new ExtendedObject3D()
      book.name = 'scene'
      book.add(scene)
      this.third.add.existing(book)

      // add animations
      // sadly only the flags animations works
      object.animations.forEach((anim, i) => {
        book.mixer = this.third.animationMixers.create(book)
        // overwrite the action to be an array of actions
        book.action = []
        book.action[i] = book.mixer.clipAction(anim)
        book.action[i].play()
      })

      book.traverse(child => {
        if (child.isMesh) {
          child.castShadow = child.receiveShadow = false
          child.material.metalness = 0
          child.material.roughness = 1
          this.third.physics.add.existing(child, {
            shape: 'concave',
            mass: 0,
            collisionFlags: 1,
            autoCenter: false
          })
          child.body.setAngularFactor(0, 0, 0)
          child.body.setLinearFactor(0, 0, 0)
        }
      })
    })




    await this.generatePlayer();
    // set initial view to 90 deg theta
    this.controls.theta = 90;
    /**
     * Add Pointer Lock and Pointer Drag
     */
    if (!isTouchDevice) {
      let pl = new PointerLock(this.game.canvas)
      let pd = new PointerDrag(this.game.canvas)
      pd.onMove(delta => {
        if (pl.isLocked()) {
          this.moveTop = -delta.y
          this.moveRight = delta.x
        }
      })
    }
    /**
     * Add Keys
     */
    this.keys = {
      a: this.input.keyboard.addKey('a'),
      w: this.input.keyboard.addKey('w'),
      d: this.input.keyboard.addKey('d'),
      s: this.input.keyboard.addKey('s'),
      e: this.input.keyboard.addKey('e'),
      c: this.input.keyboard.addKey('c'),
      space: this.input.keyboard.addKey(32)
    }

    /**
     * Add joystick
     */
    if (isTouchDevice) {
      const joystick = new JoyStick()
      const axis = joystick.add.axis({
        styles: { left: 35, bottom: 35, size: 100 }
      })
      axis.onMove(event => {
        /**
         * Update Camera
         */
        const { top, right } = event
        this.moveTop = top * 3
        this.moveRight = right * 3
      })
      const buttonA = joystick.add.button({
        letter: 'A',
        styles: { right: 35, bottom: 110, size: 80 }
      })
      buttonA.onClick(() => this.jump())
      const buttonB = joystick.add.button({
        letter: 'B',
        styles: { right: 110, bottom: 35, size: 80 }
      })
      buttonB.onClick(() => (this.move = true))
      buttonB.onRelease(() => (this.move = false))
    }

    // Add nostr profiles to populate
    let events = await pool.list(relays, [{kinds: [0]}])

    for(let i = 0; i < events.length; i++){
      try{
        if(this.profiles.length >= this.maxProfiles){
          break
        }
        let info = {
          x: getRandomInt(30) - getRandomInt(30),
          z: getRandomInt(30) - getRandomInt(30),
          profile: events[i]
        }
        await this.addProfile(info);
        await delay(2000)
      } catch(err){
        console.log(err)
      }
    }
  }
  async generatePlayer(){
    /**
      * Create Player
    */
    // create text texture
    let playerName = "Guest "+getRandomInt(10000);
    let content;
    if(this.playerProfile){
      content = JSON.parse(this.playerProfile.profile.content);
      playerName = content.name ? content.name : content.display_name ? content.display_name : this.playerProfile.profile.pubkey
    }
    let texture = new FLAT.TextTexture(playerName);
    // texture in 3d space
    const sprite3d = new FLAT.TextSprite(texture)
    sprite3d.setScale(0.003)
    this.player = new THREE.Group();
    this.player.name = playerName
    let playerImg
    if(!this.playerProfile){
      playerImg = await this.third.load.texture("https://ipfs.io/ipfs/QmeVRmVLPqUNZUKERq14uXPYbyRoUN7UE8Sha2Q4rT6oyF");
    } else {
      playerImg = content.picture ? content.picture : makeBlockie(this.playerProfile.profile.pubkey)
    }
    const material = new THREE.SpriteMaterial( { map: playerImg } );
    const sprite = new THREE.Sprite( material );

    sprite.position.y = 0.2;
    sprite3d.position.y = 0.8;
    this.player.rotateY(Math.PI + 0.1) // a hack

    this.player.add(sprite)
    this.player.add(sprite3d);
    this.player.position.set(getRandomInt(10)- getRandomInt(20), 10, getRandomInt(10) - getRandomInt(20))
    this.player.scale.set(0.25,0.25,0.25);

    /**
     * Add the player to the scene with a body
     */

    this.third.physics.add.existing(this.player,{shape:"box"})
    this.third.add.existing(this.player);
    this.player.body.setFriction(0.8)
    this.player.body.setAngularFactor(0, 0, 0);
    /**
     * Add 3rd Person Controls
     */
    this.controls = new ThirdPersonControls(this.third.camera, this.player, {
      offset: new THREE.Vector3(0, 0.2, 0),
      targetRadius: 2
    });
  }
  async addProfile(info){
    const content = JSON.parse(info.profile.content);
    if(this.publickeys[content.name ? content.name : content.display_name ? content.display_name : info.profile.pubkey]) return;
    this.publickeys[content.name] = true;
    let metadata;
    if(!content.name && !content.display_name){
      return;
    }
    console.log(`${content.display_name ? content.display_name : content.name} at ${info.x},${info.z}`)
    console.log(info)
    try{
      metadata = {
        name: content.display_name ? content.display_name : content.name ? content.name : info.profile.pubkey,
        description: content.about,
        image: content.picture ?
          content.picture :
          makeBlockie(info.profile.pubkey),
        external_url: content.website
      }

      // create text texture
      let text = `${metadata.name}`;
      let texture = new FLAT.TextTexture(`${text}`,{color: "blue"});
      // texture in 3d space
      let sprite3d = new FLAT.TextSprite(texture)
      sprite3d.position.y = 1.2;
      sprite3d.setScale(0.0025);
      let image;
      var loader = new THREE.TextureLoader();

      loader.setCrossOrigin('anonymous')
      try{
        image = await loader.load(metadata.image);
      } catch(err){
        image = makeBlockie(info.profile.pubkey);
      }
      const textureCube = this.third.misc.textureCube([image,image,image,image,image,image])
      const body = this.third.add.box({
        width: 0.5,
        height: 0.3,
        depth: 0.5
      }, {
        custom: textureCube.materials,
        mass: 10000
      });
      body.add(sprite3d);
      if(metadata.description){
        text = `${metadata.description}`;
        texture = new FLAT.TextTexture(`${text}`);

        // texture in 3d space
        sprite3d = new FLAT.TextSprite(texture)
        sprite3d.position.y = 0.8;
        sprite3d.setScale(0.001);
        body.add(sprite3d);
      }
      body.position.set(info.x,20,info.z)
      this.third.physics.add.existing(body);
      this.third.add.existing(body)
      this.third.physics.add.collider(body, this.player, async event => {
        if(this.keys.e.isDown){
          if(info.profile.pubkey){
            let yes = window.confirm(`Open https://iris.to/${nip19.npubEncode(info.profile.pubkey)} in a new tab?` );
            if(yes) {
              window.open(`https://iris.to/${nip19.npubEncode(info.profile.pubkey)}`,"_blank")
            }
          }
        }
      });
    } catch(err){
      console.log(err)
    }
  }

  jump() {
    if (!this.player || !this.canJump) return
    this.canJump = false;
    this.time.addEvent({
      delay: 1000,
      callback: () => {
        this.canJump = true
      }
    })
    this.player.body.applyForceY(6)
  }

  update(time, delta) {
    if (this.player && this.player.body) {
      /**
       * Update Controls
       */
      this.controls.update(this.moveRight * 2, -this.moveTop * 2)
      if (!isTouchDevice) this.moveRight = this.moveTop = 0
      /**
       * Player Turn
       */
      const speed = 4
      const v3 = new THREE.Vector3()

      const rotation = this.third.camera.getWorldDirection(v3)
      const theta = Math.atan2(rotation.x, rotation.z)
      const rotationMan = this.player.getWorldDirection(v3)
      const thetaMan = Math.atan2(rotationMan.x, rotationMan.z)
      this.player.body.setAngularVelocityY(0)

      const l = Math.abs(theta - thetaMan)
      let rotationSpeed = isTouchDevice ? 2 : 4
      let d = Math.PI / 24

      if (l > d) {
        if (l > Math.PI - d) rotationSpeed *= -1
        if (theta < thetaMan) rotationSpeed *= -1
        this.player.body.setAngularVelocityY(rotationSpeed)
      }

      /**
       * Player Move
       */
      if (this.keys.w.isDown || this.move) {


        const x = Math.sin(theta) * speed,
          y = this.player.body.velocity.y,
          z = Math.cos(theta) * speed

        this.player.body.setVelocity(x, y, z)
      }

      /**
       * Player Jump
       */
      if (this.keys.space.isDown && this.canJump) {
        this.jump()
      }

      if(window.nostr && !window.nostr?.enabled && this.keys.c.isDown && !this.connecting){
        this.connecting = true;
        this.connect();

      }
    }
  }
}

const config = {
  type: Phaser.WEBGL,
  transparent: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth * Math.max(1, window.devicePixelRatio / 2),
    height: window.innerHeight * Math.max(1, window.devicePixelRatio / 2)
  },
  scene: [MainScene],
  ...Canvas({ antialias: false })
}

let init = false;
const Game3D =  () => {
  if(!init){
    enable3d(() => new Phaser.Game(config)).withPhysics('/lib/ammo');
    init = true;
  }
  return null
}
export default Game3D
