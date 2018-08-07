import React, { Component, Fragment } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import equal from 'fast-deep-equal';

import KeyboardListener, { FALL_THROUGH, CAPTURE } from '../util/KeyboardListener';
import { getRefsById } from '../../selectors/formulas/selectors';
import { unparseFormula } from '../../selectors/formulas/unparser';
import { deleteLoc, deleteThing, setFormula, updateForeignKey } from '../../redux/documentEditing';
import { setFormulaFocus } from '../../redux/uistate';
import {
  inputFromFormula,
  inputFromDom,
  htmlFromInput,
  formulaFromInput,
  nbsp,
  zeroWidthSpace,
  zwsRegex,
} from '../../selectors/formulas/inputFormula';
import './Formula.css';

/* This is getting a little complicated. We want some fancy formatting, and
 * we don't want to completely take over the user's keyboard, so we use
 * contenteditable. Doing "controlled contenteditable" is a bit scary, so
 * we're going to try doing it uncontrolled.
 */

const normalisePoint = (inputRef, position, allPositions, isAnchor) => {
  // isAnchor is just used to decide whether to move the selection point to
  // before or after a "token" div node if it has landed inside it.

  let insidePosition = position;
  // We want the `position.node` to be a child of `inputRef`, but sometimes
  // it is `inputRef` itself. Fix that.
  if (position.node === inputRef) {
    const numChildren = inputRef.childNodes.length;
    if (numChildren === position.offset) {
      const lastChild = inputRef.childNodes[numChildren - 1];
      const offset = isText(lastChild) ? lastChild.length : 0;
      insidePosition = { node: lastChild, offset };
    } else {
      const node = inputRef.childNodes[position.offset];
      insidePosition = { node, offset: 0 };
    }
  }
  // If the point is before the formula bar, reset it to the start.
  const firstNode = allPositions[0].node;
  const leftCompare = insidePosition.node.compareDocumentPosition(firstNode);
  if ((leftCompare & 4) === 4) { // "before". WTF.
    return allPositions[0];
  }

  // If the point is after the formula bar, reset it to the start.
  const lastNode = allPositions[allPositions.length - 1].node;
  const rightCompare = insidePosition.node.compareDocumentPosition(lastNode);
  if ((rightCompare & 2) === 2) { // "after". WTF.
    return allPositions[allPositions.length - 1];
  }

  // If the point is in a text node, make sure it is in a valid location.
  // (Mostly "not right up against a div")
  let selectedNode = insidePosition.node;
  if (selectedNode.parentNode === inputRef && isText(selectedNode)) {
    // In a text node, thank goodness. Return a close "ok" position.
    const sameNodePositions = allPositions.filter(({ node }) => (
      node === selectedNode));
    const maybeSamePosition = sameNodePositions.find(({ offset }) => (
      offset === insidePosition.offset));
    if (maybeSamePosition) return maybeSamePosition;
    const maybeClosePosition = sameNodePositions.find(({ offset }) => (
      Math.abs(offset - insidePosition.offset) === 1));
    if (maybeClosePosition) return maybeClosePosition;
    return sameNodePositions[0]; // !!!
  }

  // If the point is in a (div) token node, move it rightwards. There should
  // be a text node after it.
  while (selectedNode.parentNode !== inputRef) {
    selectedNode = selectedNode.parentNode;
  }
  if (isAnchor) {
    const { previousSibling } = selectedNode;
    // Before zws.
    const offset = previousSibling.data.length - 1;
    return { node: previousSibling, offset };
  }
  return { node: selectedNode.nextSibling, offset: 1 };
};

const normaliseSelection = (inputRef, sel, positions) => {
  const anchor = { node: sel.anchorNode, offset: sel.anchorOffset };
  const focus = { node: sel.focusNode, offset: sel.focusOffset };

  return {
    anchor: normalisePoint(inputRef, anchor, positions, true),
    focus: normalisePoint(inputRef, focus, positions, false),
  };
};

