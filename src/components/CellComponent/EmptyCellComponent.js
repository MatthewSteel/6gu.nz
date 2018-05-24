import React, { PureComponent } from 'react';
import './CellComponent.css';
import BaseCellComponent from './BaseCellComponent';

class EmptyCellComponent extends PureComponent {
  render() {
    const { x, y, width, height, setSelection } = this.props;
    return (
      <BaseCellComponent
        x={x}
        y={y}
        width={width}
        height={height}
        className="EmptyCell"
        setSelection={setSelection}
      />
    );
  }
}
export default EmptyCellComponent;
