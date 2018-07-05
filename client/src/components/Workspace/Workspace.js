import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { getLoginState } from '../../selectors/formulas/selectors';
import { LOGIN_STATES } from '../../redux/stateConstants';
import Book from '../Book/Book';
import NoBook from '../Book/NoBook';
import Banner from '../Banner/Banner';
import './Workspace.css';

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
          <Book />
        }
        <NoBook loginState={loginState} />
      </div>
    );
  }
}

export default connect(mapStateToProps)(Workspace);
