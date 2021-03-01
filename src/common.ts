import '@/styles/common.scss';

vno.appSelf.addLink(vno.getMessage('paths.console'));
vno.appSelf.addLink(vno.getMessage('paths.sandbox'));
vno.appSelf.addLink(vno.getMessage('paths.graph'));
vno.appSelf.addLink(vno.getMessage('paths.releases', vno.selectConf));
vno.appSelf.addLink(vno.getMessage('paths.api', vno.selectConf));
vno.appSelf.$nextTick(() => vno.updateDom());

vno.callAndListen(() => {
  const itemCommit = document.querySelector<HTMLElement>('.item-commit');
  if (!itemCommit) {
    return;
  }
  const hash = itemCommit.innerText;
  const a = document.createElement('a');
  a.href = vno.getMessage('links.raw', hash + vno.filePath);
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.text = hash;
  itemCommit.innerHTML = '';
  itemCommit.append(a);
}, vno.EEvent.mainShown, document, true);

vno.callAndListen(() => {
  if (vno.filePath.split('/')[2] !== 'api' || vno.mainSelf.isError) {
    return;
  }
  document.querySelectorAll('header,h2,h3,h4,h5,h6,#toc').forEach(element => {
    element.classList.add('api');
  });
}, vno.EEvent.htmlChanged, document, true);
