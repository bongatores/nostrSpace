import { Buffer } from 'buffer'; // Ensure Buffer is available
import { nip19 } from 'nostr-tools';
import {
  generateSecretKey,
  getPublicKey,
} from 'nostr-tools/pure';
// Webln is used in MainScene now, not directly in utils for generic wallet connect.

/**
 * Attempts to connect to a Nostr wallet via window.nostr.
 * @returns {Promise<{pk: string, npub: string} | undefined>} Public key and npub, or undefined if no wallet.
 */
export const connectNostrWallet = async () => {
  if (window.nostr) {
    try {
      const pk = await window.nostr.getPublicKey();
      const npub = nip19.npubEncode(pk);
      return { pk, npub };
    } catch (error) {
      console.error("Failed to get public key from window.nostr:", error);
      // Let calling code handle fallback (e.g., generateEphemeralKeys)
    }
  }
  return undefined;
};

/**
 * Generates and stores a new ephemeral Nostr key pair, or retrieves an existing one.
 * @returns {Promise<{pk: string, npub: string, sk: string}>} Public key, npub, and secret key.
 */
export const generateEphemeralKeys = async () => {
  let sk = localStorage.getItem('nostr-sk');

  if (!sk) {
    const newSkUint8 = generateSecretKey(); // Returns Uint8Array
    sk = Buffer.from(newSkUint8).toString('hex'); // Convert to hex string for storage
    localStorage.setItem('nostr-sk', sk);
  }

  const skUint8 = Buffer.from(sk, 'hex'); // Convert hex string back to Uint8Array
  const pk = getPublicKey(skUint8); // pk will be a hex string
  const npub = nip19.npubEncode(pk);

  return { pk, npub, sk };
};

