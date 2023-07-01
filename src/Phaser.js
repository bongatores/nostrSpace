import {useEffect,useState} from  'react';

import Phaser from 'phaser';
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


let topicMovements = 'hash-avatars/games/first-contact/movements';

let metadata;
let coinbaseGame;
let contractAddress;
let ipfs;
let textInput;
let mapHash = "bafybeiflup6dpz7wcqdi5k7u43pb722ietk3tlr2iknip635p3r4gg2sie";
let mapTiles = "bafkreier6xkncx24wj4wm7td3v2k3ea2r2gpfg2qamtvh7digt27mmyqkm";

let mapName = "!CL_DEMO_32x32";

export const setAttributes = (mt,cG,cA,r,mH,mN,tM,mT) => {
  metadata = mt
  coinbaseGame = cG;
  contractAddress = cA;
  ipfs = r;
  if(mH){
    mapHash = mH;
  }
  if(mN){
    mapName = mN;
  }
  if(tM){
    topicMovements = tM;
  }
  if(mT){
    mapTiles = mT;
  }
}

export const setTextInput = (tI) => {
  textInput = tI;
}

const pool = new SimplePool()


class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' })
    this.nostrPubKey = null;
    this.totalPlayers = 1;
    this.chatMessages = [];
    this.profiles = [];
  }

  init(){
    this.cameras.main.setBackgroundColor('#24252A');

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
    this.third.destroy(this.player);
    await this.generatePlayer()
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

  async subscribeNostrEvents(){
    let sub = pool.sub(
      relays,
      [
        {
          '#t': ['nostr-space'],
          kinds: [12301,29211]
        },
        {
          kinds: [0],
          limit: 50
        },
        {
          kinds: [40],
          limit: 5
        },
        {
          kinds: [7],
          since: Math.floor(Date.now() / 1000),
          limit: 10
        }
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
      const bytesEvent = stringToBytes(data.id);


      if(data.kind === 0 && subProfileData.content){

        const pos = {x: bytesEvent[0] * 10,y: bytesEvent[4]* 10}
        //  Add a player ship and camera follow
        const loader = new Phaser.Loader.LoaderPlugin(this);
        console.log(loader)
        const enemy = this.physics.add.sprite(
         pos.x,
         pos.y,
          'ship');
        enemy.setBounce(0).setCollideWorldBounds(true);
        const content = JSON.parse(subProfileData.content);
        loader.image(subProfileData.pubkey,content.picture);

        loader.once(Phaser.Loader.Events.COMPLETE, () => {
          // texture loaded so use instead of the placeholder
          enemy.setTexture(subProfileData.pubkey)
        })
        loader.start();

        enemy.displayWidth = 64;
        //scale evenly
        enemy.scaleY = enemy.scaleX;
      }

      if(data.kind === 12301){

      }

      if(data.kind === 7){


      }


      if(data.kind === 40){

       const pos = {x: bytesEvent[0],y: bytesEvent[4]}
       //  Add a player ship and camera follow
       const enemy = this.physics.add.sprite(
        pos.x,
        pos.y,
         'ship');
       enemy.setBounce(0).setCollideWorldBounds(true);
       enemy.displayWidth = 64;
       //scale evenly
       enemy.scaleY = enemy.scaleX;
      }
     })
  }
  preload = () => {
    let progressBar = this.add.graphics();
    let progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(240, 270, 320, 50);

    let width = this.cameras.main.width;
    let height = this.cameras.main.height;
    let loadingText = this.make.text({
        x: width / 2,
        y: height / 2 - 50,
        text: 'Loading...',
        style: {
            font: '20px monospace',
            fill: '#ffffff'
        }
    });
    loadingText.setOrigin(0.5, 0.5);

    let percentText = this.make.text({
        x: width / 2,
        y: height / 2 - 5,
        text: '0%',
        style: {
            font: '18px monospace',
            fill: '#ffffff'
        }
    });
    percentText.setOrigin(0.5, 0.5);

    let assetText = this.make.text({
        x: width / 2,
        y: height / 2 + 50,
        text: '',
        style: {
            font: '18px monospace',
            fill: '#ffffff'
        }
    });
    assetText.setOrigin(0.5, 0.5);
    this.load.on('progress', function (value) {
      percentText.setText(parseInt(value * 100) + '%');
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(250, 280, 300 * value, 30);
    });

    this.load.on('complete', function () {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
      assetText.destroy();
    });
    console.log(this);

    this.load.image('ship', "https://nostr.build/i/nostr.build_a3bc5db060142c8c49b9cc40d2024b1ac8e602c44bb68ea2d81a85a1135211dc.jpg");


    this.load.image("tiles", `https://ipfs.io/ipfs/${mapTiles}`);

    this.load.tilemapTiledJSON("map", `https://ipfs.io/ipfs/${mapHash}`);


  }

  create = async () => {

    const map = this.make.tilemap({key: 'map'});
    let layers = [];
    this.map = map;
    // AUDIO
    var audioLoader = new THREE.AudioLoader();
    var listener = new THREE.AudioListener();
    var audio = new THREE.Audio(listener);
    audioLoader.load("https://cdn.rawgit.com/ellenprobst/web-audio-api-with-Threejs/57582104/lib/TheWarOnDrugs.m4a", function(buffer) {
        audio.setBuffer(buffer);
        audio.setLoop(true);
        audio.play();
    });
    //this.add.image(1000,1020,'background')
    // Parameters are the name you gave the tileset in Tiled and then the key of the tileset image in
    // Pody.stop();ody.stop();haser's cache (i.e. the name you used in preload)
    const tileset = map.addTilesetImage(mapName, "tiles");

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
//    this.otherPlayers = this.physics.add.group();
//    this.friendlyPlayers = this.physics.add.group();
    for(let layer of map.layers){
      const l = map.createLayer(layer.name,tileset,0,0);
      console.log(l)

      layers.push(l)
      l.setCollisionByProperty({ collides: true });
    }
    //  Add a player ship and camera follow
    this.player = this.physics.add.sprite(
      Phaser.Math.Between(map.widthInPixels/2, map.widthInPixels/3),
      Phaser.Math.Between(map.heightInPixels/2, map.heightInPixels/3),
      'ship');
    this.player.setBounce(0).setCollideWorldBounds(true);
    this.player.displayWidth = 64;
    //scale evenly
    this.player.scaleY = this.player.scaleX;



    for(let l of layers){
      let collides = false;
      if(l.layer.properties[0]){
          if(l.layer.properties[0].value === true){
            collides = true
          }
      }
      if(l.layer.data[0][0].properties.collides){
        collides = true
      }
      console.log(collides)
      if(collides){
        this.physics.add.collider(this.player,l);
//        this.physics.add.collider(this.otherPlayers,l);
//        this.physics.add.collider(this.friendlyPlayers, l);
        l.setCollisionByExclusion([-1]);

      }
    }

    this.cameras.main.startFollow(this.player, false, 0.2, 0.2);
    this.cameras.main.setZoom(1);

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);


    this.cursors = this.input.keyboard.createCursorKeys();
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

    /*
    this.physics.add.collider(this.player,this.friendlyPlayers,(player,friend) => {
      player.setVelocity(0,0);
      player.setAcceleration(0,0);
      player.stop();
      friend.setVelocity(0,0);
      friend.setAcceleration(0,0);
      friend.stop();
    },null,this);
    */
//    this.physics.add.collider(this.player,this.otherPlayers,this.handleCollision,null, this);



    this.prepareChat();
    this.subscribeNostrEvents()
    window.addEventListener('resize', this.resize);
    this.resize();

  }

  update = async () => {

    if(this.chat){
      this.chat.x = this.player.body.position.x + 280 ;
      this.chat.y = this.player.body.position.y - 150;
    }
    if(this.totalPlayersCounter){
      this.totalPlayersCounter.x = this.player.body.position.x + 280 ;
      this.totalPlayersCounter.y = this.player.body.position.y - 200;
    }
    if (this.cursors.left.isDown){
      this.player.setVelocityX(-150);
    } else if (this.cursors.right.isDown){
      this.player.setVelocityX(150);
    } else if (this.cursors.up.isDown){
      this.player.setVelocityY(-150);
    } else if (this.cursors.down.isDown){
      this.player.setVelocityY(150);
    } else {
      this.player.setVelocity(0);
    }

    if((this.cursors.left.isDown || this.cursors.right.isDown || this.cursors.up.isDown || this.cursors.down.isDown) &&
       !this.msgMovementStarted){

      this.msgMovementStarted = true;

    }
    if(!(this.cursors.left.isDown || this.cursors.right.isDown || this.cursors.up.isDown || this.cursors.down.isDown) &&
       this.msgMovementStarted){

      this.msgMovementStarted = false;

    }


    if(this.keys.c.isDown && !this.connecting && !this.connected){
      this.connecting = true;
      this.connect();
    }

  }


  prepareChat = () => {
    this.totalPlayersCounter = this.add.text(this.player.x + 280, this.player.y - 200,`Total of ${this.totalPlayers} players online`, { lineSpacing: 15, backgroundColor: "#21313CDD", color: "#26924F", padding: 10, fontStyle: "bold",fontSize: '10px' });

    this.chat = this.add.text(this.player.x + 280, this.player.y - 150, "", { lineSpacing: 15, backgroundColor: "#21313CDD", color: "#26924F", padding: 10, fontStyle: "bold",fontSize: '10px' });
    this.chat.setFixedSize(400, 300);

    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.enterKey.on("down", async event => {
      if (textInput.value !== "") {
        textInput.value = ""
      }
    })
  }


  resize = () => {
    const canvas = this.game.canvas, width = window.innerWidth, height = window.innerHeight;
    const wratio = width / height, ratio = canvas.width / canvas.height;
    if (wratio < ratio) {
        canvas.style.width = width + "px";
        canvas.style.height = (width / ratio) + "px";
    } else {
        canvas.style.width = (height * ratio) + "px";
        canvas.style.height = height + "px";
    }
  }

}



const config = {
  width: "99%",
  type: Phaser.AUTO,
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0,x:0 },
      debug: false
    }
  },
  scene: [MainScene],
};

const Game =  () => {

  const [init,setInit] = useState();

  useEffect(() => {
    if(!init){
      new Phaser.Game(config);
      init = true;
    }
  },[])

  return(
    <>
    </>
  )
}
export default Game
