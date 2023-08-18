import {nip19, generatePrivateKey, getPublicKey,relayInit} from 'nostr-tools'
import { webln } from '@getalby/sdk';


export const ordinalsUrl = (utxo) => {
  return `https://ordinals.com/output/${utxo.txid}:${utxo.vout}`
}

export const ordinalsImageUrl = (utxo) => {
  return `https://ordinals.com/content/${utxo.txid}i${utxo.vout}`
}

export const cloudfrontUrl = (utxo) => {
  return `https://d2v3k2do8kym1f.cloudfront.net/minted-items/${utxo.txid}:${utxo.vout}`
}


export const connectWallet = async () => {
  if (window.nostr) {
    const pk = await window.nostr.getPublicKey();
    const npub = nip19.npubEncode(pk)
    return({
      pk: pk,
      npub: npub
    })
  } else {
    alert("Alby extension not detected, trying to login with Nostr Wallet Connect followed by ephemeral keys generation");
    // prompt the user to connect to NWC
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
      nwc: nwc
    });
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
export const relays = [
 'wss://offchain.pub',
 //'ws://127.0.0.1:8008', // localhost, test
 'wss://relay2.nostrchat.io',
 'wss://nostr.fmt.wiz.biz',
 'wss://relay.damus.io',
 'wss://relay.nostr.info',
 'wss://relay.snort.social',
]
