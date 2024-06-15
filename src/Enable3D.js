import {useEffect,useState} from  'react';
import LNC from '@lightninglabs/lnc-web';
import Peer from 'peerjs';
import {Buffer} from 'buffer';
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
  changeRelay,
  fetchTaprootAssets
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
const NOSTR_ASSETS_PUBKEY = '6c0fde2a3b2e481e21bdf09b377e0c3e5391bf0353db06ab37c88945a8a77402';
let imgUri;


class MainScene extends Scene3D {
  constructor(data) {
    super({ key: 'MainScene' });
    this.peerInstance = data.peer;
    this.peerId = data.peerId;
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
    this.spinningObjects = [];
    this.speed = 0.8;
    this.connections = [];
  }
  async sendEnteredGameMsg(){
    //this.peer.on()
    let event = {
      kind: 42,
      pubkey: this.nostrPubKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e','6afddc25a8ed486b0c1e6e556077a9eef3e0d7236014b891495ae20d557a2346','wss://relay2.nostrchat.io','root'],
        ['t', 'nostr-space'],
        ['peerJsId',this.serverId]
      ],
      content: this.serverId === this.peerId ? `Just entered the space as the server!` : `Just entered the space at server ${this.serverId}!`
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
    if(window.nostr){// || process.env.REACT_APP_NOSTR_SK){
      keys = await connectWallet();
      /*if(process.env.REACT_APP_NOSTR_SK){
        this.sk = keys.sk;
      }
      */
    } else {
      try{
        keys = await connectWallet();
        this.nwc = keys.nwc;
      } catch(err){
        alert(err.message)
        keys = await generateKeys();
        this.sk = keys.sk;
      }
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
  }


  async connectLNC(){
    try{
      this.fetchingAssets = true;
      const pairingPhrase = window.prompt("Enter readonly testnet LNC Pairing Phrase");
      const pwd = window.prompt("Define a password");
      const lnc = new LNC({
          pairingPhrase: pairingPhrase,
          password: pwd
      });
      console.log(`LNC ready: ${lnc.isReady}`);
      console.log(lnc)
      await lnc.preload();
      await lnc.run();
      await lnc.connect();
      console.log(`LNC connected: ${lnc.isConnected}`);
      this.lnc = lnc;
      await delay(2500);
      this.fetchingAssets = false;
      this.fetchAssetsLNC();
      return;
    } catch(err){
      this.fetchingAssets = false;
    }
  }
  async fetchAssetsLNC(){
    try{
      this.fetchingAssets = true;
      const { taprootAssets, mint, universe, assetWallet } = this.lnc?.tapd;
      if(!taprootAssets){
        return;
      }
      const data = await taprootAssets.listAssets();
      let assetsArr = [];
      console.log(data);
      for(let asset of data.assets){
        if(asset.assetType === "COLLECTIBLE"){
          const meta = await taprootAssets.fetchAssetMeta({asset_id: asset.assetGenesis.assetId.replace(/\+/g, '-').replace(/\//g, '_')});
          assetsArr.push({
            ...asset,
            decodedMeta: Buffer.from(meta.data,'base64').toString('utf8')
          });
          console.log(assetsArr)
        } else {
          const name = asset.assetGenesis.name;
          const amount = asset.amount;
          const genesisPoint = asset.assetGenesis.genesisPoint;
          alert(`${name} - ${amount} - ${asset.assetType}`);
          if(genesisPoint === "d093a015ac32b4e29e9da1b2fab45acf27b21b8f34fe949a86a691802cd21765:1" && !this.tapVelCheck){
            this.tapVelCheck = true;
            this.speed = 1 + Number(amount)/100
            alert(`New speed: ${this.speed} - Asset: ${name} - Amount: ${amount}` );
          }
          assetsArr.push(asset);
        }
      }
      this.tapVelCheck = false;
      this.fetchingAssets = false;
      this.assetsArr = assetsArr;
    } catch(err){
      this.fetchingAssets = false;
    }
  }

  async connectTapRootNode(){
    this.fetchingAssets = true
    const data = await fetchTaprootAssets(process.env.REACT_APP_TAP_REST,process.env.REACT_APP_TAP_MACAROON);
    for(let asset of data.assets){
      console.log(asset)
      const name = asset.asset_genesis.name;
      const amount = asset.amount;
      const type = asset.asset_type;
      alert(`${name} - ${amount} - ${type}`);
      if(type === "NORMAL" && name === "NostrSpaceVelocity" && !this.tapVelCheck){
        this.tapVelCheck = true;
        this.speed = 0.8 + Number(amount)/100
        alert(`New speed: ${this.speed}`);
      }
    }
    this.tapVelCheck = false;
    this.fetchingAssets = false
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
    // Load Assets //
    this.shipObj = await this.third.load.gltf('/assets/gltf/ship/scene.gltf');
    this.station = await this.third.load.gltf("/assets/gltf/station/scene.gltf");
    this.shipEnemyObj = await this.third.load.gltf('/assets/gltf/ship_notes/scene.gltf');

    //await this.generateScenario();



    //this.third.physics.debug.enable()
    let event = await pool.get(relays, {
      kinds: [42],
      '#t':['nostr-space']
    })
    if(event.pubkey !== this.nostrPubKey){
      const tagPeerId = event.tags.filter(tag => tag[0] === 'peerJsId')
      console.log(event)
      console.log(tagPeerId)
      this.serverId = tagPeerId[0][1]
    }
    this.handlePeerEvents();
    await this.generatePlayer();
    this.setControls();
    this.subscribeNostrEvents();
    this.loadSkybox();

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
      t: this.input.keyboard.addKey('t'),
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
    const relayOffChain = await initRelay(process.env.REACT_APP_RELAY_1 ? process.env.REACT_APP_RELAY_1 : 'wss://relay2.nostrchat.io'); // Default relay
    this.relay = relayOffChain;
    let subOffChain = relayOffChain.sub(
      [
        {
          '#t': ['nostr-space'],
          kinds: [30078]
        },
        {
          kinds: [1],
          limit: 1,
          since: Math.floor(Date.now() / 1000),
        }
      ]
    );

    subOffChain.on('event', async data => {
      this.handleEventsEmited(data);
    });

    const relayNostrChat = await initRelay(process.env.REACT_APP_RELAY_2 ? process.env.REACT_APP_RELAY_2 : 'wss://relay1.nostrchat.io') // to get more data
    let subNostrChat = relayNostrChat.sub(
      [
        {
          kinds: [0],
          limit: 50,
        },
        {
          kinds: [40,42],
          limit: 10,
        },
        {
          kinds: [7],
          since: Math.floor(Date.now() / 1000),
          limit: 1
        }
      ]
    )
    subNostrChat.on('event', async data => {
      this.handleEventsEmited(data);
    });

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
      // Kind 30078 Arbitrary custom app data and Kind 29211 Ephemeral (Movements and Shoots)
      // Getting profile to show it after if needed
    } else if(this.profileData[data.pubkey] !== undefined){
      subProfileData = this.profileData[data.pubkey];
    } else if((data.kind === 30078 || data.kind === 29211)){
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
      this.profileData[data.pubkey] = subProfileData;
    }


    const bytesEvent = stringToBytes(data.id);

    if(data.kind === 30078){
      this.handleBasePosition(data,subProfileData);
      return;
    }

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
    if(tagPos !== undefined || tagPos?.length > 0){
      if(body){
        const pos = JSON.parse(tagPos[0][1]);
        body.body.needUpdate = true
        body.position.set(pos.x,pos.y,pos.z);
        this.profiles[subProfileData.pubkey] = body
      } else {
        let info = {
          x: JSON.parse(data.tags[2][1]).x,
          y: JSON.parse(data.tags[2][1]).y,
          z: JSON.parse(data.tags[2][1]).z,
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

        try{
          if(otherObject.name === this.player.name){
            this.third.physics.destroy(this.player)
            this.respawn();
            this.third.physics.add.existing(this.player)
          }
          this.third.destroy(sphere);
        } catch(err){
          console.log(err);
        }


      })
    }
  }
  handlePeerEvents(){
    // Create a room
    if(!this.serverId){
      this.handleHubConn();
    } else {
      this.handlePeerConn()
    }
  }
  handleHubConn() {
      this.peerInstance.on('connection', (conn) => {
          this.connections.push(conn);
          console.log("Peer connected: " + conn.peer);
          conn.on('open', () => {

              conn.send({
                  type: "newConnection",
                  data: conn.peer
              });
              this.connections.forEach(c => {
                  if (c !== conn) {
                      c.send({
                          type: "newConnection",
                          data: conn.peer
                      });
                  }
              });
          });

          conn.on('data', (data) => {
              console.log('Received data:', data);
              // React to data
              this.reactToData(data);
              this.connections.forEach(c => {
                  if (c !== conn) {
                      c.send(data);
                  }
              });
          });
          conn.on('close', () => {
              console.log("Connection closed with: " + conn.peer);
              this.connections = this.connections.filter(c => c !== conn);
          });
          conn.on('error', (err) => {
              console.error("Connection error with: " + conn.peer, err);
          });

      });
      this.peerInstance.on('error', (err) => {
          console.error('PeerJS error:', err);
      });
  }
  handlePeerConn() {
      // Peer
      const conn = this.peerInstance.connect(this.serverId, {
          reliable: true
      });

      conn.on('open', () => {
          console.log("Connected to: " + conn.peer);
          this.conn = conn;
          // Extract data from friendlyUnits to send
          conn.send({
              type: "newConnection",
              data: conn.peer
          });
      });

      conn.on('data', (data) => {
          console.log('Received data:', data);
          this.reactToData(data);
      });

      conn.on('close', () => {
          console.log("Connection closed");
      });
      conn.on('error', (err) => {
          console.error("Connection error with: " + conn.peer, err);
      });
      this.peerInstance.on('error', (err) => {
          console.error('PeerJS error:', err);
          this.serverId = this.peerId;
          if(conn){
            conn.close();
          }
          this.handleHubConn();
      });
  }
  reactToData(msg) {
    // Handle data received from PeerJS in Phaser
    console.log('Reacting to msg:', msg);
    // Assuming data is an array of enemy unit positions
    if(typeof(msg) === "object"){
      const data = msg.data;
      if(msg.type === "newConnection"){
        console.log(data);
      }
      if(msg.type === "movement"){
        console.log(data)
        let body = this.profiles[data.pubkey];
        if(!body){
          body = this.players[data.pubkey]
        }
        const subProfileData = this.profileData[data.pubkey];
        console.log(subProfileData)
        if(body && data.pubkey !== this.nostrPubKey){
          body.body.needUpdate = true
          body.position.set(data.position.x,data.position.y,data.position.z);
          body.body.setCollisionFlags(1)
          body.body.setVelocity(data.velocity.x,data.velocity.y,data.velocity.z);
          //this.third.add.existing(body);
          body.body.setCollisionFlags(2)
          this.players[data.pubkey] = body
        } else if(data.pubkey !== this.nostrPubKey){
          let info = {
            x: data.position.x,
            y: data.position.y,
            z: data.position.z,
            profile: subProfileData !== undefined ? subProfileData : {
              pubkey: data.pubkey
            }
          }
          this.addProfile(info,true);
        }
      }
      if(msg.type === "shoot"){
        this.handleShoot(data);
      }
    }

  }
  handleShoot(data){
    const pos = new THREE.Vector3();
    pos.copy(data.direction)
    pos.add(data.origin)
    const sphere = this.third.physics.add.sphere(
      { radius: 0.050, x: pos.x, y: pos.y, z: pos.z, mass: 10, bufferGeometry: true },
      { phong: { color: 0x202020 } }
    );
    const force = 8;
    pos.copy(data.direction)
    pos.multiplyScalar(48);
    if(data.velocity){
      sphere.body.setVelocity(data.velocity.x,data.velocity.y,data.velocity.z);
    }
    sphere.body.applyForce(pos.x*force, pos.y*force, pos.z*force);
    sphere.body.on.collision((otherObject, event) => {
      try{
        if(otherObject.name === this.player.name){
          this.third.physics.destroy(this.player)
          this.respawn();
          this.third.physics.add.existing(this.player)
        }
        this.third.destroy(sphere);
      } catch(err){
        console.log(err);
      }
    });
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
      try{
        if (otherObject.name !== 'ground')
        if(otherObject.name === this.player.name){
          this.third.physics.destroy(this.player)
          this.respawn();
          this.third.physics.add.existing(this.player)
        }
        this.third.destroy(sphere);
      }catch(err){
        console.log(err)
      }

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
  async signEvent(event){
    if(this.sk){
      event.sig = signEvent(event, this.sk);
    } else if(window.nostr){
      event = await window.nostr.signEvent(event)
    } else if(this.nwc){
      event = this.nwc.signEvent(event);
    }
    return(event);
  }
  async shoot(){
    const raycaster = new THREE.Raycaster()
    const x = 0
    const y = 0.3

    raycaster.setFromCamera({ x, y }, this.third.camera);
    const velocity = this.player.body.velocity;
    let data = {
      direction: raycaster.ray.direction,
      origin: raycaster.ray.origin,
      velocity: velocity
    };
    if(!this.nostrPubKey) return;
    this.handleShoot(data);
    if(this.conn){
      this.conn.send({
        type: "shoot",
        from: this.nostrPubKey,
        data: data
      });
      return;
    };
    this.connections.map(conn => {
      conn.send({
        type: "shoot",
        from: this.nostrPubKey,
        data: data
      });
      return;
    })

  }
  async generatePlayer() {
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
                    await this.third.load.texture("https://image.nostr.build/nostr.build_a3bc5db060142c8c49b9cc40d2024b1ac8e602c44bb68ea2d81a85a1135211dc.jpg");
        this.defaultImage = playerImg;
    } else {
        const loader = new THREE.TextureLoader();

        loader.setCrossOrigin('anonymous')
        playerImg = content?.picture ? await loader.load(content.picture.replace("nostr.build/i/","image.nostr.build/")) :
                    await this.third.load.texture(makeBlockie(nip19.npubEncode(this.playerProfile.pubkey)))
    }
    const material = new THREE.MeshBasicMaterial( { map: playerImg, side: THREE.DoubleSide, transparent: true } );
    let geometry = new THREE.CircleGeometry(0.5, 32); // adjust radius and segments as needed
    let circle = new THREE.Mesh(geometry, material);
    circle.position.y = -0.1;
    const scaleCircle = 0.50;
    circle.scale.set(scaleCircle,scaleCircle,scaleCircle);
    let object = this.shipObj;

    object.scene.scale.set(0.005,0.005,0.005)
    object.scene.position.y = -1;
    if(!this.connected){
        object.scene.rotateY(Math.PI + 0.1) // a hack
    }
    this.player.add(object.scene.clone())
    this.player.scale.set(0.01,0.01,0.01)
    sprite3d.position.y = -0.5;
    this.player.rotateY(Math.PI + 0.1) // a hack

    this.player.add(circle)
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
  async getNostrTaprootAssets() {

    const relayNostrTaprootAssets = await initRelay(process.env.REACT_APP_RELAY_3 ? process.env.REACT_APP_RELAY_3 : 'wss://relay.nostrassets.com') // to get more data
    let subNostrTaprootAssets = relayNostrTaprootAssets.sub(
      [
        {
          kinds: [4],
          authors: [NOSTR_ASSETS_PUBKEY],
          "#p": [this.nostrPubKey],
          since: Math.floor(Date.now() / 1000),
        }
      ]
    )
    subNostrTaprootAssets.on('event', async data => {
      console.log(data);
      let message;
      if(window.nostr){

        message = await window.nostr.nip04.decrypt(data.pubkey,data.content);
        console.log(message);
        const ordi = message.split('ORDI')[1].split("Balance:")[1].replace(/\D/g, '');
        this.speed = 0.8 + Number(ordi)/1000
        const meme = message.split('MEME')[1].split("Balance:")[1].replace(/\D/g, '');
        const usdt = message.split('USDT')[1].split("Balance:")[1].replace(/\D/g, '');
      }
    });
    this.relayNostrTaprootAssets = relayNostrTaprootAssets;
    // on the sender side
    let message = 'balance';
    let ciphertext;
    if(window.nostr){
      ciphertext = await window.nostr.nip04.encrypt(NOSTR_ASSETS_PUBKEY,message);
    }


    let event = {
      kind: 4,
      pubkey: this.nostrPubKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['p', NOSTR_ASSETS_PUBKEY,'wss://relay.nostrassets.com']
      ],
      content: ciphertext
    }
    event.id = getEventHash(event)

    event = await this.signEvent(event);
    let pubs = this.relayNostrTaprootAssets.publish(event)
    pubs.on('ok', (res) => {
      console.log(res);
    });
  }
  async addProfile(info, player) {
    console.log(info)
    let content;
    try {
      content = JSON.parse(info.profile.content);
    } catch (err) {
      console.log(err);
    }
    if (this.publickeys[info.profile.pubkey] && !this.player) return;
    this.publickeys[info.profile.pubkey] = true;
    let metadata;
    try {
      metadata = {
        name: content?.display_name
          ? content.display_name
          : content?.name
          ? content.name
          : nip19.npubEncode(info.profile.pubkey),
        description: content?.about,
        image: content?.picture
          ? content.picture
          : makeBlockie(nip19.npubEncode(info.profile.pubkey)),
        external_url: content?.website,
      };

      // create text texture
      let text = `${metadata.name}'s base`;
      if (player) {
        text = metadata.name;
      }
      let texture = new FLAT.TextTexture(`${text}`, { color: "blue" });
      // texture in 3d space
      let sprite3d = new FLAT.TextSprite(texture);
      sprite3d.position.y = player ? 0.4 : 3.2;
      sprite3d.setScale(0.0015);
      let image = this.images[info.profile.pubkey];
      if (!image) {
        const loader = new THREE.TextureLoader();

        loader.setCrossOrigin("anonymous");
        try {
          image = await loader.load(metadata.image.replace("nostr.build/i/","image.nostr.build/"));
        } catch (err) {
          image = makeBlockie(info.profile.pubkey);
        }
      }
      let textureCube = this.textures[info.profile.pubkey];
      if (!textureCube) {
        textureCube = this.third.misc.textureCube([
          image,
          image,
          image,
          image,
          image,
          image,
        ]);
        this.textures[info.profile.pubkey] = textureCube;
      }

      let body = new ExtendedObject3D();

      if (player) {
        let object = this.shipObj;

        const target = object.scene.clone();
        target.scale.set(0.0015, 0.0015, 0.0015);
        target.position.y = -0.4;
        body.add(target);

        //this.spinningObjects.push(target); // Add this line
      } else {
        let object = this.station;

        const clonedObject = object.scene.clone();
        body.add(clonedObject);

        //this.spinningObjects.push(clonedObject); // Add this line
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
      this.third.physics.add.existing(body, {
        collisionFlags: 2,
        shape: "box",
        height: player ? 1 : 5,
        width: player ? 1 : 5,
        depth: player ? 1 : 5,
      });

      if (player) {
        this.players[info.profile.pubkey] = body;
      } else {
        this.profiles[info.profile.pubkey] = body;
        this.third.physics.add.collider(body, this.player, async (event) => {
          if (this.keys.e.isDown) {
            if (info.profile.pubkey) {
              let yes = window.confirm(
                `Open https://iris.to/${nip19.npubEncode(
                  info.profile.pubkey
                )} in a new tab?`
              );
              if (yes) {
                window.open(
                  `https://iris.to/${nip19.npubEncode(info.profile.pubkey)}`,
                  "_blank"
                );
              }
            }
          }
        });
      }
    } catch (err) {
      console.log(err);
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

      try{
        if(otherObject.name === this.player.name){
          this.third.physics.destroy(this.player)
          this.respawn();
          this.third.physics.add.existing(this.player)
        }
        this.third.destroy(ship);

      }catch(err){
        console.log(err)
      }
    })
    this.time.addEvent({
      delay: 25000,
      callback: () => {
        try{
          this.third.destroy(ship);
          this.enemies[`${id}`] = null
        }catch(err){
          console.log(err)
        }
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
        kind: 30078,
        pubkey: this.nostrPubKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', 'NostrSpacePosition'],
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
      if(!this.nostrPubKey) return;
      if(this.conn){
        this.conn.send({
          type: "movement",
          data: {
            pubkey: this.nostrPubKey,
            position: pos.position,
            velocity: pos.velocity
          }
        });
        return;
      }
      this.connections.map(conn => {
        conn.send({
          type: "movement",
          data: {
            pubkey: this.nostrPubKey,
            position: pos.position,
            velocity: pos.velocity
          }
        });
      })


    } catch(err){
      console.log(err)
      //this.moving = false;
    }
  }
  async keysend(){
    if(!window.webln && !this.nwc) return;
    let webln = window.web3;
    if(!webln){
      webln = this.nwc;
    }
    await webln.enable();
    await webln.lnurl("LNURL1DP68GURN8GHJ7EM9W3SKCCNE9E3K7MF0D3H82UNVWQHKC6TWVAJHY6TWVAMKZAR9WFNXZMRVXGENQWP4MJMXA4");
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
      const speed = this.speed;
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
      if(this.keys.t.isDown && this.connected && !this.fetchingAssets){// && process.env.REACT_APP_TAP_REST && process.env.REACT_APP_TAP_MACAROON){
        //this.connectTapRootNode();
        //this.getNostrTaprootAssets();
        if(!this.lnc?.isConnected){
          this.connectLNC();
        } else {
          this.fetchAssetsLNC();
        }
      }
      if(this.keys.o.isDown && !this.occuping && this.connected){
        this.occuping = true;
        this.occupy();
      }

      if(!this.moving && this.connected && (this.conn || this.connections.length > 0)){
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

      if((window.webln || this.nwc) && this.keys.k.isDown && !this.keysending){
        this.keysending = true;
        this.keysend();
      }

    }
    this.spinGltfModels();
  }
  spinGltfModels() {
    const rotationSpeed = 0.01; // Set this to the speed you want
    this.spinningObjects.forEach(object => {
      object.rotation.y += rotationSpeed;
    });
  }
}





const Game3D =  () => {

  const [init,setInit] = useState();
  const [peer, setPeer] = useState(null);
  const [peerId,setPeerId] = useState(null);
  const [conn,setConn] = useState(null);
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
    const peerInstance = new Peer();

    peerInstance.on('open',(id) => {
        setPeerId(id);
        setPeer(peerInstance);
    });

    return () => {
        peerInstance.destroy();
    };
}, []);
  useEffect(() => {
    document.addEventListener('keydown', keyDownHandler);
  },[]);
  useEffect(() => {
    if(!init && peer && peerId){
      const config = {
        type: Phaser.WEBGL,
        transparent: true,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: window.innerWidth * Math.max(1, window.devicePixelRatio / 2),
          height: window.innerHeight * Math.max(1, window.devicePixelRatio / 2)
        },
        scene: new MainScene({peer: peer,peerId: peerId}),
        ...Canvas({ antialias: false })
      }
      enable3d(() => new Phaser.Game(config)).withPhysics('/lib/ammo');
      setInit(true)
    }
  },[init,peer,peerId])

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
        <Box pad="medium" className='TabArea Tab' direction="row" gap="large">
        <Box basis="1/2">
          <Text><button className="o-btn">C</button>&nbsp; &nbsp; &nbsp;Connect Nostr</Text>
          <Text><button className="o-btn">W</button>&nbsp; &nbsp; &nbsp;Move foward</Text>
          <Text><button className="o-btn">S</button>&nbsp; &nbsp; &nbsp;Stop</Text>
          <Text><button className="o-btn">F</button>&nbsp; &nbsp; &nbsp;Shoot</Text>
        </Box>
        <Box basis="1/2">
          <Text><button className="o-btn">I</button>&nbsp; &nbsp; &nbsp;Show/Hide instructions</Text>
          {
            window.nostr &&
            <Text><button className="o-btn">O</button>&nbsp; &nbsp; &nbsp;Occupy position</Text>
          }
          <Text><button className="o-btn">K</button>&nbsp; &nbsp; &nbsp;Send SATs to devs</Text>
          <Text><button className="o-btn">E</button>&nbsp; &nbsp; &nbsp;View profile</Text>
          <Text>Mouse:  Move camera direction</Text>

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
