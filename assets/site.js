(() => {
  'use strict';
  const projects = window.SHOW_PROJECTS || [];
  const categoryNames = { demo: '互动演示', game: '小游戏', tool: '小工具' };
  const grid = document.querySelector('#project-grid');
  const search = document.querySelector('#project-search');
  const filters = [...document.querySelectorAll('[data-filter]')];
  const empty = document.querySelector('#empty-state');
  let category = 'all';

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function createCard(project, index) {
    const link = element('a', `project-card theme-${project.theme || 'default'}`);
    link.href = project.href;
    link.setAttribute('aria-labelledby', `title-${project.id}`);
    const cover = element('div', 'project-cover');
    const top = element('div', 'cover-top');
    top.append(element('span', 'category-badge', categoryNames[project.category] || '作品'), element('span', 'project-number', `NO. ${String(index + 1).padStart(2, '0')}`));
    const image = element('img', 'project-image');
    image.src = project.image;
    image.alt = project.imageAlt || project.title;
    image.width = 1000;
    image.height = 660;
    image.decoding = 'async';
    image.addEventListener('error', () => {
      image.hidden = true;
      cover.classList.add('image-unavailable');
    });
    cover.append(top, image, element('span', 'cover-caption', project.subtitle));
    const body = element('div', 'project-body');
    const titleRow = element('div', 'project-title-row');
    const title = element('h3', '', project.title);
    title.id = `title-${project.id}`;
    const arrow = element('span', 'card-arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    titleRow.append(title, arrow);
    const tags = element('ul', 'project-tags');
    for (const tag of project.tags || []) tags.append(element('li', '', tag));
    const bottom = element('div', 'card-bottom');
    bottom.append(element('span', '', project.note), element('span', 'card-action', `${project.action || '打开作品'} ↗`));
    body.append(titleRow, element('p', 'project-description', project.description), tags, bottom);
    link.append(cover, body);
    return link;
  }

  const cards = projects.map(createCard);
  grid.append(...cards);
  document.querySelector('#total-count').textContent = String(projects.length).padStart(2, '0');
  for (const badge of document.querySelectorAll('[data-count]')) {
    badge.textContent = projects.filter(p => badge.dataset.count === 'all' || p.category === badge.dataset.count).length;
  }

  function update() {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    projects.forEach((project, index) => {
      const searchable = [project.title, project.subtitle, project.description, categoryNames[project.category], ...(project.tags || [])].join(' ').toLocaleLowerCase();
      const matches = (category === 'all' || project.category === category) && searchable.includes(query);
      cards[index].hidden = !matches;
      if (matches) visible++;
    });
    for (const button of filters) {
      const active = button.dataset.filter === category;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    empty.hidden = visible > 0;
    grid.hidden = visible === 0;
    document.querySelector('#result-status').textContent = `找到 ${visible} 个作品`;
    document.querySelector('#empty-title').textContent = query ? '还没找到这个小灵感' : '这里还在酝酿中';
    document.querySelector('#empty-description').textContent = query ? '试试其他关键词，或者回到全部作品看看。' : '这个分类还没有作品，先看看其他作品吧。';
  }

  for (const button of filters) button.addEventListener('click', () => { category = button.dataset.filter; update(); });
  search.addEventListener('input', update);
  document.querySelector('#reset-filters').addEventListener('click', () => {
    category = 'all'; search.value = ''; update(); filters[0].focus();
  });
  document.addEventListener('keydown', event => {
    const target = event.target;
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing && !target.closest('input, textarea, select, [contenteditable]')) {
      event.preventDefault(); search.focus();
    }
  });
  const random = document.querySelector('#random-project');
  random.hidden = projects.length === 0;
  random.addEventListener('click', () => {
    if (projects.length) window.location.assign(projects[Math.floor(Math.random() * projects.length)].href);
  });
  document.querySelector('#collection-toolbar').hidden = false;
  update();
})();
