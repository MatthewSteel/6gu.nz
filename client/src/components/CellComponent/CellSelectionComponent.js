import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { updateSelection } from '../../redux/uistate';

class CellSelectionComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {};
  }

  static getDerivedStateFromProps(props) {
    const { dispatchUpdateSelection, selection } = props;
    dispatchUpdateSelection(selection);
    return null;
  }

  render() {
    const { x, y, width, height } = this.props;
    const style = {
      gridColumn: `${x + 1} / span ${width}`,
      gridRow: `${(2 * y) + 1} / span ${2 * height}`,
    };
    return <div className="CellSelected" style={style} />;
  }
}

const mapDispatchToProps = dispatch => ({
  dispatchUpdateSelection: selection => dispatch(updateSelection(selection)),
});

export default connect(null, mapDispatchToProps)(CellSelectionComponent);
