import { useCallback, useEffect, useState } from 'react';
import { StoryMap } from '@story-map/react-story-map';
import type { StoryLocation, StorySlide } from '@story-map/story-map-core';
import { copy, initialLang, type Lang } from './i18n.js';
import { examples } from './stories.js';

const REPO = 'https://github.com/kywk/story-map';

const LINKS = {
  release: `${REPO}/releases/latest`,
  repo: REPO,
  spec: `${REPO}/blob/main/SPEC.md`,
  architecture: `${REPO}/blob/main/docs/architecture.md`,
  plugin: `${REPO}/blob/main/packages/obsidian-story-map/README.md`,
};

const documentSnippet = `---
story-map: true
---

\`\`\`story-map
schema: storymap/v1
title: Chile Trip
noteFolder: Travel/Chile/Places
order: asc
dateField: date-created
noteDisplay: link

map:
  center: [-33.4489, -70.6693]
  zoom: 6
  showPath: true
\`\`\``;

const noteSnippet = `---
story-map-note: true
title: Santiago
location: [-33.4489, -70.6693]
mapmarker: city
date-created: 2026-01-15
description: The journey begins here.
cover: ./assets/santiago.jpg
---`;

const npmSnippet = `npm install @story-map/story-map-core
npm install @story-map/react-story-map`;

const docusaurusSnippet = `remarkStoryMap({
  vaultRoot: 'vault',
  assetBase: '/story-map/',
  resolveNoteHref: (note) => routes[note],
})`;

interface HeroStop {
  index: number;
  location?: StoryLocation;
}

