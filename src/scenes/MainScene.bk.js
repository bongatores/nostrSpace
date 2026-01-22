import {
    Scene3D,
    ExtendedObject3D,
    THREE,
    PointerLock,
    PointerDrag,
    FLAT,
    JoyStick,
    ThirdPersonControls // Import ThirdPersonControls here for proper setup
} from '@enable3d/phaser-extension';
import { Buffer } from 'buffer';
import { stringToBytes } from 'convert-string';
import { Player } from '../game/Player';
import { Enemy } from '../game/Enemy';
import { Base } from '../game/Base';
import { Projectile } from '../game/Projectile';
import { PeerManager } from '../game/PeerManager';
import { NostrManager } from '../game/NostrManager';
import { GAME_CONSTANTS, NOSTR_CONSTANTS, TEXTURE_PATHS } from '../game/constants';
import { connectNostrWallet, generateEphemeralKeys } from '../utils';
import LNC from '@lightninglabs/lnc-web';
import { webln } from '@getalby/sdk';

export class MainScene extends Scene3D {
    constructor(data) {
        super({ key: 'MainScene' });
        this.peerId = data.peerId;
        this.initialServerId = data.serverId;
        this.peerJsInstance = data.peerJsInstance;
    }

    init() {
        this.accessThirdDimension({ maxSubSteps: 10, fixedTimeStep: 1 / 120 });
        this.third.renderer.outputEncoding = THREE.LinearEncoding;
        this.isTouchDevice = 'ontouchstart' in window;

        this.player = null; // Will hold the Player object
        this.nostrPubKey = null;
        this.sk = null;
        this.nwc = null;
        this.lnc = null;
        this.currentSpeed = GAME_CONSTANTS.PLAYER_SPEED;

        this.connectingNostr = false;
        this.connectedNostr = false;
        this.fetchingLNCAssets = false;
        this.occupyingPosition = false;
        this.canShoot = true;
        this.sendingKeysend = false;
        this.sendingMovement = false;

        this.moveForward = false;
        this.moveTop = 0;
        this.moveRight = 0;

        this.profiles = {}; // Stores Base objects (player bases/stations)
        this.players = {}; // Stores other Player objects (remote players)
        this.enemies = {}; // Stores Enemy objects

        this.spinningObjects = [];

        this.peerManager = null;
        this.nostrManager = null;

        this.defaultProfileImageTexture = null;
        this.shipModel = null;
        this.stationModel = null;
        this.enemyShipModel = null;
    }

    preload() {
        // Preload the default profile picture to ensure it's ready
        this.load.texture('defaultProfilePic', TEXTURE_PATHS.DEFAULT_PROFILE_PIC);
    }

