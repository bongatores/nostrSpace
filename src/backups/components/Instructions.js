import React from 'react'
import {
  Box,
  Accordion,
  AccordionPanel,
 } from 'grommet';

 import { useAppContext } from '../hooks/useAppState'


export default function Instructions(){

  const { state } = useAppContext();

  return(
    <Box className='inst_text'>
      <Accordion>
        <AccordionPanel label="How to play?">
          <Box direction="row">
            <img className='inst_image' src="img/instructions.png"></img><br/>
            <div style={
              {
                marginLeft:"10px"
              }
            }>Use <span>W-A-S-D</span> to move<br/><br/>
            <span>SPACE</span> to jump<br/><br/>
            <span>MOUSE</span> to look around<br/><br/>
            {
              state.coinbase &&
              <>
              and <span>P</span> to occupy
              </>
            }
            </div>
          </Box>
        </AccordionPanel>
      </Accordion>

    </Box>
  )
}
