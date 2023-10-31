import {nip19,nip44, generatePrivateKey, getPublicKey,relayInit} from 'nostr-tools'
import { webln } from '@getalby/sdk';

export const connectWallet = async () => {
  /*if(process.env.REACT_APP_NOSTR_SK){
    const sk = process.env.REACT_APP_NOSTR_SK;
    let nsec = nip19.nsecEncode(sk)
    let {type, data} = nip19.decode(nsec);
    let pk = getPublicKey(sk)
    let npub = nip19.npubEncode(pk)
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
    //alert("Alby extension not detected, trying to login with Nostr Wallet Connect followed by ephemeral keys generation");
    alert("Ephemeral keys generation");
    // prompt the user to connect to NWC
    /*
    const nwc = webln.NostrWebLNProvider.withNewSecret();

    await nwc.initNWC({
      name: "NostrSpace-Test",
    });
    const url = nwc.getNostrWalletConnectUrl(true);
    await nwc.enable();
    const pk = nwc.publicKey;
    const npub = nip19.npubEncode(pk)

    return({
      pk: pk,
      npub: npub,
      //nwc: nwc
    });
    */
    // now use any webln code
    return
  }
}
export const generateKeys = async () => {

  let sk = localStorage.getItem('nostr-sk');
  if(!sk && !window.nostr){
    sk = generatePrivateKey();
  }
  localStorage.setItem('nostr-sk',sk);
  let nsec = nip19.nsecEncode(sk)
  let {type, data} = nip19.decode(nsec);
  let pk = getPublicKey(sk)
  let npub = nip19.npubEncode(pk)
  return({
    pk: pk,
    npub: npub,
    sk: sk
  });
}
export const initRelay = async (url) => {

  const relay = relayInit(url)
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
 const newRelay = relayInit(newUrl)
 newRelay.on('connect', () => {
   console.log(`connected to ${relay.url}`)
 })
 newRelay.on('error', () => {
   console.log(`failed to connect to ${relay.url}`)
 })

 await newRelay.connect()
 return(newRelay);

}


const base64UrlEncode = (input) => {
  let base64 = Buffer.from(input, 'hex').toString('base64');
  let base64Url = base64.replace(/\+/g, '-').replace(/\//g, '_');
  return base64Url;
};

export const fetchTaprootAssets = async (rest_host,macaroon_hex) => {
 let url = `${rest_host}/v1/taproot-assets/assets`;
 let options = {
    // Work-around for self-signed certificates.
    rejectUnauthorized: false,
    json: true,
    method: 'GET',
    headers: {
      'Grpc-Metadata-macaroon': macaroon_hex,
    },
 }
 const response = await fetch(url,options);
 const data = await response.json();
 alert(`Found a total of ${data.assets.length} taproot assets`);
 for(let asset of data.assets){
   const asset_id = asset.asset_genesis.asset_id;
   const encodedId = base64UrlEncode(asset_id);
   console.log(asset_id)
   url = `${rest_host}/v1/taproot-assets/assets/meta?asset_id=${encodeURIComponent(encodedId)}`;
   options = {
      // Work-around for self-signed certificates.
      rejectUnauthorized: false,
      json: true,
      headers: {
        'Grpc-Metadata-macaroon': macaroon_hex,
      },
   }
   const assetResp = await fetch(url,options);
   const assetData = await assetResp.json();
   const metadata = Buffer.from(assetData.data,'hex').toString('utf8')
   console.log(metadata)
  //alert(JSON.stringify(assetData));
  // alert(`Metadata: ${metadata}`)
 }
 return(data);
}


export const relays = [
 'wss://offchain.pub',
 //'ws://127.0.0.1:8008', // localhost, test
 'wss://relay2.nostrchat.io',
 'wss://nostr.fmt.wiz.biz',
 'wss://relay.damus.io',
 'wss://relay.nostrassets.com',
 'wss://relay.nostr.info',
 'wss://relay.snort.social',
]
