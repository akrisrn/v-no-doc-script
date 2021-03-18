import '@/styles/social-preview.scss';

const select = document.querySelector('#top > div > select');
if (select) {
  select.previousElementSibling!.remove();
  select.remove();
}
document.querySelector<HTMLAnchorElement>('#top > div > a:first-of-type')!.innerText = 'HOME';

vno.mainSelf.tags = vno.mainSelf.tags.reverse();
