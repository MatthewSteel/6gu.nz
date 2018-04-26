import React, { PureComponent } from 'react';
import BaseCellComponent from './BaseCellComponent';

class CellNameComponent extends PureComponent {
  render() {
    const { x, y, width, height, name, setSelection } = this.props;
    return (
      <BaseCellComponent
        x={x}
        y={y}
        width={width}
        height={height}
        className="CellName"
        setSelection={setSelection}
      >
        {name}
      </BaseCellComponent>
    );
  }
}

export default CellNameComponent;
