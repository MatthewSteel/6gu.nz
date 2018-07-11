import React, { Component, Fragment } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import TetherComponent from 'react-tether';
import uuidv4 from 'uuid-v4';

import KeyboardListener from '../util/KeyboardListener';
import { unparseName } from '../../selectors/formulas/unparser';
import { setFormula } from '../../redux/documentEditing';
import '../DropDown/DropDown.css';

const selectTarget = (ev) => {
  ev.target.select();
};

class CreateMenuItem extends Component {
  constructor(props) {
    super(props);
    this.reset = this.reset.bind(this);
    this.keys = this.keys.bind(this);

    this.submit = this.submit.bind(this);
    this.startRename = this.startRename.bind(this);
    this.setName = this.setName.bind(this);

    this.state = { state: 'blank', name: props.initialName };
  }

  setName(ev) {
    this.setState({ name: ev.target.value });
  }

  reset() {
    this.setState({ state: 'blank', name: this.props.initialName });
  }

  keys(ev) {
    if (ev.key === 'Escape') {
      this.reset();
    }
  }

  startRename(ev) {
    this.setState({ state: 'renaming' });
    ev.stopPropagation();
  }

  submit(ev) {
    ev.preventDefault();
    const name = this.state.name || this.props.initialName;
    this.props.fn(name);
  }

  render() {
    const { buttonText } = this.props;
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
        {renaming && <KeyboardListener callback={this.keys} />}
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
        <div className="Spacer" />
        <button
          className="DropDownButton"
          title={buttonText}
          onClick={this.submit}
          type="button"
        >
          &#x2714;
        </button>
      </div>
    );
  }
}

class CreateMenu extends Component {
  constructor(props) {
    super(props);
    this.unmounting = false;
    this.enterCell = this.enterCell.bind(this);
    this.exitCell = this.exitCell.bind(this);
    this.enterMenu = this.enterMenu.bind(this);
    this.exitMenu = this.exitMenu.bind(this);

    this.newTable = this.newThing.bind(this, '[{}]');
    this.newObject = this.newThing.bind(this, '{}');
    this.newArray = this.newThing.bind(this, '[]');

    this.state = {
      open: false,
      inCell: false,
      inMenu: false,
      actionId: null,
    };
  }

  newThing(str, name) {
    const { selection, setFormulaProp } = this.props;
    const formula = `${unparseName(name)}: ${str}`;
    setFormulaProp(selection, formula);
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
    const { selection } = this.props;

    const { x, y } = selection;
    const style = {
      gridColumn: x + 1,
      gridRow: `${2 * y + 1} / span 2`,
      opacity: 0,
      position: 'relative',
      zIndex: 2,
    };

    const items = [
      { name: 'Table', buttonText: '[{}]', fn: this.newTable },
      { name: 'Object', buttonText: '{}', fn: this.newObject },
      { name: 'Array', buttonText: '[]', fn: this.newArray },
    ];

    return (
      <Fragment>
        <TetherComponent
          attachment="top left"
          constraints={[{ to: 'window', attachment: 'together' }]}
          targetAttachment="bottom right"
        >
          <div
            style={style}
            onMouseOver={this.enterCell}
            onMouseLeave={this.exitCell}
          />
          {open && (
            <div
              style={{ width: '180px' }}
              onMouseEnter={this.enterMenu}
              onMouseLeave={this.exitMenu}
            >
              <div className="CreateMenuHeader">
                New
              </div>
              {items.map(({ name, buttonText, fn }) => (
                <CreateMenuItem
                  initialName={name}
                  key={name}
                  buttonText={buttonText}
                  fn={fn}
                />
              ))}
            </div>
          )}
        </TetherComponent>
      </Fragment>
    );
  }
}

const mapDispatchToProps = dispatch => ({
  setFormulaProp: (sel, str) => dispatch(setFormula(sel, str)),
});

export default connect(null, mapDispatchToProps)(CreateMenu);
