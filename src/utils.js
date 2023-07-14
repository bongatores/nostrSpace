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
    const pk = await window.nostr.getPublicKey();
    const npub = nip19.npubEncode(pk)
    return({
      pk: pk,
      npub: npub
    })
  } else {
    alert("Oops, it looks like you haven't set up your Nostr key yet. Go to your Alby Account Settings and create or import a Nostr key.")
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

export const relays = [
 //'wss://eden.nostr.land',
 'wss://nostr.fmt.wiz.biz',
 'wss://relay.damus.io',
 //'wss://nostr-pub.wellorder.net',
 'wss://relay.nostr.info',
 //'wss://offchain.pub',
 //'wss://nos.lol',
 //'wss://brb.io',
 'wss://relay.snort.social',
 //'wss://relay.current.fyi',
 'wss://nostr.relayer.se',
]
