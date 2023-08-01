import {useEffect,useState} from  'react';
import Phaser from 'phaser';
import './enable3d.css';

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
  TextInput,
  Layer,
  Button,
  Tabs,
  Tab
 } from 'grommet';

import makeBlockie from 'ethereum-blockies-base64';

import {
  connectWallet,
  generateKeys,
  relays,
  initRelay,
  changeRelay
} from './utils';
import {
  SimplePool,
  nip19,
  getEventHash,
  signEvent,
} from 'nostr-tools';

import {stringToBytes} from 'convert-string';
import logo from './img/empty_space.png';

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
    this.profileData = [];
    this.textures = [];
    this.images = [];
    this.enemies = [];
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
    let pubs = pool.publish(relays, event)
    pubs.on('ok', (res) => {
      console.log(res);
    });
  }
  async connect() {
    let newNostrPubKey;
    let keys;
    if(window.nostr){
      keys = await connectWallet();
    } else {
      keys = await generateKeys();
      this.sk = keys.sk;
    }
    newNostrPubKey = keys.pk
    let newProfile = await pool.get(relays, {
      authors: [
        newNostrPubKey
      ],
      kinds: [0]
    });
    if(!newProfile){
      newProfile = {
        pubkey: newNostrPubKey
      }
    }
    this.playerProfile = newProfile;
    this.connecting = false;
    this.connected = true;
    this.nostrPubKey = newNostrPubKey;
    this.third.destroy(this.player);
    this.time.addEvent({
      delay: 2000,
      callback: () => {
        this.sendEnteredGameMsg();
      }
    });
    await this.generatePlayer()
    // add red dot
    this.redDot = this.add.circle(this.cameras.main.width / 2 , this.cameras.main.height / 2 - 120, 2, 0xff0000)
    this.redDot.depth = 1
    //document.getElementById("npub").innerHTML = keys?.npub;

    //document.getElementById("sk").innerHTML = keys?.sk;

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


    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    //await this.generateScenario();


    await this.generatePlayer();
    this.setControls();
    this.subscribeNostrEvents();
    this.loadSkybox();
    //this.third.physics.debug.enable()

  }

  async loadSkybox(){
    const loader = new THREE.TextureLoader();

    loader.setCrossOrigin('anonymous')
    const texture = await loader.load('/img/space.png');
    const material = new THREE.MeshPhongMaterial({ map: texture,side: THREE.BackSide});
    //const materialArray = [material,material,material,material,material,material];
    const skyboxGeo = new THREE.SphereGeometry(1000,200,1000);
    const skybox = new THREE.Mesh(skyboxGeo,material);
    skybox.position.set(this.player.position.x,this.player.position.y,this.player.position.z)
    this.third.add.existing(skybox);
    this.skybox = skybox;
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
      const buttonF = joystick.add.button({
        letter: 'F',
        styles: { right: 35, bottom: 110, size: 80 }
      })
      buttonF.onClick(() => {
        this.canShoot = false;
        this.shoot();
        this.time.addEvent({
          delay: 2500,
          callback: () => {
            this.canShoot = true;
          }
        })
      })
      const buttonB = joystick.add.button({
        letter: 'B',
        styles: { right: 110, bottom: 35, size: 80 }
      })
      buttonB.onClick(() => (this.move = true))
      buttonB.onRelease(() => (this.move = false))
    }
  }
  respawn(){
    ///this.player.body.setCollisionFlags(2);
    //this.player.needUpdate = true;
    const base = this.profiles[this.nostrPubKey]
    if(base){
      this.player.position.set(base.position.x, base.position.y, base.position.z)
    } else {
      this.player.position.set(
        700 + (getRandomInt(10) - getRandomInt(10)),
        400 + (getRandomInt(10) - getRandomInt(10)),
        400 + (getRandomInt(10) - getRandomInt(10))
      );
    }

  }
  async subscribeNostrEvents(){
    const relayOffChain = await initRelay('wss://offchain.pub'); // Default relay
    const relayNostrChat = await initRelay('wss://relay2.nostrchat.io') // to get more data
    this.relay = relayOffChain;
    let subOffChain = relayOffChain.sub(
      [
        {
          '#t': ['nostr-space'],
          kinds: [12301]
        },
        {
          '#t': ['nostr-space'],
          kinds: [29211],
          since: Math.floor(Date.now() / 1000)
        },
        {
          kinds: [1],
          limit: 1,
          since: Math.floor(Date.now() / 1000),
        }
      ]
    );
    let subNostrChat = relayNostrChat.sub(
      [
        {
          kinds: [0],
          limit: 100,
        },
        {
          kinds: [40],
          limit: 10,
        },
        {
          kinds: [7],
          since: Math.floor(Date.now() / 1000),
          limit: 1
        }
      ]
    )
    subOffChain.on('event', async data => {
      this.handleEventsEmited(data);
    });

    subNostrChat.on('event', async data => {
      this.handleEventsEmited(data);
    })
  }
  async handleEventsEmited(data){
    // Kind 1: Short Text Notes
    if(data.kind === 1){
      this.addEnemy(data.id);
      return;
    }

    let subProfileData;
    // Kind 0: Metadata profile
    if(data.kind === 0){
      subProfileData = data;
      this.profileData[data.pubkey] = subProfileData;
      // Kind 12301 Replaceable and Kind 29211 Ephemeral (Movements and Shoots)
      // Getting profile to show it after if needed
    } else if(this.profileData[data.pubkey] !== undefined){
      subProfileData = this.profileData[data.pubkey];
    } else if((data.kind === 12301 || data.kind === 29211)){
      // Get profile from multiple relays: cant be sure if the connected relay has the profile
      subProfileData = await pool.get(relays, {
       authors: [
         data.pubkey
       ],
       kinds: [0]
     });
     this.profileData[data.pubkey] = subProfileData;
    }
    if(subProfileData === undefined || !subProfileData){
      subProfileData = {
        pubkey: data.pubkey
      }
    }

    if(data.kind === 29211){
      this.handleEphemeralEvents(data,subProfileData);
      return;
    }

    const bytesEvent = stringToBytes(data.id);


    if(data.kind === 0 && subProfileData.content){
      const bytes = stringToBytes(subProfileData.pubkey);

      let info = {
        x: bytes[0]*7,
        y: bytes[3]*7,
        z: bytes[5]*7,
        profile: subProfileData
      }
      this.addProfile(info,false);
      return;
    }

    if(data.kind === 12301){
      this.handleBasePosition(data,subProfileData);
      return;
    }

    if(data.kind === 7){
      this.spawnAntimatter(bytesEvent);
      return;
    }


    if(data.kind === 40 || data.kind === 42){

     this.spawnBlackHole(bytesEvent);
     return;

    }
  }
  handleBasePosition(data,subProfileData){
    let body = this.profiles[subProfileData.pubkey];
    if(!body){
      body = this.players[subProfileData.pubkey]
    }
    const tagPos = data.tags.filter(tag => tag[0] === 'nostr-space-position')
    if(tagPos !== undefined){
      if(body){
        const pos = JSON.parse(tagPos[0][1]);
        body.body.needUpdate = true
        body.position.set(pos.x,pos.y,pos.z);
        this.profiles[subProfileData.pubkey] = body
      } else {
        let info = {
          x: JSON.parse(data.tags[1][1]).x,
          y: JSON.parse(data.tags[1][1]).y,
          z: JSON.parse(data.tags[1][1]).z,
          profile: subProfileData
        }
        this.addProfile(info,false);
      }
    }
  }
  handleEphemeralEvents(data,subProfileData){


    let body = this.players[subProfileData.pubkey];
    const tagMovement = data.tags.filter(tag => tag[0] === 'nostr-space-movement')
    const tagShoot = data.tags.filter(tag => tag[0] === 'nostr-space-shoot')
    if(tagMovement.length > 0){
      if(body && subProfileData.pubkey !== this.nostrPubKey){
        body.body.needUpdate = true
        const obj = JSON.parse(tagMovement[0][1]);
        body.position.set(obj.position.x,obj.position.y,obj.position.z);
        body.body.setCollisionFlags(1)
        body.body.setVelocity(obj.velocity.x,obj.velocity.y,obj.velocity.z);
        //this.third.add.existing(body);
        body.body.setCollisionFlags(2)
        this.players[subProfileData.pubkey] = body
      } else if(subProfileData.pubkey !== this.nostrPubKey){
        let info = {
          x: JSON.parse(data.tags[1][1]).x,
          y: JSON.parse(data.tags[1][1]).y,
          z: JSON.parse(data.tags[1][1]).z,
          profile: subProfileData
        }
        this.addProfile(info,true);
      }
    }
    if(tagShoot.length > 0){
      console.log("Shoooot");
      const pos = new THREE.Vector3();
      const obj = JSON.parse(tagShoot[0][1]);
      pos.copy(obj.direction)
      pos.add(obj.origin)

      const sphere = this.third.physics.add.sphere(
        { radius: 0.050, x: pos.x, y: pos.y, z: pos.z, mass: 10, bufferGeometry: true },
        { phong: { color: 0x202020 } }
      );

      const force = 8;
      pos.copy(obj.direction)
      pos.multiplyScalar(48);
      if(obj.velocity){
        sphere.body.setVelocity(obj.velocity.x,obj.velocity.y,obj.velocity.z);
      }
      sphere.body.applyForce(pos.x*force, pos.y*force, pos.z*force);


      sphere.body.on.collision((otherObject, event) => {

        if(otherObject.name === this.player.name){
          this.third.physics.destroy(this.player)
          this.respawn();
          this.third.physics.add.existing(this.player)
        }
        this.third.destroy(sphere);


      })
    }
  }
  spawnAntimatter(bytesEvent){

    const pos = new THREE.Vector3();
    const obj = {
      direction: {
        x: bytesEvent[0]*2,
        y: bytesEvent[1]*2,
        z: bytesEvent[2]*2,
      },
      origin: {
        x: bytesEvent[3]*2,
        y: bytesEvent[4]*2,
        z: bytesEvent[5]*2,
      }
    }
    pos.copy(obj.direction)
    pos.add(obj.origin)

    const sphere = this.third.physics.add.sphere(
      { radius: 2.50, x: pos.x, y: pos.y, z: pos.z, mass: 10, bufferGeometry: true },
      { phong: { color: "#FF0000" } }
    );

    const force = 15;
    pos.copy(obj.direction)
    pos.multiplyScalar(8);
    sphere.body.applyForce(pos.x*force, pos.y*force, pos.z*force);

    this.time.addEvent({
      delay: 5000,
      callback: () => {
        try{
          this.third.destroy(sphere)

        } catch(err){

        }
      }
    })
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
  spawnBlackHole(bytesEvent){
    const pos = {x: bytesEvent[0],y: bytesEvent[4],z: bytesEvent[6]}



    const sphere = this.third.physics.add.sphere(
      { radius: 15, x: pos.x*10, y: pos.y*10, z: pos.z*10, mass: 10000000000000, bufferGeometry: true },
      { phong: { color: 0x202020 } }
    );


    sphere.body.on.collision((otherObject, event) => {
      if (otherObject.name !== 'ground')
      if(otherObject.name === this.player.name){
        this.third.physics.destroy(this.player)
        this.respawn();
        this.third.physics.add.existing(this.player)
      }
    })
  }
  async changeRelay(){
    const newUrl = prompt("Select new relay url");
    this.relay = await changeRelay(this.relay,newUrl);
    // Need to remove items
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
    const y = 0.3

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
    let pubs = this.relay.publish(event)
    pubs.on('ok', (res) => {
      //this.canShoot = true;
      //console.log(res);
    });
    pubs.on('failed', (relay,reason) => {
      //this.shooting = false;
      console.log(`failed to publish to ${relay} ${reason}`)
    })
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
    this.player = new ExtendedObject3D();
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
    let object = this.shipObj;
    if(!object){
      object = await this.third.load.gltf('/assets/gltf/ship/scene.gltf');
      this.shipObj = object;
    }
    object.scene.scale.set(0.005,0.005,0.005)
    object.scene.position.y = -1;
    if(!this.connected){
      object.scene.rotateY(Math.PI + 0.1) // a hack
    }
    this.player.add(object.scene.clone())
    this.player.scale.set(0.01,0.01,0.01)
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
    this.third.add.existing(this.player);
    this.respawn();
    this.third.physics.add.existing(this.player,{shape:"box"});
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
      if(player){
        text = metadata.name;
      }
      let texture = new FLAT.TextTexture(`${text}`,{color: "blue"});
      // texture in 3d space
      let sprite3d = new FLAT.TextSprite(texture)
      sprite3d.position.y = player ? 0.4 : 3.2;
      sprite3d.setScale(0.0015);
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
      let textureCube = this.textures[info.profile.pubkey];
      if(!textureCube){
        textureCube = this.third.misc.textureCube([image,image,image,image,image,image])
        this.textures[info.profile.pubkey] = textureCube;
      }

      let body = new ExtendedObject3D();


      if(player){

        let object = this.shipObj;
        if(!object){
          object = await this.third.load.gltf('/assets/gltf/ship/scene.gltf');
          this.shipObj = object;
        }
        const target = object.scene.clone();
        target.scale.set(0.0015,0.0015,0.0015)
        target.position.y = -0.4
        body.add(target)
      } else {
        let object = this.station;
        if(!object){
          object = await this.third.load.gltf('/assets/gltf/station/scene.gltf');
          this.station = object;
        }
        body.add(object.scene.clone());
      }
      const material = new THREE.SpriteMaterial( { map: image } );
      const sprite = new THREE.Sprite( material );
      sprite.position.y = player ? 0.05 : 2.6
      const scaleSprite = player ? 0.25 : 0.5
      sprite.scale.set(scaleSprite,scaleSprite,scaleSprite)
      body.add(sprite3d);
      body.add(sprite);
      if(metadata.description && !player){
        text = `${metadata.description}`;
        texture = new FLAT.TextTexture(`${text}`);

        // texture in 3d space
        sprite3d = new FLAT.TextSprite(texture)
        sprite3d.position.y = 2.8;
        sprite3d.setScale(0.001);
        body.add(sprite3d);
      }
      body.position.set(info.x,info.y,info.z)
      this.third.add.existing(body);
      this.third.physics.add.existing(body, {collisionFlags: 2,shape: "box",height: player ? 1 : 5,width: player ? 1 : 5, depth: player ? 1 : 5});

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
  async addEnemy(id){

    const pos = new THREE.Vector3();
    const bytes = stringToBytes(id)
    const origin = {
      x: bytes[2],
      y: bytes[4],
      z: bytes[6]
    }
    pos.copy(this.player.body.position)
    pos.add(origin);

    const ship = new ExtendedObject3D();


    let object = this.shipEnemyObj;
    if(!object){
      object = await this.third.load.gltf('/assets/gltf/ship_notes/scene.gltf');
      this.shipEnemyObj = object;
    }

    //object.scene.rotateY(Math.PI + 0.1) // a hack
    ship.add(object.scene.clone());

    ship.scale.set(0.5, 0.5, 0.5)
    //ship.position.set(this.player.position.x,this.player.position.y+5,this.player.position.z);
    ship.position.set(origin.x, origin.y, origin.z)
    const force = 0.08;
    pos.copy(this.player.body.position)
    ship.name = id
    //pos.multiplyScalar(3);
    this.third.add.existing(ship);
    this.third.physics.add.existing(ship,{shape: "box",width: 5,height: 5,depth: 15});
    this.enemies[`${id}`] = ship;
    ship.body.applyForce(pos.x*force, pos.y*force, pos.z*force);

    ship.body.on.collision((otherObject, event) => {

      if(otherObject.name === this.player.name){
        this.third.physics.destroy(this.player)
        this.respawn();
        this.third.physics.add.existing(this.player)
      }
      this.third.destroy(ship);

    })
    this.time.addEvent({
      delay: 10000,
      callback: () => {
        this.third.destroy(ship);
        this.enemies[`${id}`] = null
      }
    })
  }
  async occupy(){
    try{
      const pos = {
        x: this.player.position.x,
        y: this.player.position.y - 3.5,
        z: this.player.position.z
      };
      // Occupy
      let event = {
        kind: 12301,
        pubkey: this.nostrPubKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['t', 'nostr-space'],
          ['nostr-space-position',JSON.stringify(pos)]
        ],
        content: `Update to position - (${this.player.position.x},${this.player.position.y},${this.player.position.z})`
      }
      event.id = getEventHash(event)
      event = await this.signEvent(event);
      let pubs = this.relay.publish(event)
      pubs.on('ok', (res) => {
        this.occuping = false;
        //console.log(res);
      });
      pubs.on('failed', (res) => {
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
      let pubs = this.relay.publish(event)
      pubs.on('ok', (res) => {
        //this.moving = false;
        //console.log(res);
      });

    } catch(err){
      console.log(err)
      //this.moving = false;
    }
  }
  async keysend(){
    if(!window.webln) return;
    await window.webln.enable();
    await window.webln.lnurl("lnurl1dp68gurn8ghj7ampd3kx2ar0veekzar0wd5xjtnrdakj7tnhv4kxctttdehhwm30d3h82unvwqhhqatjwpkx2arjda6hgwpk6dleua");
    this.keysending = false;

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
      const speed = 0.8
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

      if (this.keys.s.isDown) {
        this.player.body.setVelocity(0, 0, 0)
      }


      if(this.keys.c.isDown && !this.connecting && !this.connected){
        this.connecting = true;
        this.connect();
      }
      if(this.keys.o.isDown && !this.occuping && this.connected){
        this.occuping = true;
        this.occupy();
      }

      if(!this.moving && this.connected){
        this.moving = true;
        this.time.addEvent({
          delay: 600,
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



const Game3D =  () => {

  const [init,setInit] = useState();

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
      setInit(true)
    }
  },[init])

  return(
    <>
    {!init && <p>Loading</p>}
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
    <Box pad="medium" className='MainBox'>
      <img className="logo" src={logo} alt="logo" />
      <Text className='MainText'>Welcome to NostrSpace</Text>
      <br></br>
      <Text className='SubText'>Your Gateway to a 3D Universe! <br></br>Step into a boundless world where you are the master of your own destiny. In NostrSpace, every corner of our expansive 3D universe can be yours... until someone else decides to claim it.</Text>
      <br></br>
      <Tabs>
        <Tab title="Instructions" className='tab'>
        <Box pad="medium" className='TabArea' direction="row" gap="large">
        <Box basis="1/2">
          <Text><button class="o-btn">C</button>&nbsp; &nbsp; &nbsp;Connect Nostr</Text>
          <Text><button class="o-btn">W</button>&nbsp; &nbsp; &nbsp;Move foward</Text>
          <Text><button class="o-btn">S</button>&nbsp; &nbsp; &nbsp;Stop</Text>
          <Text><button class="o-btn">F</button>&nbsp; &nbsp; &nbsp;Shoot</Text>
        </Box>
        <Box basis="1/2">
          <Text>Mouse:  Move camera direction</Text>
          {
            window.nostr &&
            <Text><button class="o-btn">O</button>&nbsp; &nbsp; &nbsp;Occupy position</Text>
          }
          {
            window.webln &&
            <Text ><button class="o-btn">K</button>&nbsp; &nbsp; &nbsp;Send SATs to devs</Text>
          }
          <Text><button class="o-btn">I</button>&nbsp; &nbsp; &nbsp;Instructions</Text>
          <Text><button class="o-btn">E</button>&nbsp; &nbsp; &nbsp;View profile</Text>

        </Box>
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
        <Tab title="Nostr Info" id="nostrInfo" className='tab'>
          <Box pad="medium">
            <Text>Edit your profile at any nostr client</Text>
            <Text size="small">NostrChat, Iris.to, Snort Social, Yakihone and much more</Text>
            <Text size="small">Use alby extension for better experience</Text>
            <Text size="xsmall">Relays: {relays.toString()}</Text>
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