function Contours() {
  const rings = [0, 1, 2, 3, 4, 5];
  return (
    <svg className="topo" viewBox="0 0 620 620" aria-hidden="true" focusable="false">
      {rings.map((ring) => (
        <ellipse
          key={ring}
          cx={310 + ring * 5}
          cy={310 - ring * 4}
          rx={78 + ring * 46}
          ry={60 + ring * 40}
          transform={`rotate(${-14 + ring * 2.5} 310 310)`}
        />
      ))}
    </svg>
  );
}

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [exampleId, setExampleId] = useState('chile');
  const [heroStop, setHeroStop] = useState<HeroStop>({ index: 0 });

  const c = copy[lang];
  const heroStory = examples[0]!.story[lang];
  const current = examples.find((item) => item.id === exampleId) ?? examples[1]!;

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang === 'zh' ? 'zh-Hant' : 'en';
    root.dataset.lang = lang;
    document.title = c.meta.title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', c.meta.description);

    const url = new URL(window.location.href);
    url.searchParams.set('lang', lang);
    window.history.replaceState(null, '', url);
  }, [lang, c]);

  const handleHeroChange = useCallback((index: number, slide: StorySlide) => {
    setHeroStop({ index, ...(slide.location ? { location: slide.location } : {}) });
  }, []);

  const heroCoords = heroStop.location
    ? `${heroStop.location.lat.toFixed(4)}, ${heroStop.location.lng.toFixed(4)}`
    : '—';

  return (
    <>
      <a className="skip" href="#main">
        {lang === 'zh' ? '跳到主要內容' : 'Skip to content'}
      </a>

      <header className="nav">
        <div className="shell nav__inner">
          <a className="nav__brand" href="#top">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="26" height="26" />
            <span>Geo Story Map</span>
          </a>
          <nav className="nav__links" aria-label="Primary">
            <a href="#overview">{c.nav.overview}</a>
            <a href="#examples">{c.nav.examples}</a>
            <a href="#syntax">{c.nav.syntax}</a>
            <a href="#start">{c.nav.start}</a>
          </nav>
          <div className="nav__right">
            <div className="lang" role="group" aria-label={c.langLabel}>
              <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
                EN
              </button>
              <button type="button" aria-pressed={lang === 'zh'} onClick={() => setLang('zh')}>
                中文
              </button>
            </div>
            <a className="nav__gh" href={LINKS.repo}>
              {c.nav.github}
            </a>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="hero" id="top">
          <Contours />
          <div className="shell hero__inner">
            <div className="hero__copy">
              <p className="hero__schema reveal">
                <span className="dot" aria-hidden="true" />
                <code>{c.hero.schema}</code>
              </p>
              <h1 className="reveal">{c.hero.title}</h1>
              <p className="hero__lede reveal">{c.hero.lede}</p>
              <div className="hero__actions reveal">
                <a className="btn btn--primary" href={LINKS.release}>
                  {c.hero.ctaPlugin}
                </a>
                <a className="btn" href="#start">
                  {c.hero.ctaNpm}
                </a>
                <a className="btn btn--quiet" href={LINKS.spec}>
                  {c.hero.ctaSpec}
                </a>
              </div>
              <ul className="facts reveal">
                {c.hero.facts.map((fact) => (
                  <li key={fact.label}>
                    <strong>{fact.value}</strong>
                    <span>{fact.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="hero__visual reveal">
              <div className="frame">
                <div className="frame__bar">
                  <span className="frame__live">
                    <i aria-hidden="true" />
                    {c.hero.live}
                  </span>
                  <span className="frame__coords">{heroCoords}</span>
                </div>
                <div className="frame__map">
                  <StoryMap story={heroStory} onSlideChange={handleHeroChange} />
                </div>
                <p className="frame__hint">{c.hero.liveHint}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="band" id="overview">
          <div className="shell">
            <header className="section-head">
              <h2>{c.hosts.heading}</h2>
              <p className="section-lede">{c.hosts.lede}</p>
            </header>
            <ol className="flow" aria-label="Configuration flow">
              {c.hosts.flow.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="hosts">
              {c.hosts.items.map((item) => (
                <article className="host" key={item.name}>
                  <h3>{item.name}</h3>
                  <code className="host__pkg">{item.pkg}</code>
                  <p>{item.body}</p>
                  {item.note && <p className="host__note">{item.note}</p>}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="band band--tint" id="examples">
          <div className="shell">
            <header className="section-head">
              <h2>{c.examples.heading}</h2>
              <p className="section-lede">{c.examples.lede}</p>
            </header>
            <div className="examples">
              <div className="examples__list" role="tablist" aria-label={c.examples.switchLabel}>
                {examples.map((example) => {
                  const selected = example.id === current.id;
                  return (
                    <button
                      key={example.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      className={`example${selected ? ' is-active' : ''}`}
                      onClick={() => setExampleId(example.id)}
                    >
                      <span className="example__index">{example.index}</span>
                      <span className="example__text">
                        <span className="example__label">{example.label[lang]}</span>
                        <span className="example__region">{example.region[lang]}</span>
                        <span className="example__blurb">{example.blurb[lang]}</span>
                      </span>
                      <span className="example__count">
                        {example.story[lang].slides.length} {c.examples.slideCountLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="examples__map" role="tabpanel">
                <StoryMap key={`${current.id}-${lang}`} story={current.story[lang]} />
              </div>
            </div>
          </div>
        </section>

        <section className="band" id="syntax">
          <div className="shell">
            <header className="section-head">
              <h2>{c.syntax.heading}</h2>
              <p className="section-lede">{c.syntax.lede}</p>
            </header>
            <div className="syntax">
              <figure className="code">
                <figcaption>
                  <span>{c.syntax.document.label}</span>
                  <small>{c.syntax.document.caption}</small>
                </figcaption>
                <pre>
                  <code>{documentSnippet}</code>
                </pre>
              </figure>
              <figure className="code">
                <figcaption>
                  <span>{c.syntax.note.label}</span>
                  <small>{c.syntax.note.caption}</small>
                </figcaption>
                <pre>
                  <code>{noteSnippet}</code>
                </pre>
              </figure>
            </div>
            <ul className="syntax__points">
              {c.syntax.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="band band--tint" id="start">
          <div className="shell">
            <header className="section-head">
              <h2>{c.start.heading}</h2>
              <p className="section-lede">{c.start.lede}</p>
            </header>
            <div className="start">
              <div className="start__col">
                <h3>{c.start.obsidian.heading}</h3>
                <ol className="steps">
                  {c.start.obsidian.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
              <div className="start__col">
                <h3>{c.start.libraries.heading}</h3>
                <p className="start__body">{c.start.libraries.body}</p>
                <pre className="terminal">
                  <code>{npmSnippet}</code>
                </pre>
                <h3>{c.start.docusaurus.heading}</h3>
                <p className="start__body">{c.start.docusaurus.body}</p>
                <pre className="terminal">
                  <code>{docusaurusSnippet}</code>
                </pre>
              </div>
            </div>
            <nav className="links" aria-label="Resources">
              <a href={LINKS.spec}>{c.start.links.spec}</a>
              <a href={LINKS.architecture}>{c.start.links.architecture}</a>
              <a href={LINKS.plugin}>{c.start.links.plugin}</a>
              <a href={LINKS.repo}>{c.start.links.repository}</a>
            </nav>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="shell footer__inner">
          <p>{c.footer.line}</p>
          <p className="footer__meta">
            <span>{c.footer.license}</span>
            <a href={LINKS.repo}>github.com/kywk/story-map</a>
          </p>
        </div>
      </footer>
    </>
  );
}
