import {
  Button,
  Heading,
  Box,
  Paragraph,
 } from 'grommet';

import { useAppContext } from '../hooks/useAppState'


export default function GameHeader(props){

  const { state } = useAppContext();

  return(
    <>
    <Heading className='inst_head'>Welcome to <br/><span style={
      {
        fontFamily: 'franchise',
        fontSize: '100px',
        marginTop:'5px',
        display:'block',
      }
    }>Nostr Space</span></Heading>
    <p style={
      {
        textAlign: 'center'
      }
    }>
      Nostr Spaces Fully Powered by Nostr. Enjoy
    </p>

    <Box direction="row" style={
      {
        marginBottom: '15px'
      }
    }>
      <Button primary label="Click to play" id="instructions" />
    </Box>

    </>
  )
}
