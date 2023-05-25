

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
  if (window.nostr && window.nostr.enable) {
    await window.nostr.enable()
  } else {
    alert("Oops, it looks like you haven't set up your Nostr key yet. Go to your Alby Account Settings and create or import a Nostr key.")
    return
  }
  return await window.nostr.getPublicKey()
}

export const relays = [
  'wss://relay.damus.io',
  'wss://relay.snort.social',
  'wss://nostr-01.bolt.observer'
]