    async create() {
        this.stringToBytes = stringToBytes;

        const { lights } = await this.third.warpSpeed('-ground', '-orbitControls', '-sky');
        lights.hemisphereLight.intensity = 0.65;
        lights.ambientLight.intensity = 0.65;
        lights.directionalLight.intensity = 0.65;
        this.third.physics.setGravity(0, 0, 0);

        // Load all necessary GLTF models and skybox texture concurrently
        await Promise.all([
            this.third.load.gltf(TEXTURE_PATHS.SHIP).then(gltf => this.shipModel = gltf),
            this.third.load.gltf(TEXTURE_PATHS.STATION).then(gltf => this.stationModel = gltf),
            this.third.load.gltf(TEXTURE_PATHS.ENEMY_SHIP).then(gltf => this.enemyShipModel = gltf),
            this.loadSkybox()
        ]);

        // Get the preloaded default image texture
        this.defaultProfileImageTexture = this.textures.get('defaultProfilePic');

        // Initialize PeerJS Manager with the instance and IDs from App.js
        this.peerManager = new PeerManager(this.peerId, this.initialServerId, this.peerJsInstance);

        this.peerManager.on('peerIdReady', (id) => {
            this.peerId = id;
            console.log("MainScene: PeerManager's ID is ready:", this.peerId);
        });
        this.peerManager.on('peerError', (err) => console.error("PeerManager Error:", err));
        this.peerManager.on('peerDataReceived', (payload) => this.handlePeerData(payload.from, payload.data));
        this.peerManager.on('peerConnected', (peerId) => console.log("Peer Connected:", peerId));
        this.peerManager.on('peerDisconnected', (peerId) => {
            console.log("Peer Disconnected:", peerId);
            // Remove disconnected player from scene
            if (this.players[peerId]) {
                this.players[peerId].destroyPlayer();
                delete this.players[peerId];
            }
        });
        this.peerManager.on('serverBecameHub', (id) => {
            this.initialServerId = id;
            console.log("MainScene: This instance became the PeerJS hub. ID:", id);
        });

        // Wait for PeerManager to confirm its PeerJS instance is ready and server ID is resolved
        await new Promise(resolve => {
            if (this.peerManager.isPeerInstanceOpen() && this.peerManager.getServerId()) {
                resolve();
            } else {
                const onPeerReady = () => {
                    if (this.peerManager.isPeerInstanceOpen() && this.peerManager.getServerId()) {
                        this.peerManager.off('peerIdReady', onPeerReady);
                        resolve();
                    }
                };
                this.peerManager.on('peerIdReady', onPeerReady);
                if (this.initialServerId && this.initialServerId === this.peerId) {
                    this.peerManager.becomeServer();
                    onPeerReady();
                }
            }
        });

        this.nostrManager = new NostrManager(null, null, null);

        if (!this.peerManager.isHub()) {
            console.log("Attempting to find active server via Nostr...");
            const event = await this.nostrManager.fetchEvent({
                kinds: [NOSTR_CONSTANTS.KIND_ENTERED_GAME],
                '#t': [NOSTR_CONSTANTS.NOSTR_SPACE_TAG],
                limit: 1
            });

            if (event && event.tags.some(tag => tag[0] === 'peerJsId')) {
                console.log("Found active server event:", event);
                const tagPeerId = event.tags.find(tag => tag[0] === 'peerJsId');
                const discoveredServerId = tagPeerId[1];
                if (this.peerManager.getPeerId() !== discoveredServerId) {
                    console.log("Connecting to PeerJS hub:", discoveredServerId);
                    this.peerManager.connectToHub(discoveredServerId);
                } else {
                    console.log("Discovered server is self. Becoming server.");
                    this.peerManager.becomeServer();
                }
            } else {
                console.log("No active server event found or it's my own. Becoming server.");
                this.peerManager.becomeServer();
            }
        } else {
            console.log("I am the PeerJS hub, not looking for a server on Nostr.");
        }

        // Generate the placeholder player first
        await this.generatePlayerPlaceholder();
        this.setControls();
        this.redDot = this.add.circle(this.cameras.main.width / 2, this.cameras.main.height / 2 - 120, 2, 0xff0000);
        this.redDot.depth = 1;

        console.log("MainScene Create finished.");
    }

    async loadSkybox() {
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        const texture = await loader.load(TEXTURE_PATHS.SPACE_SKYBOX);
        const material = new THREE.MeshPhongMaterial({ map: texture, side: THREE.BackSide });
        const skyboxGeo = new THREE.SphereGeometry(GAME_CONSTANTS.SKYBOX_RADIUS, 200, 1000);
        const skybox = new THREE.Mesh(skyboxGeo, material);
        skybox.position.set(0, 0, 0);
        this.third.add.existing(skybox);
        this.skybox = skybox;
    }

    async generatePlayerPlaceholder() {
        const dummyPubkey = '0000000000000000000000000000000000000000000000000000000000000000';
        const dummyProfile = { pubkey: dummyPubkey, content: JSON.stringify({ name: "Loading..." }) };
        this.player = new Player(this, dummyProfile, this.shipModel, this.defaultProfileImageTexture);
        await this.player.create(); // Await the creation of the placeholder player
    }

    setControls() {
        // The ThirdPersonControls for the *player* are initialized within the Player class.
        // We only set up the pointer lock/drag and keyboard keys here.

        if (!this.isTouchDevice) {
            const pl = new PointerLock(this.game.canvas);
            const pd = new PointerDrag(this.game.canvas);
            pd.onMove(delta => {
                if (pl.isLocked()) {
                    this.moveTop = -delta.y;
                    this.moveRight = delta.x;
                }
            });
        }

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
        };

