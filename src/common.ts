import '@/styles/common.scss';

const topDiv = document.querySelector('#top > div')!;

const apiLink = document.createElement('a');
apiLink.href = `#${vno.getMessage('paths.api', [vno.selectConf])}`;
const select = topDiv.querySelector('select');
if (select) {
  topDiv.insertBefore(apiLink, select);
} else {
  topDiv.append(apiLink);
}

const addToTop = (href: string) => {
  const link = document.createElement('a');
  link.href = href;
  topDiv.insertBefore(link, apiLink);
};

addToTop(`#${vno.getMessage('paths.console', [])}`);
addToTop(`#${vno.getMessage('paths.sandbox', [])}`);
addToTop(`#${vno.getMessage('paths.graph', [])}`);
addToTop(`#${vno.getMessage('paths.releases', [vno.selectConf])}`);

vno.updateDom().then();

vno.callAndListen(() => {
  const itemCommit = document.querySelector<HTMLElement>('.item-commit');
  if (!itemCommit) {
    return;
  }
  const hash = itemCommit.innerText;
  const a = document.createElement('a');
  a.href = vno.getMessage('links.raw', [hash + vno.filePath]);
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.text = hash;
  itemCommit.innerHTML = '';
  itemCommit.append(a);
}, vno.EEvent.mainShown);

vno.callAndListen(() => {
  if (vno.filePath.split('/')[2] !== 'api' || vno.mainSelf.isError) {
    return;
  }
  document.querySelectorAll('header,h2,h3,h4,h5,h6,#toc').forEach(element => {
    element.classList.add('api');
  });
}, vno.EEvent.htmlChanged);

vno.callAndListen(() => vno.waitFor(() => {
  twemoji.parse(document.body);
}), vno.EEvent.htmlChanged);
