import React, { Fragment, PureComponent } from 'react';
import CellNameComponent from './CellNameComponent';
import CellValueComponent from './CellValueComponent';
import './CellComponent.css';

class CellComponent extends PureComponent {
  render() {
    const {
      id,
      pushViewStack,
      name,
      x,
      y,
      width,
      height,
      selected,
      setSelection,
      value,
    } = this.props;

    return (
      <Fragment>
        <CellNameComponent
          name={name}
          x={x}
          y={y}
          width={width}
          height={0.5}
          selected={selected}
          setSelection={setSelection}
        />
        <CellValueComponent
          x={x}
          y={y + 0.5}
          width={width}
          height={height - 0.5}
          selected={selected}
          setSelection={setSelection}
          value={value}
          pushViewStack={pushViewStack}
          id={id}
        />
      </Fragment>
    );
  }
}

export default CellComponent;
