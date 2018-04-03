import React, { PureComponent } from 'react';
import classNames from 'classnames';
import './CellComponent.css';


class CellComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.onClick = this.onClick.bind(this);
    this.pushStack = this.pushStack.bind(this);
    this.getCellContents = this.getCellContents.bind(this);
  }

  onClick(ev) {
    ev.preventDefault();
    const { x, y, setSelection } = this.props;
    setSelection(y, x);
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
    const style = {
      gridColumn: `${x + 1} / span ${width}`,
      gridRow: `${y + 1} / span ${height}`,
    };
    const { error, formattedValue, override } = this.getCellContents();

    return (
      <div
        className={classNames(
          'Cell',
          { selected },
        )}
        style={style}
        onClick={this.onClick}
      >
        {name && (
          <div className="Name">
            {name}
          </div>
        )}
        {name && (
          <div
            className={classNames(
              'Value',
              { CellError: error, CellOverride: override },
            )}
          >
            {formattedValue || '\u200B'}
          </div>
        )}
      </div>
    );
  }
}

export default CellComponent;
