import React, { Component } from 'react';


class FileComponent extends Component {
  constructor(props) {
    super(props);
    this.handleLoadFile = this.handleLoadFile.bind(this);
  }

  handleLoadFile(ev) {
    this.props.loadFile();
    ev.preventDefault();
  }

  render() {
    return (
      <form
        id="loadFile"
        onSubmit={this.handleLoadFile}
      >
        <input
          type="submit"
          value="Load stored data"
        />
      </form>
    );
  }
}

export default FileComponent;