const moveFocus = (position, allPositions, direction, speed) => {
  const index = allPositions.findIndex(({ node, offset }) => (
    position.node === node && position.offset === offset));

  if (index === 0 && direction === 'left') return position;

  const last = allPositions.length - 1;
  if (index === last && direction === 'right') return position;

  // End/home/arrow-up/arrow-down
  if (speed === 'toEnd') {
    if (direction === 'left') {
      return allPositions[0];
    }
    return allPositions[last];
  }

  // left/right/backspace/del, maybe with ctrl/meta for fast-move.
  const move = direction === 'left' ? -1 : 1;
  let i = index + move;
  for (; i !== 0 && i !== last; i += move) {
    if (speed === 'singleChar' || allPositions[i].isWordBreak) break;
  }
  return allPositions[i];
};

const getPositions = (inputRef) => {
  const ret = [];
  const numNodes = inputRef.childNodes.length;
  for (let i = 0; i < numNodes; ++i) {
    const node = inputRef.childNodes.item(i);
    if (!isText(node)) continue;
    const str = node.data;
    for (let j = 0; j <= str.length; ++j) {
      // Do not include the first position if we are after a token.
      if (isToken(inputRef.childNodes[i - 1]) && j === 0) continue;
      // Do not include the last position if we are before a token.
      if (isToken(inputRef.childNodes[i + 1]) && j === str.length) continue;
      // Do not include the first position if it is the last position of
      // the previous node. (Essentially, only include the first position if
      // there is no previous node.)
      if (isText(inputRef.childNodes[i - 1]) && j === 0) continue;

      const isWordBreak = str[j - 1] === zeroWidthSpace
        || str[j] === zeroWidthSpace
        || str.slice(j - 1, j + 1).match(/\s[^s]/);
      ret.push({ node, offset: j, isWordBreak });
    }
  }
  return ret;
};

const isText = node => node && node.nodeType === 3;
const isToken = node => node
  && node.attributes && node.attributes['data-6gu-src'];

const normaliseFormulaContents = (inputRef) => {
  // Delete non-text, non-token nodes.
  const nodesToDelete = [];
  for (let i = 0; i < inputRef.childNodes.length; ++i) {
    const node = inputRef.childNodes.item(i);
    if (!isText(node) && !isToken(node)) nodesToDelete.push(node);
  }
  nodesToDelete.forEach((node) => { node.remove(); });

  // Make sure text nodes adjacent to token nodes start/end with zws.
  for (let i = 0; i < inputRef.childNodes.length; ++i) {
    const node = inputRef.childNodes.item(i);
    if (node.nodeType !== 3) continue;
    const prevNode = inputRef.childNodes.item(i - 1);
    const nextNode = inputRef.childNodes.item(i + 1);
    let text = node.data.replace(zwsRegex, '');

    if (isToken(prevNode)) text = zeroWidthSpace + text;
    if (isToken(nextNode)) text += zeroWidthSpace;
    if (text !== node.data) node.data = text;
  }
  // Make sure there is at least one place to write :-)
  if (inputRef.childNodes.length === 0) inputRef.append(nbsp);
};

class Formula extends Component {
  constructor(props) {
    super(props);
    this.inputRef = null;

    this.handleOnBlur = this.handleOnBlur.bind(this);
    this.handleOnFocus = this.handleOnFocus.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onInput = this.onInput.bind(this);
    this.submit = this.submit.bind(this);
    this.setRef = this.setRef.bind(this);
    this.keys = this.keys.bind(this);
    this.writeForeignKey = this.writeForeignKey.bind(this);

    this.hasFocus = false; // Not for display, just for keeping track.
    this.state = { foreignKeyCol: undefined };
  }

  componentWillReceiveProps(next) {
    const formulaChanged = next.initialValue !== this.props.initialValue;
    const selectionChanged = !equal(next.selection, this.props.selection);
    if (this.inputRef && (formulaChanged || selectionChanged)) {
      this.inputRef.innerHTML = next.initialValue || nbsp;
      if (this.state.foreignKeyCol) {
        this.setState({ foreignKeyCol: undefined });
      }
    }
  }

  setRef(ref) {
    this.inputRef = ref;
    this.resetValue();
  }

