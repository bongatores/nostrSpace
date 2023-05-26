import { useState, useEffect,useMemo } from 'react';

import {
  Box,
  Tab,
  Tabs,
  Spinner,
  Text,
} from 'grommet';

import {
  relayInit,
  SimplePool,
  nip05
} from 'nostr-tools'

import { AppContext, useAppState } from './hooks/useAppState'
import { getAddressInfo, connectWallet,relays } from './utils';

import Game from './Game';

import MainHeader from './components/MainHeader';
import GameHeader from './components/GameHeader';
import Instructions from './components/Instructions';

const pool = new SimplePool()


export default function App() {

  const { state, actions } = useAppState();

  const connect = async() => {
    const newNostrPubKey = await connectWallet();
    const newProfile = await pool.get(relays, {
      authors: [
        newNostrPubKey
      ],
      kinds: [0]
    })
    console.log(newProfile);
    actions.setProfile(newProfile);
  }



  return (
    <AppContext.Provider value={{ state, actions }}>
      <Game />
      <Box id="blocker">
        <MainHeader connect={connect} />
        <Box align="center" className='menu_box' gap={"large"}>
          <GameHeader connect={connect} />
          <Instructions />
          <lightning-widget
              name="Izzi"
              accent="grey"
              to="03c9e422da6b3c9a29d65f2c91ff73c36c93d645ce91e125a7a20e1758b42cc309"
              image="https://mbnlkqqyj4n57fexpf7h4hzf72x7fvft5jqi3e3dzs72tppn3p6q.arweave.net/YFq1QhhPG9-Ul3l-fh8l_q_y1LPqYI2TY8y_qb3t2_0"
              amounts="10,100,200"
          />
        </Box>
      </Box>
      <Box id="canvas-container" align="center">
      </Box>
    </AppContext.Provider>
  )
}
