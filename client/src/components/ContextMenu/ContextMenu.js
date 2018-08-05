import React, { Component, Fragment } from 'react';
import classNames from 'classnames';
import TetherComponent from 'react-tether';
import uuidv4 from 'uuid-v4';

import KeyboardListener from '../util/KeyboardListener';
import './ContextMenu.css';

const selectTarget = (ev) => {
  ev.target.select();
};

export class MenuItem extends Component {
  constructor(props) {
    super(props);
    this.submit = this.submit.bind(this);
  }

  submit(ev) {
    ev.preventDefault();
    this.props.fn();
  }

  render() {
    return (
      <div className="DropDownRow" onClick={this.submit}>
        {this.props.contents}
      </div>
    );
  }
}

export class NameMenuItem extends Component {
  constructor(props) {
    super(props);
    this.reset = this.reset.bind(this);
    this.keys = this.keys.bind(this);

    this.submit = this.submit.bind(this);
    this.startRename = this.startRename.bind(this);
    this.setName = this.setName.bind(this);

    this.state = { state: 'blank', name: props.contents };
  }

  setName(ev) {
    this.setState({ name: ev.target.value });
  }

  reset() {
    this.setState({ state: 'blank', name: this.props.contents });
  }

  keys(ev) {
    if (ev.key === 'Escape') this.reset();
  }

  startRename(ev) {
    this.setState({ state: 'renaming' });
    ev.stopPropagation();
  }

  submit(ev) {
    ev.preventDefault();
    const name = this.state.name || this.props.contents;
    this.props.fn(name);
  }

  render() {
    const { state, name } = this.state;

    const renaming = state === 'renaming';

    const rowClassName = classNames(
      'DropDownRow',
      { DropDownHovered: renaming },
    );
    return (
      <div
        className={rowClassName}
        onClick={this.startRename}
      >
        {renaming && (
          <KeyboardListener callback={this.keys} priority={10} greedy />
        )}
        <div>
          {state === 'renaming' ? (
            <form onSubmit={this.submit}>
              <input
                defaultValue={name}
                autoFocus
                onBlur={this.reset}
                onChange={this.setName}
                onFocus={selectTarget}
                size={12}
              />
            </form>
          ) : name}
        </div>
      </div>
    );
  }
}

export default class ContextMenu extends Component {
  constructor(props) {
    super(props);
    this.unmounting = false;
    this.enterCell = this.enterCell.bind(this);
    this.exitCell = this.exitCell.bind(this);
    this.enterMenu = this.enterMenu.bind(this);
    this.exitMenu = this.exitMenu.bind(this);

    this.state = {
      open: false,
      inCell: false,
      inMenu: false,
      actionId: null,
    };
  }

  componentDidUpdate(prev) {
    if (!this.state.open) return;
    if (prev.x !== this.props.x || prev.y !== this.props.y) {
      // Close the menu if we move the selection. Will cause a re-render,
      // nobody cares.
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ open: false });
    }
  }

  enterCell() {
    const actionId = uuidv4();
    this.setState({ inCell: true, actionId });
    this.ping(actionId);
  }

  exitCell() {
    const actionId = uuidv4();
    this.setState({ inCell: false, actionId });
    this.ping(actionId);
  }

  enterMenu() {
    const actionId = uuidv4();
    this.setState({ inMenu: true, actionId });
    this.ping(actionId);
  }

  exitMenu() {
    const actionId = uuidv4();
    this.setState({ inMenu: false, actionId });
    this.ping(actionId);
  }

  maybeCloseMenu(actionId) {
    if (this.unmounting) return;
    if (this.state.actionId !== actionId) return;
    const { inMenu, inCell } = this.state;
    this.setState({ open: inMenu || inCell });
  }

  ping(actionId) {
    window.setTimeout(this.maybeCloseMenu.bind(this, actionId), 400);
  }

  componentWillUnmount() {
    // Don't call setState after the selection moves and everything
    // disappears.
    this.unmounting = true;
  }

  render() {
    const { open } = this.state;
    const { x, y, width, height, title, children } = this.props;

    const gridStyle = {
      gridColumn: `${x + 1} / span ${width}`,
      gridRow: `${2 * y + 1} / span ${2 * height}`,
    };

    return (
      <Fragment>
        <TetherComponent
          attachment="top left"
          constraints={[{ to: 'window', attachment: 'together' }]}
          targetAttachment="bottom right"
        >
          <div className="CreateMenuDotHover" style={gridStyle}>
            <div
              onMouseOver={this.enterCell}
              onMouseLeave={this.exitCell}
            >
              {'\u22ef' /* ellipsis */}
            </div>
          </div>
          {open && (
            <div
              style={{ width: '180px' }}
              onMouseEnter={this.enterMenu}
              onMouseLeave={this.exitMenu}
            >
              {title && (
                <div className="CreateMenuHeader">
                  {title}
                </div>
              )}
              {children}
            </div>
          )}
        </TetherComponent>
      </Fragment>
    );
  }
}
