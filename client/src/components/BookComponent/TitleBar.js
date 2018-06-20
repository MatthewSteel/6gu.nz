import React, { Component } from 'react';
import classNames from 'classnames';
import equal from 'fast-deep-equal';

class PathElem extends Component {
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
    this.popStack = this.popStack.bind(this);
    this.deleteSheet = this.deleteSheet.bind(this);
  }

  shouldComponentUpdate(nextProps) {
    return !equal(nextProps, this.props);
  }

  deleteSheet() {
    const { viewId, deleteSheet } = this.props;
    deleteSheet(viewId);
  }

  popStack() {
    const { pathElems, setStackDepth, viewId } = this.props;
    setStackDepth(viewId, pathElems.length - 2); // -1, - sheet
  }

  render() {
    const { pathElems, setStackDepth, viewId } = this.props;

    const isChild = pathElems.length > 1;
    const children = pathElems.map((pathElem, i) => (
      <PathElem
        key={i}
        depth={i}
        last={i === pathElems.length - 1}
        setStackDepth={setStackDepth}
        pathElem={pathElem}
        viewId={viewId}
      />
    ));
    return (
      <div className="SheetTitle">
        {children}
        {!isChild && (
          <button
            onClick={this.deleteSheet}
            className="DeleteSheetButton"
          >
            &times;
          </button>
        )}
      </div>
    );
  }
}
