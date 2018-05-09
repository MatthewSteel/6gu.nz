import React, { PureComponent } from 'react';
import BaseCellComponent from './BaseCellComponent';

class CellNameComponent extends PureComponent {
  render() {
    const {
      x,
      y,
      width,
      height,
      name,
      setSelection,
      onDragStart,
      onDragEnd,
    } = this.props;
    return (
      <BaseCellComponent
        x={x}
        y={y}
        width={width}
        height={height}
        className="CellName"
        setSelection={setSelection}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {name}
      </BaseCellComponent>
    );
  }
}

export default CellNameComponent;
