import React, { PureComponent } from 'react';
import './HoveredParent.css';

export default class HoveredParent extends PureComponent {
  render() {
    const { id, children } = this.props;
    return <div id={id} className="ParentHover">{children}</div>;
  }
}
