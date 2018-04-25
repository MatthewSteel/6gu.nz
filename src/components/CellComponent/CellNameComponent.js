import React, { PureComponent } from 'react';
import classNames from 'classnames';
import BaseCellComponent from './BaseCellComponent';

class CellNameComponent extends PureComponent {
  render() {
    const { x, y, width, height, name, selected, setSelection } = this.props;
    const className = classNames(
      'CellName',
      { CellNameSelected: selected },
    );
    return (
      <BaseCellComponent
        x={x}
        y={y}
        width={width}
        height={height}
        className={className}
        setSelection={setSelection}
      >
        {name}
      </BaseCellComponent>
    );
  }
}

export default CellNameComponent;
