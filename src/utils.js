import {nip19, generatePrivateKey, getPublicKey} from 'nostr-tools'


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
    return await window.nostr.getPublicKey();
  } else {
    alert("Oops, it looks like you haven't set up your Nostr key yet. Go to your Alby Account Settings and create or import a Nostr key.")
    return
  }
}
export const generateKeys = async () => {

  let sk = localStorage.getItem('nostr-sk');
  if(!sk){
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

export const relays = [
  //'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://relay2.nostrchat.io',
  'wss://nostr-01.bolt.observer',
  //'wss://nos.lol'
]
