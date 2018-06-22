import React, { Component } from 'react';
import classNames from 'classnames';
import equal from 'fast-deep-equal';

export class PathElem extends Component {
  constructor(props) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    const { depth, setStackDepth, viewId } = this.props;
    setStackDepth(viewId, depth);
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
  constructor(props) {
    super(props);
    this.deleteSheet = this.deleteSheet.bind(this);
  }

  shouldComponentUpdate(nextProps) {
    return !equal(nextProps, this.props);
  }

  deleteSheet() {
    const { viewId, deleteSheet } = this.props;
    deleteSheet(viewId);
  }

  render() {
    const { children, pathElems, setStackDepth, viewId } = this.props;

    const pathChildren = pathElems.map((pathElem, i) => (
      <PathElem
        key={i}
        depth={i + 1}
        last={i === pathElems.length - 1}
        setStackDepth={setStackDepth}
        pathElem={pathElem}
        viewId={viewId}
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
