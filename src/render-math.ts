vno.callAndListen(() => {
  renderMathInElement(document.body, {
    delimiters: [
      { left: '${', right: '}', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
    ],
  });
}, vno.EEvent.htmlChanged);
