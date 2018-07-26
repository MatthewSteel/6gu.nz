import React, { PureComponent } from 'react';
import classNames from 'classnames';
import BaseCellComponent from './BaseCellComponent';
import { getType } from '../../selectors/formulas/tables';
import './CellComponent.css';

const defaultFormatter = (value, pushStack) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    const str = value.toString();
    const afterDecimal = str.split('.')[1];
    if (afterDecimal && afterDecimal.length > 6) {
      return value.toFixed(6);
    }
    return str;
  }
  if (typeof value === 'boolean') {
    return (
      <input type="checkbox" checked={value} disabled />
    );
  }
  const ourType = getType(value);
  const ellipsis = '\u22ef';
  const vertEllipsis = '\u22ee';
  if (ourType === 'array') return `[${vertEllipsis}]`;
  if (ourType === 'object') {
    const contentsStr = `{${ellipsis}}`;
    if (!pushStack || !value.template) return contentsStr;
    return (
      <div style={{ position: 'relative', zIndex: 0 }}>
        {contentsStr}
        <button onClick={pushStack} className="StackButton" type="button">
          +
        </button>
      </div>
    );
  }
  if (ourType === 'table') return `[{${ellipsis}}]`;
  return JSON.stringify(value);
};

class CellValueComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.pushStack = this.pushStack.bind(this);
  }

  getCellContents() {
    const { pushViewStack, value } = this.props;
    if (!value) return { error: 'Value missing' }; // ???
    if (value.error) return { error: value.error };
    return {
      formattedValue: defaultFormatter(
        value.value,
        pushViewStack && this.pushStack,
      ),
      override: value.override,
    };
  }

  pushStack(ev) {
    const { id, pushViewStack } = this.props;
    pushViewStack(id);
    ev.preventDefault();
  }

  render() {
    const { x, y, width, height, setSelection, extraClasses } = this.props;
    const { error, formattedValue, override } = this.getCellContents();
    const className = classNames(
      'CellValue',
      ...(extraClasses || []),
      {
        CellValueError: error,
        CellValueOverride: override,
      },
    );
    const title = override ? 'Value overridden in call' : error;
    return (
      <BaseCellComponent
        x={x}
        y={y}
        width={width}
        height={height}
        className={className}
        setSelection={setSelection}
        title={title}
      >
        {formattedValue}
      </BaseCellComponent>
    );
  }
}

export default CellValueComponent;
