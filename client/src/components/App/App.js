import React from 'react';
import { Provider } from 'react-redux';
import store from '../../redux/store.js';
import './App.css';
import Workspace from '../Workspace/Workspace';

const App = () => (
  <Provider store={store}>
    <div className="App">
      <Workspace />
    </div>
  </Provider>
);

export default App;
