import React, { Component } from 'react';
import classNames from 'classnames';
import FireWhenClickedOutside from '../util/FireWhenClickedOutside';
import KeyboardListener from '../util/KeyboardListener';
import './DropDown.css';
import copyIcon from './copyIcon.svg';

class DropDownRow extends Component {
  constructor(props) {
    super(props);
    this.reset = this.reset.bind(this);

    this.select = this.select.bind(this);
    this.copy = this.copy.bind(this);

    this.rename = this.rename.bind(this);
    this.startRename = this.startRename.bind(this);
    this.delete = this.delete.bind(this);
    this.startDelete = this.startDelete.bind(this);

    this.inputRef = null;
    this.setInputRef = this.setInputRef.bind(this);

    this.state = { state: 'blank' };
  }

  setInputRef(ref) {
    this.inputRef = ref;
  }

  reset() {
    this.setState({ state: 'blank' });
  }

  startRename(ev) {
    this.setState({ state: 'renaming' });
    ev.stopPropagation();
  }

  startDelete(ev) {
    this.setState({ state: 'deleting' });
    ev.stopPropagation();
  }

  select() {
    const { id, selectItem } = this.props;
    selectItem(id);
  }

  rename(ev) {
    ev.preventDefault();
    const { renameItem, id } = this.props;
    const newName = this.inputRef.value;
    renameItem(id, newName);
    this.reset();
  }

  delete(ev) {
    const { deleteItem, id } = this.props;
    deleteItem(id);
    ev.stopPropagation();
  }

  copy(ev) {
    const { copyItem, id } = this.props;
    copyItem(id);
    this.reset();
    ev.stopPropagation();
  }

  render() {
    const { name, selected, unsaved } = this.props;
    const { state } = this.state;

    const renaming = state === 'renaming';
    const highlight = selected || renaming;

    const deleteAction = (state === 'deleting') ?
      this.delete : this.startDelete;
    const rowClassName = classNames(
      'DropDownRow',
      { DropDownHovered: highlight },
    );
    return (
      <div
        className={rowClassName}
        onClick={selected ? this.startRename : this.select}
      >
        <div>
          {state === 'renaming' ? (
            <form onSubmit={this.rename} >
              <input
                defaultValue={name}
                autoFocus
                onBlur={this.reset}
                ref={this.setInputRef}
              />
            </form>
          ) : (
            <span className={classNames(unsaved && 'Unsaved')}>
              {name}
            </span>
          )}
        </div>
        <div className="Spacer" />
        {this.props.renameItem && (
          <button
            className="DropDownButton"
            title="Rename"
            onClick={this.startRename}
            style={{ fontFamily: 'monospace' }}
          >
            I
          </button>
        )}
        {this.props.copyItem && (
          <button
            className="DropDownButton"
            title="Copy"
            onClick={this.copy}
          >
            <img src={copyIcon} alt="Copy" width="12px" />
          </button>
        )}
        {this.props.deleteItem && (
          <button
            className={classNames(
              'DropDownButton',
              { DeleteDropDownButton: state === 'deleting' },
            )}
            title="Delete"
            onClick={deleteAction}
          >
            &times;
          </button>
        )}
      </div>
    );
  }
}

export default class DropDownMenu extends Component {
  constructor(props) {
    super(props);
    this.copy = this.copy && this.copy.bind(this);
    this.delete = this.delete.bind(this);
    this.rename = this.rename.bind(this);
    this.select = this.select.bind(this);

    this.state = { open: false };
    this.openMenu = this.openMenu.bind(this);
    this.closeMenu = this.closeMenu.bind(this);

    this.keys = this.keys.bind(this);
  }

  keys(ev) {
    if (ev.key === 'Escape') {
      this.closeMenu();
    }
  }

  openMenu() {
    this.setState({ open: true });
  }
  closeMenu() {
    this.setState({ open: false });
  }
  static itemIsUnsaved() { return false; }
  static itemName(item) { return item.name; }

  render() {
    const { items, selectedItemId } = this.props;
    const selectedItem = items.find(({ id }) => id === selectedItemId);
    const { open } = this.state;

    const ret = (
      <div style={{ display: 'inline-block', position: 'relative' }}>
        <div
          className="TitleElem TitleLink"
          onClick={open ? this.closeMenu : this.openMenu}
        >
          {this.constructor.itemName(selectedItem)}...
        </div>
        {open && (
          <div className="DropDownMenu">
            {items.map(item => (
              <DropDownRow
                id={item.id}
                key={item.id}
                name={this.constructor.itemName(item)}
                selected={item.id === selectedItemId}
                copyItem={this.copy}
                deleteItem={this.delete}
                renameItem={this.rename}
                selectItem={this.select}
                unsaved={this.constructor.itemIsUnsaved(item)}
              />
            ))}
            <DropDownRow
              id="new"
              key="new"
              name={this.constructor.newItemName()}
              selectItem={this.select}
              unsaved
            />
          </div>
        )}
      </div>
    );
    if (!open) return ret;
    // Some annoying trouble with this: Clicking on the open/close button
    // first (I think) triggers the menu to close, then the click lands on
    // the button and it (having had a chance to re-render) opens itself.
    // So let's consider the open/close button "inside" the menu :-).
    return (
      <FireWhenClickedOutside callback={this.closeMenu} >
        <KeyboardListener callback={this.keys} />
        {ret}
      </FireWhenClickedOutside>
    );
  }
}
