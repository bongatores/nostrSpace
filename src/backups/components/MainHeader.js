import {
  Button,
  Header,
  Heading,
  Box,
  Text
 } from 'grommet';

 import { useAppContext } from '../hooks/useAppState'


export default function MainHeader(props){

  const { state } = useAppContext();


  return(
    <Header background="brand" align="start" className='navbar'>
      <Heading className='heading' margin="small">Nostr Space</Heading>
      <Box align="end" pad="small" alignContent="center" >
        {
          state.profile ?
          <Button onClick={() => {
            props.logout();
          }} label="Disconnect" /> :
          window.nostr && <Button primary onClick={props.connect} label="Connect" />
        }
        {
          state.profile &&
          <Text size="xsmall" alignSelf="center" alignContent="center">
            Connected as: {
                state.profile.content ?
                  JSON.parse(state.profile.content).display_name ?
                  JSON.parse(state.profile.content).display_name :
                  JSON.parse(state.profile.content).name ?
                  JSON.parse(state.profile.content).name :
                  state.profile.pubkey
                : state.profile.pubkey
            }
          </Text>
        }
      </Box>
    </Header>
  )
}
