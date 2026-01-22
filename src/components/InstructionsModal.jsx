// src/components/InstructionsModal.js
import React, { useState } from 'react'; // Added useState for tab management
import logo from '../img/empty_space.png'; // Adjust path as needed
import { NOSTR_CONSTANTS } from '../game/constants';

// We'll manage imgUri locally within the modal for this example.
// In a real app, if this input affects the game, it would be passed via props.

export const InstructionsModal = ({ onClose, nostrConnected }) => {
  const [activeTab, setActiveTab] = useState('instructions');
  const [imgUrlInput, setImgUrlInput] = useState(''); // Local state for the image URL input

  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 text-2xl font-bold"
        >
          &times;
        </button>

        {/* Header */}
        <div className="text-center mb-6">

          <img className="mx-auto w-32 h-auto mb-4" src={logo} alt="logo" />
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome to NostrSpace</h2>
          <p className="text-gray-600 text-lg">
            Your Gateway to a 3D Universe! <br />
            Step into a boundless world where you are the master of your own destiny.
            In NostrSpace, every corner of our expansive 3D universe can be yours...
            until someone else decides to claim it.
          </p>
          <div id="frame" className="w-full mx-auto relative z-[99998] my-6">
            <iframe
              data-aa='2425106'
              src='//acceptable.a-ads.com/2425106/?size=Adaptive'
              className='border-0 p-0 w-full h-auto overflow-hidden block mx-auto' // Using Tailwind for styles
              allowTransparency="true"
              loading="lazy"
            ></iframe>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => handleTabClick('instructions')}
            className={`py-2 px-4 text-lg font-medium ${
              activeTab === 'instructions' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Instructions
          </button>
          {/* "Add Image" tab is still hidden based on your original code's style={{ display: "none" }} */}
          {/* You can uncomment and modify the styling to show it if needed */}
          {/*
          <button
            onClick={() => handleTabClick('addImage')}
            className={`py-2 px-4 text-lg font-medium ${
              activeTab === 'addImage' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Add Image
          </button>
          */}
          <button
            onClick={() => handleTabClick('nostrInfo')}
            className={`py-2 px-4 text-lg font-medium ${
              activeTab === 'nostrInfo' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Nostr Info
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'instructions' && (
            <div className="grid grid-cols-2 gap-8 text-gray-700">
              <div>
                <p className="mb-2"><span className="o-btn">C</span> &nbsp; &nbsp; &nbsp;Connect Nostr</p>
                <p className="mb-2"><span className="o-btn">W</span> &nbsp; &nbsp; &nbsp;Move forward</p>
                <p className="mb-2"><span className="o-btn">S</span> &nbsp; &nbsp; &nbsp;Stop</p>
                <p className="mb-2"><span className="o-btn">F</span> &nbsp; &nbsp; &nbsp;Shoot</p>
              </div>
              <div>
                <p className="mb-2"><span className="o-btn">I</span> &nbsp; &nbsp; &nbsp;Show/Hide instructions</p>
                {nostrConnected && (
                  <p className="mb-2"><span className="o-btn">O</span> &nbsp; &nbsp; &nbsp;Occupy position</p>
                )}
                <p className="mb-2"><span className="o-btn">E</span> &nbsp; &nbsp; &nbsp;View profile</p>
                <p className="mb-2">Mouse: Move camera direction</p>
              </div>
            </div>
          )}

          {/* Hidden "Add Image" Tab Content (uncomment and style if needed) */}
          {/*
          {activeTab === 'addImage' && (
            <div className-="p-4 bg-gray-50 rounded-md">
              <p className="text-gray-700 mb-4">Insert image url to place in current position</p>
              {imgUrlInput && (
                <p className="text-sm text-gray-500 mb-2 truncate">{imgUrlInput}</p>
              )}
              <input
                type="text"
                placeholder="Image url"
                value={imgUrlInput}
                onChange={e => setImgUrlInput(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  alert("Image placement feature is not fully implemented.");
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md w-full"
              >
                Place Image
              </button>
            </div>
          )}
          */}

          {activeTab === 'nostrInfo' && (
            <div className="p-4 bg-gray-50 rounded-md text-gray-700">
              <p className="mb-2">Edit your profile at any Nostr client</p>
              <p className="text-sm mb-2">NostrChat, Iris.to, Snort Social, Yakihone and much more</p>
              <p className="text-sm mb-4">Use Alby extension for better experience</p>
              <p className="text-xs break-words">Relays: {NOSTR_CONSTANTS.RELAYS.join(', ')}</p>
            </div>
          )}
        </div>

        {/* Footer Close Button */}
        <div className="mt-8 text-center">
          <button
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};