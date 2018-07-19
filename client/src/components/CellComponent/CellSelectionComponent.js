import React, { Fragment, PureComponent } from 'react';
import Formula from '../Formula/Formula';

class CellSelectionComponent extends PureComponent {
  render() {
    const { x, y, width, height, readOnly, selection } = this.props;
    const style = {
      gridColumn: `${x + 1} / span ${width}`,
      gridRow: `${(2 * y) + 1} / span ${2 * height}`,
    };
    return (
      <Fragment>
        <Formula readOnly={readOnly} selection={selection} />
        <div className="CellSelected" style={style} />
      </Fragment>
    );
  }
}

export default CellSelectionComponent;
