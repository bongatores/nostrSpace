import { SimplePool } from 'nostr-tools';
import { finalizeEvent, getEventHash, signEvent } from 'nostr-tools/pure';
import Phaser from 'phaser'; // For EventEmitter
import { NOSTR_CONSTANTS } from './constants';
import { Buffer } from 'buffer'; // Required for secret key conversion

export class NostrManager extends Phaser.Events.EventEmitter {
  constructor(pubkey, sk = null, nwc = null) {
    super();
    this.pubkey = pubkey;
    this.sk = sk; // Hex secret key for direct signing
    this.nwc = nwc; // NWC instance for signing
    this.pool = new SimplePool({ enablePing: true, enableReconnect: true });
    this.relays = NOSTR_CONSTANTS.RELAYS; 
    this.subscriptions = new Map(); // Store active subscriptions
    this.playerProfile = null; // Store player's own profile event
  }

  setPlayerProfile(profile) {
    this.playerProfile = profile;
  }

  getPubkey() {
    return this.pubkey;
  }

  /**
   * Subscribes to Nostr events with given filters.
   * @param {Array<Object>} filters - Nostr filter objects.
   * @param {string} subId - Unique ID for this subscription.
   */
  subscribe(filters, subId) {
    if (this.subscriptions.has(subId)) {
      console.log(`Nostr: Subscription '${subId}' already active. Unsubscribing old.`);
      this.subscriptions.get(subId).unsub();
    }
    console.log(filters)
    console.log(`Nostr: Subscribing to '${subId}' with filters:`, filters);
    const sub = this.pool.subscribe(NOSTR_CONSTANTS.RELAYS, filters, {
      onevent: (event) => this.emit('nostrEventReceived', event),
      onclose: () => console.log(`Nostr: Subscription '${subId}' closed.`),
      oneose: () => console.log(`Nostr: Subscription '${subId}' EOSE.`),
    });
    this.subscriptions.set(subId, sub);
  }

  /**
   * Unsubscribes from a specific event stream.
   * @param {string} subId - The ID of the subscription to unsubscribe from.
   */
  unsubscribe(subId) {
    if (this.subscriptions.has(subId)) {
      this.subscriptions.get(subId).unsub();
      this.subscriptions.delete(subId);
      console.log(`Nostr: Unsubscribed from '${subId}'.`);
    }
  }

  /**
   * Fetches a single event.
   * @param {Object} filter - The filter for the event.
   * @returns {Promise<Object|null>} The event or null.
   */
  async fetchEvent(filter) {
    const event = await this.pool.get(this.relays, filter);
    return event;
  }

  /**
   * Signs a Nostr event using the available signing method.
   * @param {Object} event - The unsigned event object.
   * @returns {Promise<Object>} The signed event object.
   */
  async signEvent(event) {
    let finalEvent = { ...event, pubkey: this.pubkey, created_at: Math.floor(Date.now() / 1000) };

    if (this.sk) {
      const skUint8 = Buffer.from(this.sk, 'hex');
      finalEvent = finalizeEvent(finalEvent, skUint8);
    } else if (window.nostr) {
      finalEvent = await window.nostr.signEvent(finalEvent);
    } else if (this.nwc) {
      finalEvent = await this.nwc.signEvent(finalEvent);
    } else {
      throw new Error("No Nostr signing method available (sk, window.nostr, or NWC).");
    }
    return finalEvent;
  }

  /**
   * Publishes a Nostr event to all configured relays.
   * @param {Object} event - The signed event object.
   * @returns {Promise<void>} Resolves when publish attempts are sent.
   */
  async publishEvent(event) {
    try {
      const signedEvent = await this.signEvent(event);
      const pubs = this.pool.publish(NOSTR_CONSTANTS.RELAYS, signedEvent);
      pubs.on('ok', (relayUrl) => console.log(`Nostr: Event published to ${relayUrl}:`, signedEvent));
      pubs.on('failed', (relayUrl, reason) => console.error(`Nostr: Failed to publish to ${relayUrl}: ${reason}`, signedEvent));
      return signedEvent;
    } catch (error) {
      console.error("Nostr: Error signing or publishing event:", error);
      throw error;
    }
  }

  // --- Specific Nostr Actions ---

  async sendEnteredGameMessage(serverId, peerId) {
    const content = serverId === peerId ?
      `Just entered the space as the server!` :
      `Just entered the space at server ${serverId}!`;
    const event = {
      kind: NOSTR_CONSTANTS.KIND_ENTERED_GAME,
      tags: [
        ['e', NOSTR_CONSTANTS.NOSTR_SPACE_ROOT_EVENT_ID, NOSTR_CONSTANTS.RELAYS[0], 'root'], // Point to a main relay if needed
        ['t', NOSTR_CONSTANTS.NOSTR_SPACE_TAG],
        ['peerJsId', serverId]
      ],
      content: content
    };
    return this.publishEvent(event);
  }

  async occupyPosition(position) {
    const event = {
      kind: NOSTR_CONSTANTS.KIND_CUSTOM_APP_DATA,
      tags: [
        ['d', 'NostrSpacePosition'],
        ['t', NOSTR_CONSTANTS.NOSTR_SPACE_TAG],
        [NOSTR_CONSTANTS.NOSTR_SPACE_POSITION_TAG, JSON.stringify(position)]
      ],
      content: `Update to position - (${position.x},${position.y},${position.z})`
    };
    return this.publishEvent(event);
  }

  // For ephemeral movement/shoot, if you decide to send via Nostr
  async sendMovementEvent(posData) {
    const event = {
      kind: 29211, // Example ephemeral kind
      tags: [
        ['d', 'NostrSpaceMovement'],
        ['t', NOSTR_CONSTANTS.NOSTR_SPACE_TAG],
        [NOSTR_CONSTANTS.NOSTR_SPACE_MOVEMENT_TAG, JSON.stringify(posData)]
      ],
      content: 'Player movement'
    };
    return this.publishEvent(event);
  }

  async sendShootEvent(shootData) {
    const event = {
      kind: 29211, // Example ephemeral kind
      tags: [
        ['d', 'NostrSpaceShoot'],
        ['t', NOSTR_CONSTANTS.NOSTR_SPACE_TAG],
        [NOSTR_CONSTANTS.NOSTR_SPACE_SHOOT_TAG, JSON.stringify(shootData)]
      ],
      content: 'Player shot'
    };
    return this.publishEvent(event);
  }

  // Add more specific Nostr event publishing methods as needed
}