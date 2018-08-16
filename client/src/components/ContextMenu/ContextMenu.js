import React, { Component, Fragment } from 'react';
import TetherComponent from 'react-tether';
import uuidv4 from 'uuid-v4';

import './ContextMenu.css';

export class MenuItem extends Component {
  constructor(props) {
    super(props);
    this.submit = this.props.fn ? this.submit.bind(this) : undefined;
  }

  submit(ev) {
    ev.preventDefault();
    this.props.fn();
  }

  render() {
    return (
      <div className="DropDownRow" onClick={this.submit}>
        {this.props.children}
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
