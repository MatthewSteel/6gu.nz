import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { fetchUserInfo } from '../../redux/backend';

const mapDispatchToProps = dispatch => ({
  fetchUserInfoProp: () => fetchUserInfo(dispatch),
});

class NoBook extends PureComponent {
  componentDidMount() {
    this.props.fetchUserInfoProp();
  }
  render() {
    return <div />;
  }
}

export default connect(null, mapDispatchToProps)(NoBook);
