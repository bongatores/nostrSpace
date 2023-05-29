import {useEffect,useState} from  'react';
import Phaser from 'phaser';
import chroma from "chroma-js";
import 'websocket-polyfill'

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
import {
  Box,
  Text,
  Modal,
  ModalHeader,
  TextInput,
  Layer,
  Button,
  Tabs,
  Tab
 } from 'grommet';

import makeBlockie from 'ethereum-blockies-base64';

import { getAddressInfo, connectWallet,generateKeys,relays } from './utils';
import {
  SimplePool,
  nip19,
  getEventHash,
  signEvent,
  validateEvent,
  verifySignature,
} from 'nostr-tools';

import {stringToBytes} from 'convert-string';

/**
 * Is touch device?
 */
const isTouchDevice = 'ontouchstart' in window;

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

const delay = ms => new Promise(res => setTimeout(res, ms));

const pool = new SimplePool()

let imgUri;


class MainScene extends Scene3D {
  constructor() {
    super({ key: 'MainScene' });

  }

  init() {
    this.accessThirdDimension({ maxSubSteps: 10, fixedTimeStep: 1 / 120 })
    this.third.renderer.outputEncoding = THREE.LinearEncoding
    this.canJump = true
    this.move = false
    this.moveTop = 0
    this.moveRight = 0;
    this.nostrPubKey = null;
    this.profiles = [];
    this.players = [];
    this.publickeys = [];
    this.textures = [];
    this.images = [];
    this.maxProfiles = 100;
    this.canShoot = true;
  }
  async sendEnteredGameMsg(){
    // Shoot
    let event = {
      kind: 42,
      pubkey: this.nostrPubKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e','6afddc25a8ed486b0c1e6e556077a9eef3e0d7236014b891495ae20d557a2346','wss://relay2.nostrchat.io','root'],
        ['t', 'nostr-space']
      ],
      content: `Just entered the space!`
    }
    event.id = getEventHash(event)
    event = await this.signEvent(event);
    console.log(event)
    let pubs = pool.publish(relays, event)
    pubs.on('ok', (res) => {
      console.log(res);
    });
  }
  async connect() {
    let newNostrPubKey;
    if(window.nostr){
      newNostrPubKey = await connectWallet();
    } else {
      const keys = await generateKeys();
      newNostrPubKey = keys.pk;
      this.sk = keys.sk;
    }
    let newProfile = await pool.get(relays, {
      authors: [
        newNostrPubKey
      ],
      kinds: [0]
    });
    console.log(newProfile)
    if(!newProfile){
      newProfile = {
        pubkey: newNostrPubKey
      }
    }
    this.playerProfile = newProfile;
    this.connecting = false;
    this.connected = true;
    this.nostrPubKey = newNostrPubKey;
    if(this.player){
      this.third.destroy(this.player);
      await this.generatePlayer()
    }
    const imgTab = document.getElementById("addImgTab");
    imgTab.style.display = "flex";
    const nostrInfo = document.getElementById("nostrInfo");
    nostrInfo.style.display = "flex";

    this.time.addEvent({
      delay: 2000,
      callback: () => {
        this.sendEnteredGameMsg();
      }
    });
  }

  async create() {
    const { lights } = await this.third.warpSpeed('-ground', '-orbitControls','-sky')
    const { hemisphereLight, ambientLight, directionalLight } = lights
    const intensity = 0.65
    hemisphereLight.intensity = intensity
    ambientLight.intensity = intensity
    directionalLight.intensity = intensity
    //this.third.physics.setGravity({x: 0, y: 0, z: 0})
    this.third.physics.setGravity(0,0,0)
    // this.third.physics.debug.enable()

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    //await this.generateScenario();


    await this.generatePlayer();



    this.setControls();
    this.subscribeNostrEvents();


  }

  setControls(){
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
      f: this.input.keyboard.addKey('f'),
      e: this.input.keyboard.addKey('e'),
      c: this.input.keyboard.addKey('c'),
      k: this.input.keyboard.addKey('k'),
      i: this.input.keyboard.addKey('i'),
      o: this.input.keyboard.addKey('o'),
      l: this.input.keyboard.addKey('l'),
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
  }
  respawn(){
    const base = this.profiles[this.nostrPubKey]
    if(base){
      this.player.position.set(base.position.x, base.position.y, base.position.z)
    } else {
      this.player.position.set(
        700 + (getRandomInt(10) - getRandomInt(10)),
        700 + (getRandomInt(10) - getRandomInt(10)),
        360 + (getRandomInt(10) - getRandomInt(10))
      );
    }
  }
  async subscribeNostrEvents(){
    let sub = pool.sub(
      relays,
      [
        {
          '#t': ['nostr-space'],
          kinds: [1,29211]
        },
        {
          //'#e': ['f412192fdc846952c75058e911d37a7392aa7fd2e727330f4344badc92fb8a22','wss://relay2.nostrchat.io','root'],
          kinds: [0],
          limit: 250
        },
      ]
    )
    sub.on('event', async data => {
      console.log(data);
      let subProfileData;
      if(data.kind === 0){
        subProfileData = data;
      } else {
        subProfileData = await pool.get(relays, {
         authors: [
           data.pubkey
         ],
         kinds: [0]
       });
       console.log(subProfileData)
       if(!subProfileData){
         subProfileData = {
           pubkey: data.pubkey
         }
       }
      }

      let body = this.profiles[subProfileData.pubkey];
      const bytes = stringToBytes(subProfileData.pubkey);
      if(data.tags[2]){
        if(body && (data.tags[2][0] === 'nostr-space-position')){
          console.log(data.tags[2])
          const pos = JSON.parse(data.tags[2][1]);
          console.log(pos)
          body.body.needUpdate = true
          body.position.set(pos.x,pos.y,pos.z);
          this.profiles[subProfileData.pubkey] = body
        } else if(!body && data.tags[2][0] === 'nostr-space-position'){
          let info = {
            x: JSON.parse(data.tags[2][1]).x,
            y: JSON.parse(data.tags[2][1]).y,
            z: JSON.parse(data.tags[2][1]).z,
            profile: subProfileData
          }
          console.log(info)
          await this.addProfile(info,false);
        }
      } else if(data.kind === 0 && subProfileData.content){

        let info = {
          x: bytes[0]*7,
          y: bytes[3]*7,
          z: bytes[5]*7,
          profile: subProfileData
        }
        console.log(info)
        await this.addProfile(info,false);
        //await delay(2000)
      }



      body = this.players[subProfileData.pubkey]

      if(data.tags[1]){
        if(body && data.tags[1][0] === 'nostr-space-movement' && subProfileData.pubkey !== this.nostrPubKey){
          body.body.needUpdate = true
          console.log(data.tags[1]);
          const obj = JSON.parse(data.tags[1][1]);
          body.position.set(obj.position.x,obj.position.y,obj.position.z);
          body.body.setVelocity(obj.velocity.x,obj.velocity.y,obj.velocity.z);
          //this.third.add.existing(body);
          this.players[subProfileData.pubkey] = body
        } else if(data.tags[1][0] === 'nostr-space-movement' && subProfileData.pubkey !== this.nostrPubKey){
          console.log(data.tags[1])
          let info = {
            x: JSON.parse(data.tags[1][1]).x,
            y: JSON.parse(data.tags[1][1]).y,
            z: JSON.parse(data.tags[1][1]).z,
            profile: subProfileData
          }
          await this.addProfile(info,true);
        } else if(data.tags[1][0] === 'nostr-space-shoot'){
          console.log("Shoooot")
          const pos = new THREE.Vector3();
          const obj = JSON.parse(data.tags[1][1]);
          pos.copy(obj.direction)
          pos.add(obj.origin)

          const sphere = this.third.physics.add.sphere(
            { radius: 0.050, x: pos.x, y: pos.y, z: pos.z, mass: 10, bufferGeometry: true },
            { phong: { color: 0x202020 } }
          );

          const force = 8;
          pos.copy(obj.direction)
          pos.multiplyScalar(8);
          if(obj.velocity){
            sphere.body.setVelocity(obj.velocity.x,obj.velocity.y,obj.velocity.z);
          }
          sphere.body.applyForce(pos.x*force, pos.y*force, pos.z*force);


          sphere.body.on.collision((otherObject, event) => {
            if (otherObject.name !== 'ground')
            if(otherObject.name === this.player.name){
              this.third.physics.destroy(this.player)
              this.respawn();
              this.third.physics.add.existing(this.player)
            }
            this.third.destroy(sphere);
          })
        }
      }


      })
  }
  async signEvent(event){
    if(window.nostr){
      event = await window.nostr.signEvent(event)
    } else if(this.sk){
      event.sig = signEvent(event, this.sk);
    }
    return(event);
  }
  async shoot(){

    const raycaster = new THREE.Raycaster()
    const x = 0
    const y = 0.25
    const pos = new THREE.Vector3();

    raycaster.setFromCamera({ x, y }, this.third.camera);
    const velocity = this.player.body.velocity;
    let msgSend = {
      direction: raycaster.ray.direction,
      origin: raycaster.ray.origin,
      velocity: velocity
    };
    // Shoot
    let event = {
      kind: 29211,
      pubkey: this.nostrPubKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'nostr-space'],
        ['nostr-space-shoot',JSON.stringify(msgSend)]
      ],
      content: `Shoot at position - (${this.player.body.position.x},${this.player.body.position.y},${this.player.body.position.z})`
    }
    event.id = getEventHash(event)
    event = await this.signEvent(event);
    console.log(event)
    let pubs = pool.publish(relays, event)
    pubs.on('ok', (res) => {
      this.occuping = false;
      console.log(res);
    });
    pubs.on('failed', (relay,reason) => {
      console.log(`failed to publish to ${relay} ${reason}`)
    })
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
       mesh.scale.set(5, 5, 1.3)
       this.third.physics.add.existing(mesh, { mass: 0 })
     }


  }
  async generatePlayer(){
    /**
      * Create Player
    */
    // create text texture
    let playerName = "Spectator "+getRandomInt(1000);
    let content;
    if(this.playerProfile){
      try{
        content = JSON.parse(this.playerProfile.content);
        playerName = content.name ? content.name : content.display_name ? content.display_name : nip19.npubEncode(this.playerProfile.pubkey)
      } catch(err){
        playerName = nip19.npubEncode(this.playerProfile.pubkey)
      }
    }
    let texture = new FLAT.TextTexture(playerName);
    // texture in 3d space
    const sprite3d = new FLAT.TextSprite(texture)
    sprite3d.setScale(0.003)
    this.player = new THREE.Group();
    this.player.name = playerName
    let playerImg
    if(!this.playerProfile){
      // https://iris.to/note18q96a44le00tzrx4e0wm4fmh923634xr5vpuecuz8rtwv594ahpsld2h4e
      playerImg = this.defaultImage ?
                  this.defaultImage :
                  await this.third.load.texture("https://nostr.build/i/nostr.build_a3bc5db060142c8c49b9cc40d2024b1ac8e602c44bb68ea2d81a85a1135211dc.jpg");
      this.defaultImage = playerImg;
    } else {
      const loader = new THREE.TextureLoader();

      loader.setCrossOrigin('anonymous')
      playerImg = content?.picture ? await loader.load(content.picture) :
                  await this.third.load.texture(makeBlockie(nip19.npubEncode(this.playerProfile.pubkey)))
    }
    const material = new THREE.SpriteMaterial( { map: playerImg } );
    const sprite = new THREE.Sprite( material );

    sprite.position.y = 0.2;
    sprite3d.position.y = 0.8;
    this.player.rotateY(Math.PI + 0.1) // a hack

    this.player.add(sprite)
    this.player.add(sprite3d);
    this.player.scale.set(0.25,0.25,0.25);

    /**
     * Add the player to the scene with a body
     */
    await delay(1000);
    this.respawn();
    this.third.physics.add.existing(this.player,{shape:"box"});
    this.third.add.existing(this.player);
    this.player.body.setFriction(0.8)
    this.player.body.setAngularFactor(0, 0, 0);
    //this.player.body.setGravity(0, 0, 0);

    /**
     * Add 3rd Person Controls
     */
    this.controls = new ThirdPersonControls(this.third.camera, this.player, {
      offset: new THREE.Vector3(0, 0.2, 0),
      targetRadius: 2
    });
  }
  async addProfile(info,player){
    let content;
    try{
      content = JSON.parse(info.profile.content);
    } catch(err){
      console.log(err);
    }
    console.log(info.profile)
    if(this.publickeys[info.profile.pubkey] && !player) return;
    this.publickeys[info.profile.pubkey] = true;
    let metadata;
    try{
      metadata = {
        name: content?.display_name ? content.display_name : content?.name ? content.name : nip19.npubEncode(info.profile.pubkey),
        description: content?.about,
        image: content?.picture ?
          content.picture :
          makeBlockie(nip19.npubEncode(info.profile.pubkey)),
        external_url: content?.website
      }

      // create text texture
      let text = `${metadata.name}'s base`;
      let texture = new FLAT.TextTexture(`${text}`,{color: "blue"});
      // texture in 3d space
      let sprite3d = new FLAT.TextSprite(texture)
      sprite3d.position.y = 1.2;
      sprite3d.setScale(0.0025);
      let image = this.images[info.profile.pubkey];
      if(!image){
        const loader = new THREE.TextureLoader();

        loader.setCrossOrigin('anonymous')
        try{
          image = await loader.load(metadata.image);
        } catch(err){
          image = makeBlockie(info.profile.pubkey);
        }
      }
      console.log(image)
      let textureCube = this.textures[info.profile.pubkey];
      if(!textureCube){
        textureCube = this.third.misc.textureCube([image,image,image,image,image,image])
        this.textures[info.profile.pubkey] = textureCube;
      }
      let body = this.third.add.box({
        width: 0.5,
        height: 0.3,
        depth: 0.5
      }, {
        custom: textureCube.materials,
        side: THREE.BackSide
      });
      if(player){
        body = new THREE.Group();
      }

      const material = new THREE.SpriteMaterial( { map: image } );
      const sprite = new THREE.Sprite( material );
      sprite.position.y = 0.4
      sprite.scale.set(0.5,0.5,0.5)
      body.add(sprite3d);
      body.add(sprite);
      if(metadata.description && !player){
        text = `${metadata.description}`;
        texture = new FLAT.TextTexture(`${text}`);

        // texture in 3d space
        sprite3d = new FLAT.TextSprite(texture)
        sprite3d.position.y = 0.8;
        sprite3d.setScale(0.001);
        body.add(sprite3d);
      }
      body.position.set(info.x,info.y,info.z)
      this.third.add.existing(body);
      this.third.physics.add.existing(body, {collisionFlags: 2});

      if(player){
        this.players[info.profile.pubkey] = body
      } else {
        this.profiles[info.profile.pubkey] = body
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
      }

    } catch(err){
      console.log(err)
    }
  }

  async occupy(){
    try{
      const pos = {
        x: this.player.body.position.x,
        y: this.player.body.position.y,
        z: this.player.body.position.z
      };

      // Occupy
      let event = {
        kind: 1,
        pubkey: this.nostrPubKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', '2c812fcb755d9051c088d964f725ead5386e5d3257fb38f539dab096c384b72c'],
          ['t', 'nostr-space'],
          ['nostr-space-position',JSON.stringify(pos)]
        ],
        content: `Update to position - (${this.player.body.position.x},${this.player.body.position.y},${this.player.body.position.z})`
      }
      event.id = getEventHash(event)
      event = await this.signEvent(event);
      console.log(event)
      let pubs = pool.publish(relays, event)
      pubs.on('ok', (res) => {
        this.occuping = false;
        console.log(res);
      });

    } catch(err){
      console.log(err)
      this.occuping = false;
    }
  }
  async setPlayerPos(){
    try{
      const pos = {
        position: {
          x: this.player.position.x,
          y: this.player.position.y,
          z: this.player.position.z
        },
        velocity:{
          x: this.player.body.velocity.x,
          y: this.player.body.velocity.y,
          z: this.player.body.velocity.z
        }
      };
      console.log(pos)
      // Position
      let event = {
        kind: 29211,
        pubkey: this.nostrPubKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['t', 'nostr-space'],
          ['nostr-space-movement',JSON.stringify(pos)]
        ],
        content: `Moved to position - (${this.player.body.position.x},${this.player.body.position.y},${this.player.body.position.z})`
      }
      event.id = getEventHash(event)
      event = await this.signEvent(event);
      console.log(event)
      let pubs = pool.publish(relays, event)
      pubs.on('ok', (res) => {
        //this.moving = false;
        console.log(res);
      });

    } catch(err){
      console.log(err)
      //this.moving = false;
    }
  }
  async occupyWithImage(){
    try{
      const pos = {
        x: this.player.body.position.x,
        z: this.player.body.position.z
      };
      let event = {
        kind: 1,
        pubkey: this.nostrPubKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', '2c812fcb755d9051c088d964f725ead5386e5d3257fb38f539dab096c384b72c'],
          ['t', 'nostr-space'],
          ['nostr-space-image-position',JSON.stringify(pos)],
          ['nostr-space-image-url',imgUri]
        ],
        content: `Nostr Space - Image ${imgUri} - Position - (${this.player.body.position.x},${this.player.body.position.y},${this.player.body.position.z})`
      }
      event.id = getEventHash(event)
      event = await this.signEvent(event);
      console.log(event)
      let pubs = pool.publish(relays, event)
      pubs.on('event', (res) => {
        this.occuping = false;
        console.log(res);
      });
      setTimeout(() => {
        this.occuping = false;
      },[1000])

    } catch(err){
      console.log(err)
      this.occuping = false;
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
      const speed = 1
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
        const raycaster = new THREE.Raycaster()
        let x = 0
        let y = 0
        let z = 0
        raycaster.setFromCamera({ x, y }, this.third.camera);

        const pos = new THREE.Vector3();

        pos.copy(raycaster.ray.direction)
        pos.add(raycaster.ray.origin)
        pos.copy(raycaster.ray.direction)
        pos.multiplyScalar(3)

        x = pos.x*speed
        y = pos.y*speed
        z = pos.z*speed
        this.player.body.setVelocity(x, y, z)
        //this.setPlayerPos();

      }


      if(this.keys.c.isDown && !this.connecting && !this.connected){
        this.connecting = true;
        this.connect();
      }
      if(window.nostr && this.keys.o.isDown && !this.occuping && this.connected){
        this.occuping = true;
        this.occupy();
      }

      if(!this.moving && this.connected){
        this.moving = true;
        this.time.addEvent({
          delay: 2500,
          callback: () => {
            this.moving = false
          }
        })
        this.setPlayerPos();
      }
      if(this.keys.f.isDown && this.canShoot && this.connected){
        this.canShoot = false;
        this.time.addEvent({
          delay: 1000,
          callback: () => {
            this.canShoot = true
          }
        })
        this.shoot();

      }

      if(window.webln && this.keys.k.isDown && !this.keysending){
        this.keysending = true;
        this.keysend();
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

  const [show, setShow] = useState();
  const [value,setValue] = useState();

  const keyDownHandler = event => {

      if (event.key === 'i') {
        event.preventDefault();

        const instructions = document.getElementById("instructions");
        if(instructions.style.display === "none"){
          instructions.style.display = "flex"
        } else {
          instructions.style.display = "none"
        }
      }
  };
  useEffect(() => {
    document.addEventListener('keydown', keyDownHandler);
  },[]);
  useEffect(() => {
    if(!init){
      enable3d(() => new Phaser.Game(config)).withPhysics('/lib/ammo');
      init = true;
    }
  },[])

  return(
    <>
    <Layer
      onEsc={(e) => {
        const layer = document.getElementById('instructions');
        layer.style.display = "none"
      }}
      onClickOutside={() => {
        const layer = document.getElementById('instructions');
        layer.style.display = "none"
      }}
      pad="xlarge"
      id="instructions"
    >
    <Box pad="medium">
      <Tabs>
        <Tab title="Instructions">
          <Box pad="medium">
            <Text >Nostr Space Instructions</Text>
            <Text >W: Move foward</Text>
            <Text >C: Connect Nostr</Text>
            <Text >F: Throw sphere (once connected)</Text>
            <Text >Mouse: Move camera direction</Text>
            <Text >E: View profile being touched</Text>
            {
              window.nostr &&
              <Text >O: Occupy position with your nostr profile</Text>
            }
            {
              window.webln &&
              <Text >K: Keysend to developer</Text>
            }
            <Text >I: Show / Hide instructions</Text>
          </Box>
        </Tab>
        <Tab title="Add Image" id="addImgTab" style={{display: "none"}}>
          <Box pad="medium">
            <Text>Insert image url to place in current position</Text>
            {
              imgUri &&
              <Text size="xsmall">imgUri</Text>
            }
            <TextInput
              placeholder="Image url"
              value={imgUri}
              onChange={event => {imgUri = event.target.value}}
            />
          </Box>
        </Tab>
        <Tab title="Nostr Info" id="nostrInfo" style={{display: "none"}}>
          <Box pad="medium">
            <Text>Edit your profile at any nostr client</Text>
            <Text>npub</Text>
            <Text id="npub"></Text>
            <Text>sk</Text>
            <Text id="sk"></Text>
          </Box>
        </Tab>
      </Tabs>
      <Button label="Close" onClick={() => {
        const layer = document.getElementById('instructions');
        layer.style.display = "none"
      }} />
    </Box>
    </Layer>
    </>
  )
}
export default Game3D
