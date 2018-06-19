import React, { PureComponent } from 'react';

class CellSelectionComponent extends PureComponent {
  render() {
    const { x, y, width, height } = this.props;
    const style = {
      gridColumn: `${x + 1} / span ${width}`,
      gridRow: `${(2 * y) + 1} / span ${2 * height}`,
    };
    return <div className="CellSelected" style={style} />;
  }
}

export default CellSelectionComponent;