  setFormula(formulaStr) {
    const { deleteCell, selection, setCellFormula, updateFk } = this.props;
    const { foreignKeyCol } = this.state;
    if (selection.readOnly) return;
    if (formulaStr.replace(/\s/g, '') !== '') {
      if (foreignKeyCol) {
        updateFk(foreignKeyCol, formulaStr);
      } else {
        setCellFormula(selection, formulaStr);
      }
    } else if (selection.cellId) {
      if (foreignKeyCol) {
        updateFk(foreignKeyCol, undefined);
      } else {
        deleteCell(selection.cellId);
      }
    }
  }

  resetValue() {
    if (this.inputRef) {
      this.inputRef.innerHTML = this.props.initialValue || nbsp;
    }
  }

  maybeInsertExprIntoFormula(expr) {
    if (!this.hasFocus) return false;
    this.normaliseSelection();
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return false;
    const { renderFormula } = this.props;
    const range = selection.getRangeAt(0);
    const newHtml = renderFormula(expr);
    const newNode = document.createRange().createContextualFragment(newHtml);
    range.insertNode(newNode);
    this.normaliseSelection(); // ?
    selection.collapseToEnd();
    return true;
  }

  blur() {
    this.resetValue();
    this.inputRef.blur();
  }

  focus() {
    this.inputRef.focus();
    const { lastChild } = this.inputRef;
    window.getSelection().collapse(lastChild, lastChild.length);
  }

  sendKey(key) {
    this.inputRef.innerText = key; // does not trigger onInput
    const range = document.createRange();
    range.selectNodeContents(this.inputRef);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    this.inputRef.focus();
  }

  submit() {
    const { formulaStrFromElem, selection } = this.props;
    if (!selection) return;
    this.inputRef.focus(); // Make sure view is properly focussed
    const formula = formulaStrFromElem(this.inputRef);
    this.setFormula(formula);
    if (this.inputRef) this.inputRef.blur();
  }

  handleOnBlur() {
    if (this.state.foreignKeyCol) {
      this.setState({ foreignKeyCol: undefined });
    }
    this.inputRef.innerHTML = this.props.initialValue; // !?
    this.hasFocus = false;
    this.props.setFormulaFocusProp(false);
  }

  handleOnFocus() {
    this.hasFocus = true;
    this.props.setFormulaFocusProp(true);
  }

  keys(ev) {
    if (this.hasFocus) return this.formulaKeys(ev);
    return this.cellKeys(ev);
  }

  formulaKeys(ev) {
    if (ev.key === 'Escape') {
      // Enter selects the formula box
      this.blur();
      ev.preventDefault();
    }
    // I'm not over the moon about submitting on shift-enter -- it could be
    // useful for entering multiline, rich text etc...
    // Maybe if/when we do that, that entry can suppress this behaviour?
    if (ev.key === 'Enter' || ev.key === 'Tab') {
      this.submit();
      return FALL_THROUGH;
      // Don't prevent default, just let the selection move naturally :-)
    }

    // Maybe move.
    let speed = 'singleChar';
    if (['End', 'Home', 'ArrowUp', 'ArrowDown'].includes(ev.key)) {
      speed = 'toEnd';
    } else if (ev.ctrlKey || ev.metaKey) {
      speed = 'fast';
    }
    let direction = null;
    if (['End', 'ArrowRight', 'ArrowDown', 'Delete'].includes(ev.key)) {
      direction = 'right';
    } else if (['Home', 'ArrowLeft', 'ArrowUp', 'Backspace'].includes(ev.key)) {
      direction = 'left';
    }
    const deleting = ev.key === 'Backspace' || ev.key === 'Delete';
    const justDeleteSelection = deleting
      && window.getSelection().type === 'Range';
    const leaveAnchor = ev.shiftKey || deleting;
    if (direction && !justDeleteSelection) {
      this.updateSelection(direction, speed, leaveAnchor);
    }
    if (direction && !deleting) {
      ev.preventDefault();
    }
    return CAPTURE;
  }

