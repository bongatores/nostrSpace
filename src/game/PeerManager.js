import Peer from 'peerjs'; // This import is generally not needed if PeerJS instance is passed
import Phaser from 'phaser'; // Import Phaser for EventEmitter

export class PeerManager extends Phaser.Events.EventEmitter {
  // Constructor now expects the already initialized PeerJS instance
  constructor(peerId, serverId, peerJsInstance) {
    super();
    this.peerId = peerId;           // The ID of the PeerJS instance from App.js
    this.serverId = serverId;       // Initial server ID hint
    this.peerInstance = peerJsInstance; // <--- This is the PeerJS instance from App.js
    this.connections = [];          // For Hub (server)
    this.conn = null;               // For Peer (client)

    // Verify the passed PeerJS instance is ready
    if (!this.peerInstance || !this.peerInstance.open) {
      console.error("PeerManager: Received PeerJS instance is not open or valid.");
      // This is a critical error. You might want to throw or emit an error immediately.
      this.emit('peerError', new Error("PeerJS instance not ready at PeerManager construction."));
      return; // Stop initialization
    }

    // Since the PeerJS instance is already open, we can proceed
    console.log('PeerManager: Initialized with Peer ID:', this.peerId);
    this.emit('peerIdReady', this.peerId); // Confirm our ID is ready
    this.setupConnectionLogic();

    // Setup listener for incoming connections if this instance will act as a server/hub
    // This listener must be on the passed `peerInstance`
    this.peerInstance.on('connection', (conn) => {
      // Only process if we are currently acting as a hub (server)
      if (this.isHub()) {
        console.log(`PeerManager (Hub): Incoming connection from ${conn.peer}`);
        this.connections.push(conn);
        this.setupConnectionEvents(conn, true);
        this.emit('peerConnected', conn.peer);
      } else {
        console.warn(`PeerManager (Client): Unexpected incoming connection from ${conn.peer}. Rejecting.`);
        conn.close(); // Reject connection if not acting as hub
      }
    });

    this.peerInstance.on('error', (err) => {
      console.error('PeerManager: Shared PeerJS instance error:', err);
      this.emit('peerError', err);
      // If error occurs on the main instance, and we are a client, attempt to become server
      if (this.conn) {
        this.conn.close();
        this.conn = null;
      }
      this.becomeServer();
    });
  }

  // Determines whether to become a server or connect to a hub
  setupConnectionLogic() {
    // If we don't have a serverId yet, or we *are* the designated server, become server.
    if (!this.serverId || this.peerId === this.serverId) { // Use our actual peerId
      this.becomeServer();
    } else {
      // Otherwise, attempt to connect to the provided serverId
      this.connectToHub(this.serverId);
    }
  }

  becomeServer() {
    // A peer is considered a hub if its peerId is its serverId
    if (this.peerId === this.serverId) { // Check if we already identify as the server
        console.log("PeerJS: This instance is already configured as the server (Hub). My ID:", this.peerId);
        return;
    }
    console.log("PeerJS: This instance is now the server (Hub). My ID:", this.peerId);
    this.serverId = this.peerId; // Ensure serverId is set to self's peerId
    this.emit('serverBecameHub', this.peerId); // Optional: notify MainScene
  }

  connectToHub(targetPeerId) {
    if (this.conn && this.conn.open) {
      console.log("PeerJS: Already connected to hub.");
      return;
    }
    if (!this.peerInstance || !this.peerInstance.open) {
        console.error("PeerJS: Shared PeerJS instance not open to connect to hub.");
        this.emit('peerError', new Error("Shared PeerJS instance not open to connect."));
        return;
    }
    if (this.peerId === targetPeerId) {
        console.warn("PeerJS: Cannot connect to self as hub. Becoming server instead.");
        this.becomeServer();
        return;
    }

    console.log("PeerJS: Connecting to hub:", targetPeerId);
    this.serverId = targetPeerId; // Store the ID of the hub we're connecting to
    const newConn = this.peerInstance.connect(targetPeerId, { reliable: true });

    if (!newConn) { // Defensive check: Peer.connect should usually return a connection object
        console.error(`PeerJS: Failed to create connection object for ${targetPeerId}`);
        this.emit('peerError', new Error(`Failed to create connection to ${targetPeerId}.`));
        return;
    }

    this.conn = newConn; // Store the new connection
    this.setupConnectionEvents(this.conn, false); // Pass the connection and 'false' for not-a-hub
    this.emit('peerConnecting', targetPeerId); // Notify MainScene
  }

  setupConnectionEvents(conn, isHub) {
    if (!conn || typeof conn.on !== 'function') {
        console.error("PeerJS: Invalid connection object passed to setupConnectionEvents.");
        this.emit('peerError', new Error("Invalid connection object."));
        return;
    }

    conn.on('open', () => {
      console.log(`PeerJS: Connection opened with ${conn.peer}`);
      this.emit('peerConnectionOpen', conn.peer);
      conn.send({ type: "newConnection", data: this.peerId }); // Announce self

      if (isHub) {
        // As hub, inform other clients about new connection
        this.connections.forEach(c => {
          if (c !== conn && c.open) {
            c.send({ type: "newConnection", data: conn.peer });
          }
        });
      }
    });

    conn.on('data', (data) => {
      this.emit('peerDataReceived', { from: conn.peer, data });
      if (isHub) {
        // As hub, re-broadcast to all other clients
        this.connections.forEach(c => {
          if (c !== conn && c.open) {
            c.send(data);
          }
        });
      }
    });

    conn.on('close', () => {
      console.log(`PeerJS: Connection closed with ${conn.peer}`);
      this.emit('peerDisconnected', conn.peer);
      if (isHub) {
        this.connections = this.connections.filter(c => c !== conn);
      } else {
        this.conn = null;
        console.log("PeerJS: Client connection to hub closed. Attempting to become server...");
        this.becomeServer();
      }
    });

    conn.on('error', (err) => {
      console.error(`PeerJS: Connection error with ${conn.peer}:`, err);
      this.emit('peerConnectionError', { peer: conn.peer, error: err });
      if (!isHub && conn === this.conn) { // If it's our main client connection
          this.conn.close();
          this.conn = null;
          console.log("PeerJS: Client connection error. Attempting to become server...");
          this.becomeServer();
      } else if (isHub) {
          this.connections = this.connections.filter(c => c !== conn); // Remove faulty connection
      }
    });
  }

  sendData(data) {
    if (this.isConnectedToHub()) { // If connected to a hub, send data via that single connection
      this.conn.send(data);
    }
    else if (this.isHub()) { // If acting as a hub, broadcast to all connected clients
      this.connections.forEach(conn => {
        if (conn.open) {
          conn.send(data);
        }
      });
    } else {
      console.warn("PeerJS: No active connections to send data.");
    }
  }

  getPeerId() {
    return this.peerId;
  }

  getServerId() {
    return this.serverId;
  }

  isConnectedToHub() {
    return this.conn && this.conn.open && this.peerId !== this.serverId;
  }

  isHub() {
    // A peer is a hub if its peerId is its serverId
    return this.peerId === this.serverId && this.peerInstance && this.peerInstance.open;
  }

  // Method to check if the underlying PeerJS instance is open
  isPeerInstanceOpen() {
    return this.peerInstance && this.peerInstance.open;
  }
}