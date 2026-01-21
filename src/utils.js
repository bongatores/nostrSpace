import {
  nip19,
  Relay, // relayInit is from the main package
} from 'nostr-tools';
import {
  generateSecretKey,
  getPublicKey,
} from 'nostr-tools/pure'; // <--- CRUCIAL CHANGE for these functions
import { webln } from '@getalby/sdk';

export const connectWallet = async () => {
  /*
  // Commented out the REACT_APP_NOSTR_SK block as it was already commented in your provided code
  if(process.env.REACT_APP_NOSTR_SK){
    const sk = process.env.REACT_APP_NOSTR_SK;
    // Note: nip19.nsecEncode expects Uint8Array for sk in newer nostr-tools
    // You'd need hexToBytes(sk) if sk is a hex string
    // let nsec = nip19.nsecEncode(hexToBytes(sk))
    // let {type, data} = nip19.decode(nsec);
    let pk = getPublicKey(hexToBytes(sk)); // getPublicKey also expects Uint8Array
    let npub = nip19.npubEncode(pk);
    return({
      pk: pk,
      npub: npub,
      sk: sk
    });
  }
  */
  if (window.nostr) {
    const pk = await window.nostr.getPublicKey();
    const npub = nip19.npubEncode(pk)
    return({
      pk: pk,
      npub: npub
    })
  } else {
    alert("Ephemeral keys generation");
    // Your NWC or ephemeral key generation logic would go here.
    // As per your previous comments, you're currently skipping NWC and just alerting.
    // If you uncomment the NWC part, ensure `nwc.publicKey` is returning a hex string
    // that `nip19.npubEncode` expects or adapt as necessary.

    // If you intend to generate ephemeral keys here as a fallback,
    // you would call generateKeys() and return its result.
    // For now, it explicitly returns undefined as per your original code's structure
    // when NWC is commented out.
    // return generateKeys(); // <-- If you want to use ephemeral keys here
    return; // Original return for this block.
  }
}

export const generateKeys = async () => {
  let sk = localStorage.getItem('nostr-sk');

  if(!sk){ // If sk is not in localStorage, generate a new one
    // generateSecretKey() from 'nostr-tools/pure' returns a Uint8Array
    // We typically store/pass private keys as hex strings, so convert it.
    const newSkUint8 = generateSecretKey();
    sk = Buffer.from(newSkUint8).toString('hex'); // Convert Uint8Array to hex string
    localStorage.setItem('nostr-sk', sk);
  }

  // getPublicKey from 'nostr-tools/pure' expects a Uint8Array.
  // Convert the hex string 'sk' back to Uint8Array for getPublicKey.
  const skUint8 = Buffer.from(sk, 'hex');
  let pk = getPublicKey(skUint8); // pk will be a hex string

  // nip19.nsecEncode expects a Uint8Array private key.
  let nsec = nip19.nsecEncode(skUint8);
  // nip19.decode returns an object, { type: 'nsec', data: Uint8Array }
  // You probably don't need the 'type' and 'data' destructuring here unless you explicitly use them.
  // let {type, data} = nip19.decode(nsec);

  let npub = nip19.npubEncode(pk); // npubEncode expects a hex public key string

  return({
    pk: pk,        // hex string
    npub: npub,    // bech32 encoded npub
    sk: sk         // hex string
  });
}

// initRelay and changeRelay will likely become less critical
// if you use SimplePool for all subscriptions and publishing.
// However, if you have specific cases where you need a direct Relay instance,
// this implementation is now correct for `nostr-tools/pure`.
export const initRelay = async (url) => {
  // relayInit from 'nostr-tools/pure' returns a Relay instance
  const relay =  new Relay(url)
  relay.on('connect', () => {
    console.log(`connected to ${relay.url}`)
  })
  relay.on('error', () => {
    console.log(`failed to connect to ${relay.url}`)
  })

  await relay.connect()
  return(relay);
}

export const changeRelay = async (newUrl,relay) => {
 await relay.close();
 const newRelay =  new Relay(newUrl) // relayInit from 'nostr-tools/pure'
 newRelay.on('connect', () => {
   console.log(`connected to ${newRelay.url}`) // Fixed to use newRelay.url
 })
 newRelay.on('error', () => {
   console.log(`failed to connect to ${newRelay.url}`) // Fixed to use newRelay.url
 })

 await newRelay.connect()
 return(newRelay);

}


const base64UrlEncode = (input) => {
  // Ensure Buffer is globally available or imported if not in a Node.js env with browserify/webpack setup
  // Your project seems to have `import {Buffer} from 'buffer';` in Game3D.js
  // Ensure that's correctly set up for utils.js as well if this file runs independently.
  let base64 = Buffer.from(input, 'hex').toString('base64');
  let base64Url = base64.replace(/\+/g, '-').replace(/\//g, '_');
  return base64Url;
};

export const fetchTaprootAssets = async (rest_host,macaroon_hex) => {
 // IMPORTANT: fetch on Node.js versions < 18 may require a polyfill like 'node-fetch'.
 // For browser environments, `fetch` is native. Your project likely targets browsers.
 let url = `${rest_host}/v1/taproot-assets/assets`;
 let options = {
    // 'rejectUnauthorized' is typically a Node.js 'https' option, not a standard fetch option.
    // For browser fetch, you'd rely on the browser's CORS and certificate handling.
    // If this is for a Node.js backend proxying requests, `fetch` itself might not directly support it.
    // You might need to use a library like `axios` with a Node.js adapter or adjust the Node.js process.
    // For now, I'll comment it out as it's not standard for browser `fetch`.
    // rejectUnauthorized: false,
    // `json: true` is also not a standard fetch option for browsers.
    // You manually handle JSON parsing with `response.json()`.
    // json: true,
    method: 'GET',
    headers: {
      'Grpc-Metadata-macaroon': macaroon_hex,
      'Content-Type': 'application/json', // Often good practice for REST APIs
    },
 }
 const response = await fetch(url,options);
 if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
 }
 const data = await response.json();
 alert(`Found a total of ${data.assets.length} taproot assets`);
 for(let asset of data.assets){
   const asset_id = asset.asset_genesis.asset_id;
   const encodedId = base64UrlEncode(asset_id);
   console.log(asset_id)
   url = `${rest_host}/v1/taproot-assets/assets/meta?asset_id=${encodeURIComponent(encodedId)}`;
   options = {
      // rejectUnauthorized: false, // See above comments
      // json: true, // See above comments
      headers: {
        'Grpc-Metadata-macaroon': macaroon_hex,
        'Content-Type': 'application/json',
      },
   }
   const assetResp = await fetch(url,options);
   if (!assetResp.ok) {
       throw new Error(`HTTP error fetching metadata! status: ${assetResp.status}`);
   }
   const assetData = await assetResp.json();
   // Buffer.from(assetData.data,'hex').toString('utf8') assumes assetData.data is hex.
   // Confirm if it's base64 or hex from the API. Your `base64UrlEncode` uses 'hex'.
   // If `assetData.data` is already base64, you might just decode it.
   const metadata = Buffer.from(assetData.data,'hex').toString('utf8')
   console.log(metadata)
 }
 return(data);
}


export const relays = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.snort.social'
]