  normaliseSelection() {
    const positions = getPositions(this.inputRef);
    const selection = window.getSelection();
    const { anchor, focus } = normaliseSelection(
      this.inputRef,
      selection,
      positions,
    );
    selection.setBaseAndExtent(
      anchor.node, anchor.offset, focus.node, focus.offset,
    );
  }

  onClick() {
    this.normaliseSelection();
  }

  onInput() {
    normaliseFormulaContents(this.inputRef);
    this.normaliseSelection();
  }

  updateSelection(direction, speed, leaveAnchor) {
    const positions = getPositions(this.inputRef);
    const selection = window.getSelection();
    const { anchor, focus } = normaliseSelection(
      this.inputRef,
      selection,
      positions,
    );
    const newFocus = moveFocus(focus, positions, direction, speed);

    if (leaveAnchor) {
      selection.setBaseAndExtent(
        anchor.node, anchor.offset, newFocus.node, newFocus.offset,
      );
    } else {
      selection.collapse(newFocus.node, newFocus.offset);
    }
  }

  cellKeys(ev) {
    const { deleteCell, deleteLocation, selection } = this.props;
    if (selection.readOnly) return;
    if (ev.key === 'Enter') {
      this.focus();
      ev.preventDefault();
    }
    if (ev.key === 'Backspace' || ev.key === 'Delete') {
      ev.preventDefault();
      if (selection.locationSelected) {
        const { type, index } = selection.locationSelected;
        deleteLocation(selection.context, type, index);
      } else {
        deleteCell(selection.cellId);
      }
    }
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    if (ev.key.length === 1) {
      ev.preventDefault();
      this.sendKey(ev.key);
    }
  }

  writeForeignKey(column) {
    this.setState({ foreignKeyCol: column.id });
    this.inputRef.innerHTML = nbsp;
    this.focus();
  }

  render() {
    const { renderFormula, selection } = this.props;
    const readOnly = !selection || selection.readOnly;
    const notEmpty = selection && selection.cellId;
    const { foreignKeyCol } = this.state;
    let fkPrompt;
    if (foreignKeyCol) {
      const fkHtml = renderFormula({ ref: foreignKeyCol });
      const fkElem = <div dangerouslySetInnerHTML={{ __html: fkHtml }} />;
      fkPrompt = (
        <div
          className={classNames('HasContent', 'FormulaInput', 'FakeFormula')}
        >
          Column that&ensp;{fkElem}&ensp;refers to:
        </div>
      );
    }
    return (
      <Fragment>
        {fkPrompt}
        <div
          type="text"
          className={classNames(
            'FormulaInput',
            readOnly && 'ReadOnlyFormula',
            notEmpty && 'HasContent',
          )}
          disabled={readOnly}
          onClick={this.onClick}
          onInput={this.onInput}
          onBlur={this.handleOnBlur}
          onFocus={this.handleOnFocus}
          contentEditable={!readOnly}
          ref={this.setRef}
        />
        <KeyboardListener callback={this.keys} priority={6} />
      </Fragment>
    );
  }
}

const mapStateToProps = (state) => {
  const { selection } = state;
  const selectedCellId = selection && selection.cellId;
  const formulaStrFromElem = elem => (
    formulaFromInput(inputFromDom(elem), state));
  const renderFormula = formula => (
    htmlFromInput(unparseFormula(formula, selection.context, state), state));
  if (!selectedCellId) {
    return { formulaStrFromElem, selection, initialValue: '', renderFormula };
  }

  const ref = getRefsById(state)[selectedCellId];
  const initialValue = htmlFromInput(inputFromFormula(ref, state), state);
  return { formulaStrFromElem, selection, initialValue, renderFormula };
};

const mapDispatchToProps = dispatch => ({
  deleteCell: cellId => dispatch(deleteThing(cellId)),
  deleteLocation: (context, y, x) => dispatch(deleteLoc(context, y, x)),
  setCellFormula: (context, cellId, formula) => dispatch(setFormula(context, cellId, formula)),
  setFormulaFocusProp: hasFocus => dispatch(setFormulaFocus(hasFocus)),
  updateFk: (fkCol, formula) => dispatch(updateForeignKey(fkCol, formula)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  null,
  { withRef: true },
)(Formula);
