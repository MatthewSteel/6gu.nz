import React, { PureComponent } from 'react';
import classNames from 'classnames';
import './DragComponents.css';


class DragOutlineComponent extends PureComponent {
  render() {
    const { x, y, width, height, valid } = this.props;
    const style = {
      gridColumn: `${x + 1} / span ${width}`,
      gridRow: `${2 * y + 1} / span ${height * 2}`,
    };
    const className = classNames(
      'DragOutline',
      { DragOutlineValid: valid },
    );
    return (<div className={className} style={style} />);
  }
}
export default DragOutlineComponent;
