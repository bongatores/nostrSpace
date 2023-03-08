import { useEffect, useRef } from 'react'
import * as THREE from 'three';
import {
  SimplePool,
  nip19
} from 'nostr-tools'
import makeBlockie from 'ethereum-blockies-base64';
import { relays } from './utils';
import SpriteText from 'three-spritetext';
import * as CANNON from 'cannon-es'


import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { useAppContext } from './hooks/useAppState';


const pool = new SimplePool()

const delay = ms => new Promise(res => setTimeout(res, ms));

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

export default function Game(props) {


  const { state,actions } = useAppContext();
  const ref = useRef({});

  useEffect(() => {
    init();
    animate();
  }, []);
  useEffect(() => {
    ref.current = state;
  }, [state]);

  let camera, scene, renderer, controls;
  const objects = [];
  const maxBodies = 150;
  let raycaster;
  let player;
  let moveForward = false;
  let moveBackward = false;
  let moveLeft = false;
  let moveRight = false;
  let canJump = false;
  let publickeys = [];
  let world;

  let prevTime = performance.now();
  const velocity = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const color = new THREE.Color();
  const infos = [];
  let collision = false;
  let gameText;
  let bodies = [];
  let playerBody;
  const occupySpace = async () => {
    camera.updateMatrixWorld();
    const vector = camera.position.clone();
    console.log(vector)
    const x = (vector.x).toFixed(0);
    const z = (vector.z).toFixed(0);
    console.log(`Inserting data at ${x},${z}`);
    console.log(ref.current)
  }

  const onKeyDown = async function (event) {

    switch (event.code) {

      case 'ArrowUp':
      case 'KeyW':
        moveForward = true;
        break;

      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = true;
        break;

      case 'ArrowDown':
      case 'KeyS':
        moveBackward = true;
        break;

      case 'ArrowRight':
      case 'KeyD':
        moveRight = true;
        break;

      case 'KeyP':
        console.log(ref.current)
        if(!ref.current?.lock) return;
        occupySpace();
        break;

      case 'KeyU':
        const vector = player ? player.position.clone() : camera.position.clone();
        const x = (vector.x).toFixed(0);
        const z = (vector.z).toFixed(0);
        console.log(infos[`${x}_${z}`])
        console.log(`Player pos (${x},${z})`)
        const info = infos[`${x}_${z}`]
        if(info.pubkey){
          let yes = window.confirm(`Open https://iris.to/${nip19.npubEncode(info.pubkey)} in a new tab?` );
          if(yes) {
            window.open(`https://iris.to/${nip19.npubEncode(info.pubkey)}`,"_blank")
          }
        }
        break;
      case 'Space':
        if (canJump === true) velocity.y += 350;
        canJump = false;
        break;

    }

  };

  const setGameMessage = (text) => {
    const dist = 50;
    const cwd = new THREE.Vector3();
    camera.getWorldDirection(cwd);

    cwd.multiplyScalar(dist);
    cwd.add(camera.position);

    text.position.set(cwd.x, cwd.y+3, cwd.z);
    text.setRotationFromQuaternion(camera.quaternion);
    scene.add(text);
    gameText = text
    setTimeout(() => {
      scene.remove(text);
      gameText = null;
    },8000);
  }

  const onKeyUp = function (event) {

    switch (event.code) {

      case 'ArrowUp':
      case 'KeyW':
        moveForward = false;
        break;

      case 'ArrowLeft':
      case 'KeyA':
        moveLeft = false;
        break;

      case 'ArrowDown':
      case 'KeyS':
        moveBackward = false;
        break;

      case 'ArrowRight':
      case 'KeyD':
        moveRight = false;
        break;

    }

  };

  const addInfo = async (info) => {
    const content = JSON.parse(info.profile.content);
    if(publickeys[content.name ? content.name : content.display_name ? content.display_name : info.profile.pubkey]) return;
    publickeys[content.name] = true;
    let metadata;
    if(!content.name && !content.display_name){
      return;
    }
    console.log(`${content.display_name ? content.display_name : content.name} at ${info.x},${info.z}`)
    if(infos[`${info.x}_${info.z}`]){
      scene.remove(infos[`${info.x}_${info.z}`]);
    }
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

      const gameInfo = new THREE.Group()
      var geometry = new THREE.BoxGeometry(14, 14, 14, 1, 1, 1);
      let imgTexture = new THREE.TextureLoader().load(makeBlockie(info.profile.pubkey));
      try{
        imgTexture = new THREE.TextureLoader().load(metadata.image.replace("ipfs://", "https://nftstorage.link/ipfs/"));
      } catch(err){
        console.log(err)
      }
      const boxBody = new CANNON.Body({
        mass: 5, // kg
        shape: new CANNON.Box(new CANNON.Vec3(1,1,1))
      })

      boxBody.position.set(info.x, 15 , info.z);
      boxBody.quaternion.set(0, 0, 0, 1);
      world.addBody(boxBody);

      const material = new THREE.MeshBasicMaterial({ map: imgTexture,transparent:true, opacity: 1 });
      const cube = new THREE.Mesh(geometry,material);

      const materialSprite = new THREE.SpriteMaterial({ map: imgTexture });
      const sprite = new THREE.Sprite(materialSprite);
      sprite.scale.set(10, 10, 10)
      console.log(metadata)
      const name = new SpriteText(metadata.name, 5, "red");
      const description = new SpriteText(metadata.description, 3, "blue")
      const external_url = new SpriteText(metadata.external_url, 1, "green");
      name.position.y = 40;
      description.position.y = 25;
      external_url.position.y = 20
      sprite.position.y = 12;
      gameInfo.add(sprite)
      gameInfo.add(cube)
      gameInfo.add(name)
      gameInfo.add(description)
      gameInfo.add(external_url)
      //gameInfo.position.set(info.x, 5 , info.z)
      gameInfo.scale.set(0.5,0.5,0.5)
      gameInfo.name = metadata.name;
      gameInfo.uri = metadata.external_url?.replace("ipfs://","https://ipfs.io/ipfs/");
      gameInfo.position.copy(boxBody.position);
      gameInfo.quaternion.copy(boxBody.quaternion);

      scene.add(gameInfo);
      infos[`${info.x}_${info.z}`] = info;
      bodies.push({
        mesh: gameInfo,
        body: boxBody
      })

    } catch(err){
      console.log(err)
    }
  }

  const loadPlayer = async () => {
    const content = JSON.parse(ref.current.profile.content);
    const geometry = new THREE.BoxGeometry(14, 14, 14, 1, 1, 1);

    let imgTexture = new THREE.TextureLoader().load(makeBlockie(ref.current.profile.pubkey));
    try{
      imgTexture = new THREE.TextureLoader().load(content.picture.replace("ipfs://", "https://nftstorage.link/ipfs/"));
    } catch(err){
      console.log(err)
    }
    const gameInfo = new THREE.Group()
    const material = new THREE.MeshBasicMaterial({ map: imgTexture,transparent:true, opacity: 1 });

    const materialSprite = new THREE.SpriteMaterial({ map: imgTexture });
    const sprite = new THREE.Sprite(materialSprite);
    sprite.scale.set(10, 10, 10)
    const name = new SpriteText(content.display_name ? content.display_name : content.name ? content.name : state.profile.pubkey , 5, "red");
    const description = new SpriteText(content.about, 3, "blue")
    const external_url = new SpriteText(content.website, 1, "green");
    name.position.y = 40;
    description.position.y = 25;
    external_url.position.y = 20
    sprite.position.y = 5;
    gameInfo.add(sprite)
    gameInfo.add(name)
    gameInfo.add(description)
    gameInfo.add(external_url)
    const vector = camera.position.clone();
    const x = vector.x;
    const z = vector.z;
    const boxBody = new CANNON.Body({
      mass: 5, // kg
      shape: new CANNON.Box(new CANNON.Vec3(1,1,1))
    })

    boxBody.position.set(x, 15 , z);
    boxBody.quaternion.set(0, 0, 0, 1);
    world.addBody(boxBody);
    gameInfo.position.copy(boxBody.position);
    gameInfo.quaternion.copy(boxBody.quaternion);
    //gameInfo.position.set(x, 5 , z);
    console.log(gameInfo.position)
    gameInfo.scale.set(0.5,0.5,0.5)
    gameInfo.name = content.display_name ? content.display_name : content.name ? content.name : state.profile.pubkey;
    gameInfo.uri = content.website;
    scene.add(gameInfo);
    player = gameInfo;
    playerBody = boxBody;
    //controls = new PointerLockControls(player, document.body);


  }

  const checkUris = async () => {
    ref.current = {
      ...ref.current,
      contractInitiated: true
    }
    let events = await pool.list(relays, [{kinds: [0]}])
    console.log(events)

    for(let i = 0; i < events.length; i++){
      if(bodies.length > maxBodies) break;
      let info = {
        x: getRandomInt(2000),
        z: getRandomInt(2000),
        profile: events[i]
      }
      await addInfo(info);
      await delay(500)
    }

  }

  const generateFloor = () => {
    // floor

    let floorGeometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
    //floorGeometry.rotateX(- Math.PI / 2);

    // vertex displacement

    let position = floorGeometry.attributes.position;
    const dataY = [];
    for(var i = 0; i < 1000; i++){
    var y = 0.5 * Math.cos(0.2 * i);
    dataY.push(y);
}

    for (let i = 0, l = position.count; i < l; i++) {

      vertex.fromBufferAttribute(position, i);

      vertex.x += Math.random() * 20 - 10;
      vertex.y += Math.random() * 20 - 10;
      vertex.z += Math.random() * 20 - 10;
      //dataY.push(vertex.y);
      position.setXYZ(i, vertex.x, vertex.y, vertex.z);

    }

    floorGeometry = floorGeometry.toNonIndexed(); // ensure each face has unique vertices

    position = floorGeometry.attributes.position;
    const colorsFloor = [];

    for (let i = 0, l = position.count; i < l; i++) {

      color.setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75);
      colorsFloor.push(color.r, color.g, color.b);

    }

    floorGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colorsFloor, 3));

    const floorMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    //floor.position.set(1000,0,1000)
    // ground body
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane()
    });
    // Create the heightfield shape
    var heightfieldShape = new CANNON.Heightfield(dataY, {
        elementSize: 1 // Distance between the data points in X and Y directions
    });
    var heightfieldBody = new CANNON.Body();
    heightfieldBody.addShape(heightfieldShape);
    world.addBody(heightfieldBody);
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0) // make it face up
    groundBody.position.set(1000,0,1000)
    world.addBody(groundBody);
    floor.position.copy(groundBody.position);
    floor.quaternion.copy(groundBody.quaternion);
    //floor.rotateX( - Math.PI / 2);

    scene.add(floor);
  }

  const init = async () => {

    ref.current = {
      ...ref.current,
      lock: false
    }
    world = new CANNON.World({gravity: new CANNON.Vec3(0,-9.82, 0)});

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(1000,1,1000);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    scene.fog = new THREE.Fog(0xffffff, 0, 750);
    const light = new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75);
    light.position.set(0.5, 1, 0.75);
    scene.add(light);
    controls = new PointerLockControls(camera, document.body);

    const blocker = document.getElementById('blocker');
    const instructions = document.getElementById('instructions');

    instructions.addEventListener('click', function () {
      controls.lock();
      ref.current = {
        ...ref.current,
        lock: true
      }
    });

    controls.addEventListener('lock', function () {

      instructions.style.display = 'none';
      blocker.style.display = 'none';
      ref.current = {
        ...ref.current,
        lock: true
      }

    });

    controls.addEventListener('unlock', function () {

      blocker.style.display = 'block';
      instructions.style.display = '';
      ref.current = {
        ...ref.current,
        lock: false
      }
    });

    scene.add(controls.getObject());

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, - 1, 0), 0, 10);
    generateFloor();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    document.getElementById("canvas-container").appendChild(renderer.domElement);

    let sub = pool.sub(
      [...relays],
      [
        {
          kinds: [0]
        }
      ]
    )

    sub.on('event', async event => {
      //console.log('we got the event we wanted:', event)
      if(event.content){
        if(bodies.length > maxBodies) return;
        const name = JSON.parse(event.content).display_name;
        if(name){
          let info = {
            x: getRandomInt(2000),
            z: getRandomInt(2000),
            profile: event
          }
          await addInfo(info);
        }
      }
    })
    sub.on('eose', () => {
      sub.unsub()
    });

    window.addEventListener('resize', onWindowResize);

  }
  const initPhysics = () => {
    world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0), // m/s²
    });
    const radius = 1 // m
    const sphereBody = new CANNON.Body({
      mass: 5, // kg
      shape: new CANNON.Sphere(radius),
    })
    sphereBody.position.set(0, 10, 0) // m
    world.addBody(sphereBody);
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
    })
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0) // make it face up
    world.addBody(groundBody)
  }
  function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

  }

  async function animate() {
    const contractInitiated = ref.current?.contractInitiated;
    world.fixedStep();

    if (!contractInitiated) {
      await delay(2000)
      checkUris();
    }
    if(!player && ref.current?.profile){
      loadPlayer();
    }
    if(player){
      player.position.copy(playerBody.position);
      player.quaternion.copy(playerBody.quaternion);
      camera.lookAt(player.position);
    }

    const dist = 40;
    const cwd = new THREE.Vector3();
    camera.getWorldDirection(cwd);
    cwd.multiplyScalar(dist);
    cwd.add(camera.position);
    if(player){
      player.position.set(cwd.x, cwd.y+2, cwd.z);
    }
    if(gameText){
      gameText.position.set(cwd.x, cwd.y+4, cwd.z);
    }
    requestAnimationFrame(animate);
    // Run the simulation independently of framerate every 1 / 60 ms
    world.fixedStep();
    bodies.map(obj => {
      obj.mesh.position.copy(obj.body.position)
      obj.mesh.quaternion.copy(obj.body.quaternion)
    })
    const time = performance.now();
    if (controls.isLocked === true) {

      raycaster.ray.origin.copy(controls.getObject().position);
      raycaster.ray.origin.y -= 10;

      const intersections = raycaster.intersectObjects(objects, false);

      const onObject = intersections.length > 0;

      const delta = (time - prevTime) / 1000;

      velocity.x -= velocity.x * 10.0 * delta;
      velocity.z -= velocity.z * 10.0 * delta;

      velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

      direction.z = Number(moveForward) - Number(moveBackward);
      direction.x = Number(moveRight) - Number(moveLeft);
      direction.normalize(); // this ensures consistent movements in all directions

      if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
      if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

      if (onObject === true) {

        velocity.y = Math.max(0, velocity.y);
        canJump = true;

      }

      controls.moveRight(- velocity.x * delta);
      controls.moveForward(- velocity.z * delta);

      controls.getObject().position.y += (velocity.y * delta); // new behavior

      if (controls.getObject().position.y < 10) {

        velocity.y = 0;
        controls.getObject().position.y = 10;

        canJump = true;

      }

    }
    camera.updateMatrixWorld();

    prevTime = time;

    renderer?.render(scene, camera);

  }

  return (
    <>
    </>
  )
}
