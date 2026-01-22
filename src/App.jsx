import React, { useEffect, useState, useRef } from 'react';
import Phaser from 'phaser';
import { enable3d, Canvas } from '@enable3d/phaser-extension';
import Peer from 'peerjs';
import { MainScene } from './scenes/MainScene';
import { InstructionsModal } from './components/InstructionsModal';

function App() {
  const [phaserInitialized, setPhaserInitialized] = useState(false);
  const [peerInstance, setPeerInstance] = useState(null);
  const [peerId, setPeerId] = useState(null);
  const [serverId, setServerId] = useState(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const gameContainerRef = useRef(null);

  const gameRef = useRef(null);
  const mainSceneRef = useRef(null);

  useEffect(() => {
    const initPeerJS = () => {
      const newPeer = new Peer();

      newPeer.on('open', (id) => {
        setPeerId(id);
        setServerId(id); // Initially assume self is server until Nostr dictates otherwise
        setPeerInstance(newPeer);
        console.log("App.js: PeerJS Initialized. My ID:", id);
      });

      newPeer.on('error', (err) => {
        console.error("App.js: PeerJS instance error during setup:", err);
      });

      return () => {
        if (newPeer && !newPeer.destroyed) {
          newPeer.destroy();
          console.log("App.js: PeerJS instance destroyed.");
        }
      };
    };

    if (!peerInstance) {
      initPeerJS();
    }
  }, [peerInstance]);

  useEffect(() => {
    if (!phaserInitialized && peerId && peerInstance) {
      const config = {
        type: Phaser.WEBGL,
        transparent: true,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: window.innerWidth * Math.max(1, window.devicePixelRatio / 2),
          height: window.innerHeight * Math.max(1, window.devicePixelRatio / 2)
        },
        scene: new MainScene({
          peerId: peerId,
          peerJsInstance: peerInstance,
          serverId: serverId
        }),
        ...Canvas({ antialias: false })
      };

      enable3d(() => {
        const game = new Phaser.Game(config);
        gameRef.current = game;
        game.events.on('ready', () => {
          mainSceneRef.current = game.scene.getScene('MainScene');
        });
        return game;
      }).withPhysics('/lib/ammo');

      setPhaserInitialized(true);
      console.log("App.js: Phaser 3D Game Initialized.");
    }
  }, [phaserInitialized, peerId, peerInstance, serverId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'i') {
        event.preventDefault();
        setShowInstructions(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCloseInstructions = () => {
    setShowInstructions(false);
  };

  const [nostrConnectedState, setNostrConnectedState] = useState(false);

  return (
      <div
        id="game-container"
        ref={gameContainerRef}
        className={`relative w-full overflow-hidden`}
      >
        {!phaserInitialized && (
          <div className="loading-overlay absolute inset-0 flex flex-col justify-center items-center bg-black text-white z-[9999]">
            <h2 className="text-3xl font-bold mb-5 text-shadow-lg" style={{textShadow: '2px 2px #ff00ff'}}>Welcome to Nostr Space</h2>
            <p className="text-lg mb-8 text-green-300">App Loading</p>
          </div>
        )}
        {showInstructions && (
          <InstructionsModal
            onClose={handleCloseInstructions}
            nostrConnected={nostrConnectedState}
          />
        )}
      </div>
  );
}

export default App;