import React, { PureComponent } from 'react';
import classNames from 'classnames';
import './CellComponent.css';
import BaseCellComponent from './BaseCellComponent';


class EmptyCellComponent extends PureComponent {
  render() {
    const { x, y, width, height, selected, setSelection } = this.props;
    const className = classNames(
      'EmptyCell',
      { EmptyCellSelected: selected },
    );
    return (
      <BaseCellComponent
        x={x}
        y={y}
        width={width}
        height={height}
        className={className}
        setSelection={setSelection}
      />
    );
  }
}
export default EmptyCellComponent;
