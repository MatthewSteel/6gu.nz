import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { LOGIN_STATES } from '../../redux/stateConstants';
import { fetchUserInfo, doLogout } from '../../redux/backend.js';
import './Banner.css';

const mapDispatchToProps = dispatch => ({
  logout: () => doLogout(dispatch),
  fetchUserInfoProp: () => fetchUserInfo(dispatch),
});

const commaListElems = (items) => {
  const ret = [];
  items.forEach((item, i) => {
    ret.push(item);
    if (i === items.length - 2) { // second last element
      ret.push(' or ');
    } else if (i !== items.length - 1) {
      ret.push(', ');
    }
  });
  return ret;
};

// Alas, "dev-server" weirdness. Can't serve OAuth pages and the app on the
// same port. (Don't want to use an environment variable for the host because
// I want the same client build for staging and production. Could maybe have
// a var for the port, though?)
const serverUrl = process.env.NODE_ENV === 'production' ?
  `https://${window.location.hostname}` :
  `http://${window.location.hostname}:3001`;

/* eslint-disable react/jsx-no-target-blank */
/* It's a slight security issue, but we should be able to trust the login
 * providers... We want the login window to be able to communicate with
 * this one so it can tell us the login is complete.
 * An alternative could be to poll an "are we logged in?" endpoint but
 * that seems a bit awful -- how long do we poll for? How frequently?
 */
const providers = process.env.NODE_ENV === 'production' ?
  [{ name: 'google', text: 'Google' }, {name: 'facebook', text: 'Facebook' }] :
  [{ name: 'fake', text: 'Fake Provider' }];

const providerLoginButtons = providers.map(({ name, text }) => (
  <a
    className="LoginButton"
    href={`${serverUrl}/api/auth/${name}`}
    target="_blank"
    key={`${name}LoginLink`}
  >
    {text}
  </a>
));
/* eslint-enable react/jsx-no-target-blank */

const logoutButton = logout => (
  <button
    className="LoginButton"
    onClick={logout}
  >
    Logout
  </button>
);

class Banner extends PureComponent {
  constructor(props) {
    super(props);
    this.maybeLogin = this.maybeLogin.bind(this);
  }

  componentDidMount() {
    window.addEventListener('message', this.maybeLogin);
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.maybeLogin);
  }

  maybeLogin(event) {
    const { fetchUserInfoProp, loginState } = this.props;
    if (loginState !== LOGIN_STATES.LOGGED_OUT) return;
    if (event.origin !== serverUrl) return;

    if (event.data === 'loginSuccess') fetchUserInfoProp();
  }

  render() {
    const { loginState, logout } = this.props;
    return (
      <div className="Banner">
        {loginState === LOGIN_STATES.UNKNOWN &&
          <span>Fetching data...</span>
        }
        {loginState === LOGIN_STATES.LOGGED_IN && logoutButton(logout)}
        {loginState === LOGIN_STATES.LOGGED_OUT && [
          'Login with ',
          ...commaListElems(providerLoginButtons),
        ]}
      </div>
    );
  }
}

export default connect(null, mapDispatchToProps)(Banner);
