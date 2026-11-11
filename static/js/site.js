(() => {
  // Mobile menu
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('open', !open);
    });
  }

  // Keep dates fresh without a rebuild: the page is built ahead of time,
  // so compare each event to the visitor's "today" and rearrange.
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const isPast = (el) => el.dataset.date < today;

  // Events page: move finished events into "Past events".
  const upcoming = document.getElementById('upcoming');
  const pastList = document.getElementById('past-list');
  if (upcoming && pastList) {
    [...upcoming.querySelectorAll('.event')].filter(isPast).forEach((el) => pastList.prepend(el));
    [...pastList.querySelectorAll('.event')].filter((el) => !isPast(el)).forEach((el) => upcoming.append(el));
    const sortByDate = (box) => [...box.children]
      .sort((a, b) => a.dataset.date.localeCompare(b.dataset.date))
      .forEach((el) => box.append(el));
    sortByDate(upcoming);
    document.getElementById('no-upcoming').hidden = upcoming.children.length > 0;
    document.getElementById('past').hidden = pastList.children.length === 0;
  }

  // Home page: show only the first event that hasn't happened yet.
  const cards = [...document.querySelectorAll('.next-card')];
  if (cards.length) {
    const first = cards.find((c) => !isPast(c));
    cards.forEach((c) => { c.hidden = c !== first; });
    const empty = document.getElementById('next-empty');
    if (empty) empty.hidden = Boolean(first);
  }
})();
