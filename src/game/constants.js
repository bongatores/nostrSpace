// Game-specific constants
export const GAME_CONSTANTS = {
    PLAYER_SPEED: 0.8,
    BULLET_FORCE: 8,
    BULLET_LIFETIME_MS: 5000,
    ANTIMATTER_LIFETIME_MS: 5000,
    ENEMY_LIFETIME_MS: 25000,
    ENEMY_FORCE: 0.08,
    INITIAL_SPAWN_X: 700,
    INITIAL_SPAWN_Y: 400,
    INITIAL_SPAWN_Z: 400,
    SKYBOX_RADIUS: 1000,
    MAX_PROFILES: 100, // Still considering if this is truly needed or managed by physics/scene cleanup
    PEER_MSG_MOVEMENT: "movement",
    PEER_MSG_SHOOT: "shoot",
    PEER_MSG_NEW_CONNECTION: "newConnection",
  };
  
  // Nostr-specific constants
  export const NOSTR_CONSTANTS = {
    RELAYS: [
      'wss://relay.damus.io',
      'wss://relay.primal.net',
      'wss://nos.lol',
      'wss://relay.snort.social'
    ],
    NOSTR_SPACE_ROOT_EVENT_ID: '6afddc25a8ed486b0c1e6e556077a9eef3e0d7236014b891495ae20d557a2346',
    KIND_ENTERED_GAME: 42,
    KIND_SHORT_TEXT_NOTE: 1,
    KIND_METADATA_PROFILE: 0,
    KIND_CUSTOM_APP_DATA: 30078,
    KIND_REACTION: 7, // For Antimatter
    KIND_REPOST_DELETE: 40, // Used for Blackhole 
    KIND_ZAP: 42, // For Blackhole
    NOSTR_SPACE_TAG: 'nostr-space',
    NOSTR_SPACE_POSITION_TAG: 'nostr-space-position',
    NOSTR_SPACE_MOVEMENT_TAG: 'nostr-space-movement', // If ephemeral events are re-enabled
    NOSTR_SPACE_SHOOT_TAG: 'nostr-space-shoot', // If ephemeral events are re-enabled
    NOSTR_ASSETS_PUBKEY: '6c0fde2a3b2e481e21bdf09b377e0c3e5391bf0353db06ab37c88945a8a77402', // Keep if LNC still checks this, otherwise remove
    KEYSEND_LNURL: "LNURL1DP68GURN8GHJ7EM9W3SKCCNE9E3K7MF0D3H82UNVWQHKC6TWVAJHY6TWVAMKZAR9WFNXZMRVXGENQWP4MJMXA4",
  };
  
  export const TEXTURE_PATHS = {
    SHIP: '/assets/gltf/ship/scene.gltf',
    STATION: '/assets/gltf/station/scene.gltf',
    ENEMY_SHIP: '/assets/gltf/ship_notes/scene.gltf',
    SPACE_SKYBOX: '/img/space.png',
    DEFAULT_PROFILE_PIC: "https://image.nostr.build/nostr.build_a3bc5db060142c8c49b9cc40d2024b1ac8e602c44bb68ea2d81a85a1135211dc.jpg"
  };