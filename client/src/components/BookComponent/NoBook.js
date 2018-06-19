import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { connect } from 'react-redux';
import { fetchUserInfo } from '../../redux/backend';
import { LOGIN_STATES } from '../../redux/stateConstants';
import './NoBook.css';

const mapDispatchToProps = dispatch => ({
  fetchUserInfoProp: () => fetchUserInfo(dispatch),
});

class NoBook extends PureComponent {
  componentDidMount() {
    this.props.fetchUserInfoProp();
  }
  render() {
    const { loginState } = this.props;
    return (
      <div
        className={classNames(
          'NoBook',
          { NoBookClear: loginState !== LOGIN_STATES.UNKNOWN },
        )}
      />
    );
  }
}

export default connect(null, mapDispatchToProps)(NoBook);
