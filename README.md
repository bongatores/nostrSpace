# NostrSpace

**A 3D universe where all places can be yours.** Explore an infinite 3D world shaped by Nostr events and interact with other players in real-time!

NostrSpace is an experimental application that transforms the decentralized activity of Nostr into a dynamic 3D environment.

<br>

## Key Features

*   **Nostr-Driven World Generation:**
    *   **Profiles (Kind 0):** Each Nostr profile (`npub`) creates a unique "base" in the 3D space, with its position defined by the `npub`.
    *   **Short Text Notes (Kind 1):** Appear as "Intergalactic Travelers" (spaceships) that can be shot and destroyed.
    *   **Reactions (Kind 7):** Spawn "Antimatter Particles" (fast red spheres) that kill players on contact.
    *   **Group Channel Creation (Kind 40):** Generates "Black Holes" (large black spheres) that kill players if touched.
*   **Real-time Multiplayer & Interaction:**
    *   **Nostr Login:** Connect your Nostr identity to play.
    *   **Occupy Space (Nostr):** Claim positions in the 3D world with your profile by sending a Nostr message (`Kind 30078` with tag `'nostr-space-position'`). This action is broadcast via Nostr.
    *   **Live Player Sync (PeerJS):** See and interact with other players in real-time.
        *   **PeerJS for Movement & Shoots:** Player movement and shooting actions are synchronized instantly between peers using PeerJS for low-latency communication.
        *   **Nostr for Peer Discovery:** Your PeerJS ID is published to a NostrChat channel when you join. Other players find this ID via Nostr and connect directly using PeerJS.
        *   **Dynamic Host:** The first player in a session acts as the initial host, with others connecting as clients to enable real-time multiplayer.
*   **NostrChat Integration:**
    *   Upon connecting, your PeerJS ID is sent to the NostrChat channel `https://www.nostrchat.io/channel/6afddc25a8ed486b0c1e6e556077a9eef3e0d7236014b891495ae20d557a2346` for peer discovery.

<br>

## Technologies

*   **React:** Builds the decentralized application.
*   **Groomet:** React framework for user interface development.
*   **ThreeJS:** Renders the 3D world and player interactions.
*   **Nostr:** Used for world generation, player login, peer discovery (PeerJS IDs), and the "Occupy Space" action.
*   **PeerJS:** Powers real-time, peer-to-peer multiplayer for player movement and combat.
*   **Alby:** Enables Nostr login and Bitcoin Lightning integration.

<br>

## Testing Guide

### Controls

*   **`C`**: Connect to Nostr
*   **`W`**: Move Forward
*   **`S`**: Stop
*   **`O`**: Occupy your current position (requires Nostr connection)
*   **`E`**: View Nostr profile on iris.to
*   **`F`**: Shoot
*   **`K`**: Send a donation to ⚡️purpletrout86@walletofsatoshi.com
*   **`T`**: Fetch your Taproot Assets
*   **`I`**: Show/Hide in-game instructions
*   **Mouse**: Control camera direction