import React from 'react';

const touchPosition = t => ({
  x: t.clientX,
  y: t.clientY,
});

/*
 * There are a hundred different ways to do this, some better than others.
 * This isn't particularly idiomatic, but it works. Store
 *
 *   this.ScrollHelper = scrollHelper(this.scroll)
 *
 * in the parent's constructor, and wrap
 *
 *   <this.ScrollHelper>
 *
 * around the contents we want to scroll over in the parent's render method.
 */

class ScrollHelper {
  constructor(callback) {
    this.dx = 0;
    this.dy = 0;
    const handlers = {};
    ['onWheel', 'onTouchCancel', 'onTouchEnd', 'onTouchMove', 'onTouchStart'].forEach((key) => {
      handlers[key] = this[key].bind(this);
    });
    this.handlers = handlers;
    this.touches = {};
    this.callback = callback;
  }

  onWheel(ev) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) return;
    const yMultiplier = ev.deltaMode === 0 ? 1 : 40;
    const xMultiplier = ev.deltaMode === 0 ? 1 : 100;
    this.dx += ev.deltaX * xMultiplier;
    this.dy += ev.deltaY * yMultiplier;
    ev.stopPropagation();
    this.ping();
  }

  onTouchCancel(ev) {
    const { changedTouches } = ev;
    for (let i = 0; i < changedTouches.length; ++i) {
      delete this.touches[changedTouches.item(i).identifier];
    }
    ev.stopPropagation();
  }

  onTouchEnd(ev) {
    this.onTouchCancel(ev);
  }

  onTouchMove(ev) {
    const { changedTouches } = ev;
    for (let i = 0; i < changedTouches.length; ++i) {
      const touch = changedTouches.item(i);
      const oldTouch = this.touches[touch.identifier];
      const newTouch = touchPosition(touch);
      this.touches[touch.identifier] = newTouch;
      this.dx -= newTouch.x - oldTouch.x;
      this.dy -= newTouch.y - oldTouch.y;
    }
    ev.stopPropagation();
    this.ping();
  }

  onTouchStart(ev) {
    const { changedTouches } = ev;
    for (let i = 0; i < changedTouches.length; ++i) {
      const touch = changedTouches.item(i);
      this.touches[touch.identifier] = touchPosition(touch);
    }
    ev.stopPropagation();
  }

  ping() {
    this.callback({ dy: this.dy, dx: this.dx });
  }
}

export default (callback) => {
  const { handlers } = new ScrollHelper(callback);
  return props => (
    <div style={{ display: 'contents', touchAction: 'none' }} {...handlers}>
      {props.children}
    </div>
  );
};
