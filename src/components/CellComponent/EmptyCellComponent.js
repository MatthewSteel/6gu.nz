import React, { PureComponent } from 'react';
import classNames from 'classnames';
import './CellComponent.css';
import BaseCellComponent from './BaseCellComponent';
import CellSelectionComponent from './CellSelectionComponent';


class EmptyCellComponent extends PureComponent {
  render() {
    const { x, y, width, height, selected, setSelection } = this.props;
    const className = classNames(
      'EmptyCell',
      { EmptyCellSelected: selected },
    );
    return (
      <CellSelectionComponent
        x={x}
        y={y}
        width={width}
        height={height}
        selected={selected}
      >
        <BaseCellComponent
          x={x}
          y={y}
          width={width}
          height={height}
          className={className}
          setSelection={setSelection}
        />
      </CellSelectionComponent>
    );
  }
}
export default EmptyCellComponent;
