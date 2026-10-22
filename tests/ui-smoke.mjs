// Run against the local HTTP app using the connected browser's tab handle.
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function checkHome(tab) {
  const home = await tab.playwright.evaluate(() => {
    const input = document.querySelector('#home-directory-query');
    const image = document.querySelector('.home-hero-image');
    const caption = document.querySelector('.home-hero h1');
    const headerBottom = document.querySelector('.app-header').getBoundingClientRect().bottom;
    const inputBounds = input?.getBoundingClientRect();
    return {
      search: Boolean(input),
      searchVisible: Boolean(inputBounds && inputBounds.top >= headerBottom && inputBounds.bottom < innerHeight),
      photo: Boolean(image && image.complete && image.naturalWidth > 0),
      caption: Boolean(caption && caption.textContent.trim()),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      letterSpacing: caption && getComputedStyle(caption).letterSpacing
    };
  });
  assert(home.search, 'Home must expose direct directory search');
  assert(home.searchVisible, 'Home search must fit in the first viewport');
  assert(home.photo, 'Home must render an actual loaded hotel photo');
  assert(home.caption, 'The hotel photo must have a visible hotel name');
  assert(!home.overflow, 'Home must not overflow horizontally');
  assert(['normal', '0px'].includes(home.letterSpacing), 'Heading tracking must be zero');
  return home;
}

export async function checkDirectorySearch(tab) {
  await tab.playwright.locator('#home-directory-query').fill('上海');
  await tab.playwright.locator('#home-directory-search button[type="submit"]').click();
  const directory = await tab.playwright.evaluate(() => ({
    query: document.querySelector('#directory-query-input')?.value,
    cards: document.querySelectorAll('.directory-entry').length,
    matching: Array.from(document.querySelectorAll('.directory-entry-head h2')).every(
      (heading) => heading.textContent.includes('上海')
    ),
    overflow: document.documentElement.scrollWidth > innerWidth + 1
  }));
  assert(directory.query === '上海', 'Search must preserve the city query');
  assert(directory.cards > 0 && directory.matching, 'Search must return matching hotels');
  assert(!directory.overflow, 'Directory must not overflow horizontally');
  return directory;
}

export async function checkLayout(tab) {
  const layout = await tab.playwright.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const bounds = nav.getBoundingClientRect();
    return {
      route: document.querySelector('main').dataset.route,
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      navigationVisible: bounds.top >= 0 && bounds.bottom <= innerHeight + 1,
      brokenImages: Array.from(document.querySelectorAll('img')).filter(
        (img) => img.complete && !img.naturalWidth && !img.hidden
      ).map((img) => img.alt)
    };
  });
  assert(!layout.overflow, `${layout.route}: horizontal overflow`);
  assert(layout.navigationVisible, `${layout.route}: navigation must remain visible`);
  assert(layout.brokenImages.length === 0, `${layout.route}: broken photos`);
  return layout;
}
