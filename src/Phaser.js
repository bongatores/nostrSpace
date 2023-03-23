import Phaser from 'phaser';
import chroma from "chroma-js";

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
    if(this.player){
      this.third.destroy(this.player);
      await this.generatePlayer()
    }
    this.connecting = false;
    this.connected = true;

  }

  async create() {
    const { lights } = await this.third.warpSpeed('-ground', '-orbitControls')

    const { hemisphereLight, ambientLight, directionalLight } = lights
    const intensity = 0.65
    hemisphereLight.intensity = intensity
    ambientLight.intensity = intensity
    directionalLight.intensity = intensity


    // this.third.physics.debug.enable()

    await this.generateScenario();


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
      k: this.input.keyboard.addKey('k'),
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
    let thread = window.location.href.split("?thread=")[1];

    if(!thread){
      thread = "2c812fcb755d9051c088d964f725ead5386e5d3257fb38f539dab096c384b72c";
    }
    let events = await pool.list(relays, [
      {
        '#e': [thread],
        kinds: [1]
      }
    ])
    const pubkeys = [... new Set(events.map(item => item.pubkey))];
    const profiles = await pool.list(relays,[{
      kinds: [0],
      authors: pubkeys
    },{
      kinds: [0]
    }])
    console.log(profiles)
    for(let i = 0; i < profiles.length; i++){
      try{
        if(this.profiles.length >= this.maxProfiles){
          break
        }
        let info = {
          x: getRandomInt(30)-getRandomInt(30),
          z: getRandomInt(30)-getRandomInt(30),
          profile: profiles[i]
        }
        console.log(info)
        await this.addProfile(info);
        await delay(1000)
      } catch(err){
        console.log(err)
      }
    }
  }

  async generateScenario(){

      // heightmap from https://medium.com/@travall/procedural-2d-island-generation-noise-functions-13976bddeaf9
     const heightmap = await this.third.load.texture('/assets/heightmap/heightmap-island.png')

     // Powered by Chroma.js (https://github.com/gka/chroma.js/)
     const colorScale = chroma
       .scale(['#003eb2', '#0952c6', '#a49463', '#867645', '#3c6114', '#5a7f32', '#8c8e7b', '#a0a28f'])
       .domain([0, 0.025, 0.1, 0.2, 0.25, 0.8, 1.3, 1.45, 1.6])

     const mesh = this.third.heightMap.add(heightmap, { colorScale })
     if (mesh) {
       // we position, scale, rotate etc. the mesh before adding physics to it
       mesh.scale.set(5, 5, 1)
       this.third.physics.add.existing(mesh, { mass: 0 })
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
      content = JSON.parse(this.playerProfile.content);
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
      const loader = new THREE.TextureLoader();

      loader.setCrossOrigin('anonymous')
      playerImg = content.picture ? await loader.load(content.picture) :
                  await this.third.load.texture(makeBlockie(this.playerProfile.profile.pubkey))
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
      const loader = new THREE.TextureLoader();

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
        custom: textureCube.materials
      });
      const material = new THREE.SpriteMaterial( { map: image } );
      const sprite = new THREE.Sprite( material );
      sprite.position.y = 0.4
      sprite.scale.set(0.5,0.5,0.5)
      body.add(sprite3d);
      body.add(sprite);
      if(metadata.description){
        text = `${metadata.description}`;
        texture = new FLAT.TextTexture(`${text}`);

        // texture in 3d space
        sprite3d = new FLAT.TextSprite(texture)
        sprite3d.position.y = 0.8;
        sprite3d.setScale(0.001);
        body.add(sprite3d);
      }
      if(content['nostr-space-pos']){
        console.log(content['nostr-space-pos'])
        body.position.set(JSON.parse(content['nostr-space-pos']).x,20,JSON.parse(content['nostr-space-pos']).z)
      } else {
        body.position.set(info.x,20,info.z)
      }

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

  async keysend(){
    if(!window.webln) return;
    await window.webln.enable();
    const result = await window.webln.keysend({
        destination: "03c9e422da6b3c9a29d65f2c91ff73c36c93d645ce91e125a7a20e1758b42cc309",
        amount: "10",
        customRecords: {
            "message": "Nostr Space Donation!"
        }
    });
    this.keysending = false;

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

      if(window.nostr && this.keys.c.isDown && !this.connecting && !this.connected){
        this.connecting = true;
        this.connect();
      }
      if(window.webln && this.keys.k.isDown && !this.keysending){
        this.keysending = true;
        this.keysend();
      }
      if(this.player.position.y < - 10){
        this.third.physics.destroy(this.player)
        this.player.position.set(getRandomInt(10)- getRandomInt(20), 10, getRandomInt(10) - getRandomInt(20));
        this.third.physics.add.existing(this.player);
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
