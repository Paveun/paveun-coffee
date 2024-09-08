import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCoffee } from '@fortawesome/free-solid-svg-icons';
import Wave from 'react-wavify';
import './App.css';

function App() {
  return (
    <div className="App">
      <div className="content">
        <FontAwesomeIcon icon={faCoffee} className="coffee-icon" />
        <h1>paveun.</h1>
      </div>
      <div className="wave-container">
        <Wave
          fill="#f2d5cf"
          paused={false}
          style={{ display: 'flex' }}
          options={{
            height: 20,
            amplitude: 30,
            speed: 0.15,
            points: 3,
          }}
        />
      </div>
    </div>
  );
}

export default App;
