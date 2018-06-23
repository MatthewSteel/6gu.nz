import React, { Component } from 'react';
import classNames from 'classnames';
import equal from 'fast-deep-equal';

export class PathElem extends Component {
  constructor(props) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    const { depth, setStackDepth } = this.props;
    setStackDepth(depth);
  }

  render() {
    const { last, pathElem } = this.props;
    if (last) return <span className="TitleElem">{pathElem}</span>;
    return (
      <span
        className={classNames('TitleElem', 'TitleLink')}
        onClick={this.handleClick}
      >
        {pathElem}
      </span>
    );
  }
}

export default class TitleBar extends Component {
  shouldComponentUpdate(nextProps) {
    return !equal(nextProps, this.props);
  }

  render() {
    const { children, pathElems, setStackDepth } = this.props;

    const pathChildren = pathElems.map((pathElem, i) => (
      <PathElem
        key={i}
        depth={i + 1}
        last={i === pathElems.length - 1}
        setStackDepth={setStackDepth}
        pathElem={pathElem}
      />
    ));
    return (
      <div className="SheetTitle">
        {children}
        {pathChildren}
      </div>
    );
  }
}
