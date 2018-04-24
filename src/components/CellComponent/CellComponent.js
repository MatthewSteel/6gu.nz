import React, { Fragment } from 'react';
import classNames from 'classnames';
import EmptyCellComponent from './EmptyCellComponent';
import './CellComponent.css';

const defaultFormatter = (value, pushStack) => {
  if (typeof value === 'string') return value;
  if (value instanceof Array) {
    return `[${value.length}]`;
  }
  if (typeof value === 'object' && value.constructor === Object) {
    const contentsStr = `{${Object.keys(value.byName).length}}`;
    if (value.template) {
      return (
        <div style={{ position: 'relative', zIndex: 0 }}>
          {contentsStr}
          <button onClick={pushStack} className="StackButton">+</button>
        </div>
      );
    }
    return contentsStr;
  }
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') {
    return (
      <input type="checkbox" checked={value} disabled />
    );
  }
  return JSON.stringify(value);
};

class CellComponent extends EmptyCellComponent {
  constructor(props) {
    super(props);
    this.pushStack = this.pushStack.bind(this);
    this.getCellContents = this.getCellContents.bind(this);
  }

  getCellContents() {
    const { value } = this.props;
    if (!value) return { error: 'Value missing' }; // ???
    if (value.error) return { error: value.error };
    return {
      formattedValue: defaultFormatter(value.value, this.pushStack),
      override: value.override,
    };
  }

  pushStack(ev) {
    const { id, pushViewStack } = this.props;
    pushViewStack(id);
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
          title={override ? 'Value overridden in call' : error}
        >
          {formattedValue || '\u200B'}
        </div>
      </Fragment>
    );
  }
}

export default CellComponent;
