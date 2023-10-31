# NostrSpace

  A 3d space where all places can be yours.
  View nostr profiles in a 3d empty world!

  Events that occurs in Nostr (profile creation, channel creation, reactions to a post) generates artfacts in the game. Profiles are bases in the space, channels are black holes, reactions are antimatter particles at fast speed. Users can login with Nostr, occupy space with its profile, fire at other players and move in the space.

  Messages sent to Nostr are identified by their tags and kinds in order to recognize the action done by players (shoot, movement, occupy positions).

  Taproot Assets changes player's attributes (velocity, localhost only).

## Kinds

  Kind 0 (Profiles) loads profile's base, the npub is converted to bytes to have its position defined;

  Kind 1 (Short Text Note): Generates "Intergalactical travelers" represented by a spaceship, they should be able to be destroyed if shooted;

  Kind 30078 (Arbitrary custom app data): It is tagged with 'nostr-space-position' to allow player change his base's position;

  Kind 7 (Reactions): Any reaction to a post in nostr will render "antimatter" particles (red small sphere moving in high velocity) that kills players if touches him;

  Kind 40 (Group Channel Creation): Groups created in nostr are rendered as a very big black sphere that represents black holes (player dies if touches it);

  Kind 29211 (Ephemeral): This is tagged with 'nostr-space-movement' to show current player's position to others players in the game or tagged with 'nostr-space-shoot' to trigger shoot from player that sent message;

  When player log in with nostr, a message is sent to https://www.nostrchat.io/channel/6afddc25a8ed486b0c1e6e556077a9eef3e0d7236014b891495ae20d557a2346 to show that player entered the game.

## Technologies

  - **React** - constructs the dapp;
  - **Groomet** - react framework to help doing the user interface;
  - **ThreeJS** - renders the 3d world and allows the user to explore it and interact with it;
  - **Nostr** -  get profiles,get channels, get reactions, allow sending messages that will be used to place information in the world
  - **Alby** - allow login with nostr and bitcoin lightning;
  - **Taproot Assets**(localhost with lightning polar only) - assets that the connected node contains will change the player's attributes (velocity, fire rate, spaceship). This is optional feature included to explore taproot assets protocol and tester need to use alongside lightningpolar regtest network. The name and type (normal or collectible) of assets will define what attribute should be changed (name should be replaced with asset's id but to simplify tests this one was choosen).

## Testing Guide

#### Controls
  - `C`: Connect Nostr  
  - `W`: Move foward
  - `S`: Stop
  - `O`: Insert base in the current coordinate
  - `E`: View profile at iris.to
  - `F`: Shoot
  - `K`: Donate to ⚡️ lingeringwaterfall23085@getalby.com
  - `T`: Fetch taproot assets (localhost only)

#### Taproot Assets - NostrAssets

  Get some assets at (https://test.nostrassets.com/#/faucet)[https://test.nostrassets.com/#/faucet] and connect NostrSpace.

  - ORDI changes speed;

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
