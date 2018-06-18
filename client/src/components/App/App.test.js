import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

import { LOGIN_STATES } from '../../redux/stateConstants';
import { blankDocument } from '../../redux/backend';
import store from '../../redux/store';

describe('The App component', () => {
  beforeEach(() => {
    store.dispatch({
      type: 'USER_STATE',
      payload: {
        userState: { loginState: LOGIN_STATES.LOGGED_IN, documents: [] },
        openDocument: blankDocument(),
      },
    });
  });

  it('renders without crashing', () => {
    const div = document.createElement('div');
    ReactDOM.render(<App />, div);
    ReactDOM.unmountComponentAtNode(div);
  });
});
