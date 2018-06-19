import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { getLoginState } from '../../selectors/formulas/selectors';
import { LOGIN_STATES } from '../../redux/stateConstants';
import BookComponent from '../BookComponent/BookComponent';
import NoBook from '../BookComponent/NoBook';
import Banner from '../Banner/Banner';

const mapStateToProps = state => ({ loginState: getLoginState(state) });

class Workspace extends PureComponent {
  render() {
    const { loginState } = this.props;
    return (
      <div className="Workspace">
        <Banner
          loginState={loginState}
        />
        {loginState !== LOGIN_STATES.UNKNOWN &&
          <BookComponent />
        }
        <NoBook loginState={loginState} />
      </div>
    );
  }
}

export default connect(mapStateToProps)(Workspace);