        if (this.isTouchDevice) {
            const joystick = new JoyStick();
            const axis = joystick.add.axis({ styles: { left: 35, bottom: 35, size: 100 } });
            axis.onMove(event => {
                this.moveTop = event.top * 3;
                this.moveRight = event.right * 3;
            });
            const buttonF = joystick.add.button({ letter: 'F', styles: { right: 35, bottom: 110, size: 80 } });
            buttonF.onClick(() => {
                if (this.canShoot && this.connectedNostr) {
                    this.canShoot = false;
                    this.shoot();
                    this.time.addEvent({ delay: 1000, callback: () => this.canShoot = true });
                }
            });
            const buttonB = joystick.add.button({ letter: 'B', styles: { right: 110, bottom: 35, size: 80 } });
            buttonB.onClick(() => (this.moveForward = true));
            buttonB.onRelease(() => (this.moveForward = false));
        }
    }

    async connectNostr() {
        if (this.connectingNostr || this.connectedNostr) return;
        this.connectingNostr = true;
        try {
            let keys = await connectNostrWallet();
            if (!keys) {
                alert("Alby/NWC not detected or user cancelled. Generating ephemeral keys.");
                keys = await generateEphemeralKeys();
                this.sk = keys.sk;
            } else if (keys.nwc) {
                this.nwc = keys.nwc;
            }
            this.nostrPubKey = keys.pk;
            this.connectedNostr = true;
            console.log("Nostr Connected! Public Key:", this.nostrPubKey);

            // Fetch actual profile data
            const playerProfile = await this.nostrManager.fetchEvent({
                authors: [this.nostrPubKey],
                kinds: [NOSTR_CONSTANTS.KIND_METADATA_PROFILE]
            }) || { pubkey: this.nostrPubKey };

            // Destroy placeholder and create actual player
            if (this.player) {
                this.player.destroyPlayer();
                this.player = null; // Clear reference to placeholder
            }
            this.player = new Player(this, playerProfile, this.shipModel, this.defaultProfileImageTexture);
            await this.player.create(); // Await the creation of the actual player

            // Re-initialize NostrManager with actual keys and pubkey
            this.nostrManager.setKeys(this.nostrPubKey, this.sk, this.nwc);
            this.nostrManager.setPlayerProfile(playerProfile);
            this.setupNostrSubscriptions();

            // Send 'entered game' message AFTER player is fully created and NostrManager is set up
            await this.nostrManager.sendEnteredGameMessage(this.peerManager.getServerId(), this.peerId);

        } catch (err) {
            console.error("Failed to connect Nostr:", err);
            alert(`Nostr connection failed: ${err.message}`);
        } finally {
            this.connectingNostr = false;
        }
    }

    setupNostrSubscriptions() {
        const filters = [
            { '#t': [NOSTR_CONSTANTS.NOSTR_SPACE_TAG], kinds: [NOSTR_CONSTANTS.KIND_CUSTOM_APP_DATA] },
            { kinds: [NOSTR_CONSTANTS.KIND_SHORT_TEXT_NOTE], since: Math.floor(Date.now() / 1000) - 60 },
            { kinds: [NOSTR_CONSTANTS.KIND_METADATA_PROFILE], limit: 50 },
            { kinds: [NOSTR_CONSTANTS.KIND_REPOST_DELETE, NOSTR_CONSTANTS.KIND_ENTERED_GAME], limit: 10 },
            { kinds: [NOSTR_CONSTANTS.KIND_REACTION], since: Math.floor(Date.now() / 1000) - 60, limit: 1 }
        ];

        this.nostrManager.subscribe(filters, 'gameEvents');
        this.nostrManager.on('nostrEventReceived', (event) => this.handleNostrEvent(event));
    }

    async handleNostrEvent(data) {
        if (data.pubkey === this.nostrPubKey) return;

        if (data.kind === NOSTR_CONSTANTS.KIND_SHORT_TEXT_NOTE) {
            await new Enemy(this, data.id, this.enemyShipModel, this.player.body.position).create(); // Ensure creation is awaited
            return;
        }

        let subProfileData = await this.nostrManager.getProfile(data.pubkey);
        if (!subProfileData) {
            subProfileData = { pubkey: data.pubkey }; // Fallback
        }

        if (data.kind === NOSTR_CONSTANTS.KIND_CUSTOM_APP_DATA) {
            const tagPos = data.tags.filter(tag => tag[0] === NOSTR_CONSTANTS.NOSTR_SPACE_POSITION_TAG);
            if (tagPos.length > 0) {
                const pos = JSON.parse(tagPos[0][1]);
                if (this.profiles[data.pubkey]) {
                    this.profiles[data.pubkey].updatePosition(pos);
                } else {
                    const base = new Base(this, subProfileData, this.stationModel);
                    base.position.set(pos.x, pos.y, pos.z);
                    await base.create(); // Await the base creation
                    this.profiles[data.pubkey] = base;
                }
            }
            return;
        }

        const bytesEvent = stringToBytes(data.id);
        if (data.kind === NOSTR_CONSTANTS.KIND_REACTION) {
            const obj = {
                direction: { x: bytesEvent[0] * 2, y: bytesEvent[1] * 2, z: bytesEvent[2] * 2 },
                origin: { x: bytesEvent[3] * 2, y: bytesEvent[4] * 2, z: bytesEvent[5] * 2 },
            };
            new Projectile(this, 'antimatter', obj);
            return;
        }

        if (data.kind === NOSTR_CONSTANTS.KIND_REPOST_DELETE || data.kind === NOSTR_CONSTANTS.KIND_ENTERED_GAME) {
            const pos = { x: bytesEvent[0], y: bytesEvent[4], z: bytesEvent[6] };
            new Projectile(this, 'blackhole', pos);
            return;
        }
    }

    async handlePeerData(fromPeerId, msg) {
        if (fromPeerId === this.peerId || fromPeerId === this.nostrPubKey) return;

        if (typeof msg === "object" && msg.type) {
            const data = msg.data;
            if (msg.type === GAME_CONSTANTS.PEER_MSG_NEW_CONNECTION) {
                console.log("New peer connection via PeerJS:", data);
            } else if (msg.type === GAME_CONSTANTS.PEER_MSG_MOVEMENT) {
                if (data.pubkey === this.nostrPubKey) return;

                let otherPlayer = this.players[data.pubkey];
                let subProfileData = await this.nostrManager.getProfile(data.pubkey);
                if (!subProfileData) {
                    subProfileData = { pubkey: data.pubkey }; // Fallback
                }

                if (otherPlayer) {
                    otherPlayer.updatePositionAndVelocity(data.position, data.velocity);
                } else {
                    otherPlayer = new Player(this, subProfileData, this.shipModel, this.defaultProfileImageTexture);
                    otherPlayer.position.set(data.position.x, data.position.y, data.position.z);
                    await otherPlayer.create(); // Await the remote player creation
                    otherPlayer.updatePositionAndVelocity(data.position, data.velocity); // Set initial pos/vel
                    this.players[data.pubkey] = otherPlayer;
                }
            } else if (msg.type === GAME_CONSTANTS.PEER_MSG_SHOOT) {
                new Projectile(this, 'bullet', data);
            }
        }
    }

    async connectLNC() {
        if (this.fetchingLNCAssets || !this.connectedNostr) return;
        this.fetchingLNCAssets = true;
        try {
            const pairingPhrase = window.prompt("Enter readonly testnet LNC Pairing Phrase");
            const pwd = window.prompt("Define a password");
            if (!pairingPhrase || !pwd) {
                alert("LNC Pairing Phrase and Password are required.");
                return;
            }

            this.lnc = new LNC({ pairingPhrase, password: pwd });
            await this.lnc.preload();
            await this.lnc.run();
            await this.lnc.connect();
            console.log(`LNC connected: ${this.lnc.isConnected}`);
            this.fetchAssetsLNC();
        } catch (err) {
            console.error("LNC connection failed:", err);
            alert(`Failed to connect LNC: ${err.message}`);
        } finally {
            this.fetchingLNCAssets = false;
        }
    }

    async fetchAssetsLNC() {
        if (!this.lnc?.tapd) {
            console.warn("LNC Taproot Assets client not available.");
            return;
        }
        this.fetchingLNCAssets = true;
        try {
            const data = await this.lnc.tapd.taprootAssets.listAssets();
            let hasVelocityAsset = false;
            for (let asset of data.assets) {
                if (asset.assetType === "COLLECTIBLE") {
                    const meta = await this.lnc.tapd.taprootAssets.fetchAssetMeta({
                        asset_id: asset.assetGenesis.assetId.replace(/\+/g, '-').replace(/\//g, '_')
                    });
                    console.log("Collectible meta:", Buffer.from(meta.data, 'base64').toString('utf8'));
                } else {
                    if (asset.assetGenesis.genesisPoint === "d093a015ac32b4e29e9da1b2fab45acf27b21b8f34fe949a86a691802cd21765:1") {
                        this.currentSpeed = GAME_CONSTANTS.PLAYER_SPEED + Number(asset.amount) / 100;
                        alert(`New speed: ${this.currentSpeed} - Asset: ${asset.assetGenesis.name} - Amount: ${asset.amount}`);
                        hasVelocityAsset = true;
                    }
                }
            }
            if (!hasVelocityAsset) {
                console.log("No NostrSpaceVelocity asset found, using default speed.");
            }
        } catch (err) {
            console.error("Failed to fetch LNC assets:", err);
            alert(`Failed to fetch LNC assets: ${err.message}`);
        } finally {
            this.fetchingLNCAssets = false;
        }
    }

    async occupyPosition() {
        if (!this.connectedNostr || this.occupyingPosition || !this.nostrManager) return;
        this.occupyingPosition = true;
        try {
            const pos = {
                x: this.player.position.x,
                y: this.player.position.y - 3.5,
                z: this.player.position.z
            };
            await this.nostrManager.occupyPosition(pos);
        } catch (err) {
            console.error("Error occupying position:", err);
            alert(`Failed to occupy position: ${err.message}`);
        } finally {
            this.occupyingPosition = false;
        }
    }

    async sendPlayerMovement() {
        if (!this.player || !this.player.body || !this.connectedNostr || !this.peerManager) return;

        const posData = {
            pubkey: this.nostrPubKey,
            position: {
                x: this.player.position.x,
                y: this.player.position.y,
                z: this.player.position.z
            },
            velocity: {
                x: this.player.body.velocity.x,
                y: this.player.body.velocity.y,
                z: this.player.body.velocity.z
            }
        };
        this.peerManager.sendData({ type: GAME_CONSTANTS.PEER_MSG_MOVEMENT, data: posData });
    }

    async shoot() {
        if (!this.connectedNostr || !this.peerManager || !this.player) return;

        const shootData = this.player.getShootRaycasterData();
        new Projectile(this, 'bullet', shootData); // Local projectile for immediate feedback
        this.peerManager.sendData({ type: GAME_CONSTANTS.PEER_MSG_SHOOT, data: shootData });
    }

    async keysendToDevs() {
        if (this.sendingKeysend) return;
        this.sendingKeysend = true;
        try {
            const weblnInstance = window.webln || this.nwc;
            if (!weblnInstance) {
                alert("WebLN or NWC not available. Please install Alby extension or configure NWC.");
                return;
            }
            await weblnInstance.enable();
            await weblnInstance.lnurl(NOSTR_CONSTANTS.KEYSEND_LNURL);
            alert("Sats sent! Thank you for your support!");
        } catch (err) {
            console.error("Keysend failed:", err);
            alert(`Keysend failed: ${err.message}`);
        } finally {
            this.sendingKeysend = false;
        }
    }

    update(time, delta) {
        if (this.player && this.player.body) {
            // Update player controls based on input from MainScene
            this.player.updateControls(this.moveRight, this.moveTop);
            if (!this.isTouchDevice) {
                this.moveRight = this.moveTop = 0; // Reset camera movement input
            }

            // Update player movement based on keys and moveForward flag
            this.player.updateMovement(this.currentSpeed, this.keys, this.moveForward);

            // Make the skybox follow the player
            this.skybox.position.copy(this.player.position);

            // Handle key presses for game actions
            if (this.keys.c.isDown && !this.connectingNostr && !this.connectedNostr) {
                this.connectNostr();
            }
            if (this.keys.t.isDown && this.connectedNostr && !this.fetchingLNCAssets) {
                if (!this.lnc?.isConnected) {
                    this.connectLNC();
                } else {
                    this.fetchAssetsLNC();
                }
            }
            if (this.keys.o.isDown && this.connectedNostr && !this.occupyingPosition) {
                this.occupyPosition();
            }
            if (this.keys.f.isDown && this.connectedNostr && this.canShoot) {
                this.canShoot = false;
                this.time.addEvent({ delay: 1000, callback: () => this.canShoot = true });
                this.shoot();
            }
            if (this.keys.k.isDown && (window.webln || this.nwc) && !this.sendingKeysend) {
                this.keysendToDevs();
            }

            // Send player movement updates over PeerJS at intervals
            if (!this.sendingMovement && this.connectedNostr && this.peerManager) {
                this.sendingMovement = true;
                this.time.addEvent({ delay: 600, callback: () => this.sendingMovement = false });
                this.sendPlayerMovement();
            }
        }

        // Rotate any designated spinning objects
        this.spinningObjects.forEach(object => object.rotation.y += 0.01);
    }
}