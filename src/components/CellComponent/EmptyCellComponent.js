import React, { PureComponent } from 'react';
import classNames from 'classnames';
import './CellComponent.css';


class EmptyCellComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.onClick = this.onClick.bind(this);
  }

  onClick(ev) {
    ev.preventDefault();
    const { x, y, setSelection } = this.props;
    setSelection(y, x);
  }

  render() {
    const { x, y, selected } = this.props;
    const style = {
      gridColumn: `${x + 1} / span 1`,
      gridRow: `${(2 * y) + 1} / span 2`,
    };

    return (
      <div
        className={classNames(
          'Cell',
          { selected },
        )}
        style={style}
        onClick={this.onClick}
      />
    );
  }
}

export default EmptyCellComponent;
