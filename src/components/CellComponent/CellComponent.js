import React, { Fragment } from 'react';
import classNames from 'classnames';
import EmptyCellComponent from './EmptyCellComponent';
import './CellComponent.css';


class CellComponent extends EmptyCellComponent {
  constructor(props) {
    super(props);
    this.pushStack = this.pushStack.bind(this);
    this.getCellContents = this.getCellContents.bind(this);
  }

  getCellContents() {
    const { fmt, value } = this.props;
    if (!value || value.error) {
      return { error: true };
    }
    return {
      formattedValue: fmt(value.value, this.pushStack),
      override: value.override,
    };
  }

  pushStack(ev) {
    const { id, pushViewStack, viewId } = this.props;
    pushViewStack(viewId, id);
    ev.preventDefault();
  }

  render() {
    const {
      name,
      x,
      y,
      width,
      height,
      selected,
    } = this.props;
    const nameStyle = {
      gridColumn: `${x + 1} / span ${width}`,
      gridRow: `${(2 * y) + 1} / span 1`,
    };
    const valueStyle = {
      gridColumn: `${x + 1} / span ${width}`,
      gridRow: `${(2 * y) + 2} / span ${(2 * height) - 1}`,
    };
    const { error, formattedValue, override } = this.getCellContents();

    return (
      <Fragment>
        <div
          className={classNames(
            'CellName',
            { CellNameSelected: selected },
          )}
          style={nameStyle}
          onClick={this.onClick}
        >
          {name}
        </div>
        <div
          className={classNames(
            'CellValue',
            {
              CellValueError: error,
              CellValueOverride: override,
              CellValueSelected: selected,
            },
          )}
          style={valueStyle}
          onClick={this.onClick}
        >
          {formattedValue || '\u200B'}
        </div>
      </Fragment>
    );
  }
}

export default CellComponent;
