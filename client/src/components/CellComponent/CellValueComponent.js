import React, { Component } from 'react';
import classNames from 'classnames';
import BaseCellComponent, { shouldCellComponentUpdate } from './BaseCellComponent';
import { getType } from '../../selectors/formulas/tables';
import './CellComponent.css';

const defaultFormatter = (value, pushStack, setCellValue) => {
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
      <input
        key={value}
        type="checkbox"
        checked={value}
        disabled={!setCellValue}
        onChange={setCellValue}
      />
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

export default class CellValueComponent extends Component {
  constructor(props) {
    super(props);
    this.pushStack = this.pushStack.bind(this);
    this.setValue = props.setCellFormula
      ? this.setValue.bind(this) : undefined;
  }

  getCellContents() {
    const { pushViewStack, value } = this.props;
    if (!value) return { error: 'Value missing' }; // ???
    if (value.error) return { error: value.error };
    return {
      formattedValue: defaultFormatter(
        value.value,
        pushViewStack && this.pushStack,
        this.setValue,
      ),
      override: value.override,
    };
  }

  setValue(ev) {
    const value = ev.target.type === 'checkbox'
      ? ev.target.checked // ev.target.value is always "on"... wtf
      : ev.target.value;
    const { setCellFormula } = this.props;
    const { ref } = this.props.clickExpr;
    if (!ref) throw new Error('Trying to edit non-ref cell value...');
    const selection = { cellId: ref, context: ref };
    if (!['boolean', 'string', 'number'].includes(typeof value)) {
      throw new Error('Trying to set cell value to bad type.');
    }
    const formula = JSON.stringify(value);
    setCellFormula(selection, formula);
  }

  pushStack(ev) {
    const { clickExpr, pushViewStack } = this.props;
    pushViewStack(clickExpr.ref);
    ev.preventDefault();
  }

  shouldComponentUpdate(nextProps) {
    return shouldCellComponentUpdate(this.props, nextProps);
  }

  render() {
    const { clickExpr, x, y, width, height, setSelection } = this.props;
    const { error, formattedValue, override } = this.getCellContents();
    const className = classNames(
      'CellValue', { CellValueError: error, CellValueOverride: override },
    );
    const title = override ? 'Value overridden in call' : error;
    return (
      <BaseCellComponent
        x={x}
        y={y}
        clickExpr={clickExpr}
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
