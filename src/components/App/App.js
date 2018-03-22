import React from 'react';
import { Provider } from 'react-redux';
import store from '../../redux/store.js';
import './App.css';
import TableComponent from '../TableComponent/TableComponent';

const App = () => (
  <Provider store={store}>
    <div className="App">
      <TableComponent tableId="table0" />
      <TableComponent tableId="table1" />
    </div>
  </Provider>
);

export default App;
