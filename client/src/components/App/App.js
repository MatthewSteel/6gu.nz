import React from 'react';
import { Provider } from 'react-redux';
import store from '../../redux/store.js';
import './App.css';
import BookComponent from '../BookComponent/BookComponent';

const App = () => (
  <Provider store={store}>
    <div className="App">
      <BookComponent />
    </div>
  </Provider>
);

export default App;
