import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import Game3D from './Phaser';
import reportWebVitals from './reportWebVitals';
import { Grommet } from 'grommet';
import {
  HashRouter as Router,
  Route,
  Routes,
  Navigate
} from 'react-router-dom';

ReactDOM.render(
  <Grommet>
    <Router>
      <Routes>
        <Route path="/" element={<Game3D />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  </Grommet>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
