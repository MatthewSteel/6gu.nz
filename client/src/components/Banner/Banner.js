import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { LOGIN_STATES, fetchUserInfo, doLogout } from '../../redux/store.js';
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

/* eslint-disable react/jsx-no-target-blank */
/* It's a slight security issue, but we should be able to trust the login
 * providers... We want the login window to be able to communicate with
 * this one so it can tell us the login is complete.
 * An alternative could be to poll an "are we logged in?" endpoint but
 * that seems a bit awful -- how long do we poll for? How frequently?
 */
const providerLoginButtons = [(
  <a
    className="LoginButton"
    href="http://localhost:2999/oauth/authorize"
    target="_blank"
    key="fakeProviderLink"
  >
    Fake Provider
  </a>
)];
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
    // TODO: Check the host here. It should be localhost:2999 in dev and
    // 6gu.nz in production.
    const { fetchUserInfoProp, loginState } = this.props;
    if (loginState !== LOGIN_STATES.LOGGED_OUT) return;
    if (event.origin !== process.env.REACT_APP_OAUTH_CLIENT_HOST) {
      return;
    }
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
