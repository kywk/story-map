import { useCallback, useEffect, useState } from 'react';
import { StoryMap } from '@story-map/react-story-map';
import type { StoryLocation, StorySlide, StoryMapTheme, StoryMapLayoutMode } from '@story-map/story-map-core';
import { copy, guideCopy, initialLang, type Lang } from './i18n.js';
import { examples } from './stories.js';

const REPO = 'https://github.com/kywk/story-map';

const LINKS = {
  community: 'https://community.obsidian.md/plugins/geo-story-map',
  repo: REPO,
  spec: `${REPO}/blob/main/SPEC.md`,
  architecture: `${REPO}/blob/main/docs/architecture.md`,
  plugin: `${REPO}/blob/main/packages/obsidian-story-map/README.md`,
  react: `${REPO}/blob/main/packages/react-story-map/README.md`,
  remark: `${REPO}/blob/main/packages/remark-story-map/README.md`,
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
includeTags: [travel, chile]
excludeTags: [draft]

map:
  theme: vintage
  center: [-33.4489, -70.6693]
  zoom: 6
  showPath: true
layout:
  mode: card
  card:
    align: left
\`\`\``;

const noteSnippet = `---
story-map-note: true
title: Santiago
location: [-33.4489, -70.6693]
mapmarker: city
date-created: 2026-01-15
tags: [travel, chile]
description: The journey begins here.
cover: ./assets/santiago.jpg
---`;

const npmSnippet = `npm install @story-map/react-story-map \\
  react@^19 react-dom@^19 leaflet@^1.9.4`;

const reactSnippet = `import { StoryMap } from '@story-map/react-story-map';
import 'leaflet/dist/leaflet.css';
import '@story-map/react-story-map/styles.css';

// story: resolved StoryMapConfig
<StoryMap story={story} />`;

const docusaurusSnippet = `npm install @story-map/remark-story-map`;

function Arrow() {
  return <svg className="link-arrow" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10" stroke="currentColor" strokeWidth="1.5" /></svg>;
}

function CopyButton({ text, lang }: { text: string; lang: Lang }) {
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');
  useEffect(() => { setStatus('idle'); }, [text, lang]);
  useEffect(() => {
    if (status === 'idle') return;
    const timer = window.setTimeout(() => setStatus('idle'), 3000);
    return () => window.clearTimeout(timer);
  }, [status]);
  return <button className="copy-button" type="button" onClick={async () => {
    try { await navigator.clipboard.writeText(text); setStatus('done'); }
    catch { setStatus('error'); }
  }}><span aria-live="polite">{guideCopy[lang].clipboard[status]}</span></button>;
}

interface HeroStop {
  index: number;
  location?: StoryLocation;
}

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [exampleId, setExampleId] = useState('chile');
  const [theme, setTheme] = useState<StoryMapTheme>('light');
  const [layoutMode, setLayoutMode] = useState<StoryMapLayoutMode>('card');
  const [cardAlign, setCardAlign] = useState<'left' | 'center' | 'right'>('left');
  const [fullSide, setFullSide] = useState<'left' | 'right'>('left');
  const [cardWidth, setCardWidth] = useState<number | undefined>();
  const [cardHeight, setCardHeight] = useState<number | undefined>();
  const [contentRatio, setContentRatio] = useState(0.5);
  const [heroStop, setHeroStop] = useState<HeroStop>({ index: 0 });

  const c = copy[lang];
  const g = guideCopy[lang];
  const heroStory = examples[2]!.story[lang];
  const current = examples.find((item) => item.id === exampleId) ?? examples[1]!;
  const exampleStory = {
    ...current.story[lang],
    map: { ...current.story[lang].map, theme },
    layout: {
      mode: layoutMode,
      card: { align: cardAlign, ...(cardWidth === undefined ? {} : { widthRatio: cardWidth }), ...(cardHeight === undefined ? {} : { heightRatio: cardHeight }) },
      full: { side: fullSide, contentRatio },
    },
  } satisfies typeof current.story.en;

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
          <nav className="nav__links" aria-label={g.primaryNav}>
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
                繁中
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
          <div className="shell hero__inner">
            <div className="hero__copy">
              <h1>{g.headline}<em>{g.headlineEnd}</em></h1>
              <div className="hero__intro">
                <p className="hero__lede">{c.hero.lede}</p>
                <div className="hero__actions">
                  <a className="btn btn--primary" href="#examples">{g.tryDemo}<Arrow /></a>
                  <a className="text-link" href="#start">{c.hero.ctaPlugin}</a>
                </div>
              </div>
            </div>
            <div className="hero__visual">
              <div className="frame">
                <div className="frame__bar">
                  <span className="frame__live">
                    {c.hero.live} · {g.demoLabel}
                  </span>
                  <span className="frame__coords">{heroStop.index + 1} / {heroStory.slides.length} · {heroCoords}</span>
                </div>
                <div className="frame__map">
                  <StoryMap story={heroStory} onSlideChange={handleHeroChange} />
                </div>
                <p className="frame__hint"><span>{c.hero.liveHint}</span><span>{g.sourceOwned}</span></p>
              </div>
            </div>
          </div>
        </section>

        <section className="band" id="overview">
          <div className="shell feature-layout">
            <header className="section-head">
              <h2>{g.featuresHeading}</h2>
              <p className="section-lede">{g.featuresLede}</p>
              <a className="text-link" href={LINKS.plugin}>{c.start.links.plugin} <Arrow /></a>
            </header>
            <div className="features">
              {g.features.map((item) => <article className="feature" key={item.title}>
                <h3>{item.title}</h3><p>{item.body}</p>
              </article>)}
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
              <div className="examples__list" role="group" aria-label={c.examples.switchLabel}>
                {examples.map((example) => {
                  const selected = example.id === current.id;
                  return (
                    <button
                      key={example.id}
                      type="button"
                      aria-pressed={selected}
                      aria-controls="example-preview"
                      className={`example${selected ? ' is-active' : ''}`}
                      onClick={() => setExampleId(example.id)}
                    >
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
              <div className="examples__map" id="example-preview" role="region" aria-label={`${c.examples.switchLabel}: ${current.label[lang]}`}>
                <div className="theme-playground" aria-label={lang === 'zh' ? '地圖主題與版型' : 'Map theme and layout'}>
                  <label>{lang === 'zh' ? '主題' : 'Theme'}
                    <select value={theme} onChange={(event) => setTheme(event.target.value as StoryMapTheme)}>
                      {(['auto', 'light', 'dark', 'vintage', 'cyber', 'atlas'] as const).map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label>{lang === 'zh' ? '版型' : 'Layout'}
                    <select value={layoutMode} onChange={(event) => setLayoutMode(event.target.value as StoryMapLayoutMode)}>
                      <option value="card">card</option><option value="full">full</option><option value="timeline">timeline</option>
                    </select>
                  </label>
                  {layoutMode === 'card' ? (
                    <>
                      <label>{lang === 'zh' ? '卡片對齊' : 'Card align'}
                        <select value={cardAlign} onChange={(event) => setCardAlign(event.target.value as typeof cardAlign)}>
                          <option value="left">left</option><option value="center">center</option><option value="right">right</option>
                        </select>
                      </label>
                      <label>{lang === 'zh' ? '寬度' : 'Width'}
                        <select value={cardWidth ?? ''} onChange={(event) => setCardWidth(event.target.value ? Number(event.target.value) : undefined)}>
                          <option value="">auto</option><option value="0.35">35%</option><option value="0.55">55%</option><option value="0.75">75%</option>
                        </select>
                      </label>
                      <label>{lang === 'zh' ? '高度' : 'Height'}
                        <select value={cardHeight ?? ''} onChange={(event) => setCardHeight(event.target.value ? Number(event.target.value) : undefined)}>
                          <option value="">auto</option><option value="0.55">55%</option><option value="0.72">72%</option><option value="0.9">90%</option>
                        </select>
                      </label>
                    </>
                  ) : (
                    <>
                      <label>{lang === 'zh' ? '內容位置' : 'Content side'}
                        <select value={fullSide} onChange={(event) => setFullSide(event.target.value as typeof fullSide)}>
                          <option value="left">left</option><option value="right">right</option>
                        </select>
                      </label>
                      <label>{lang === 'zh' ? '內容比例' : 'Content ratio'}
                        <select value={contentRatio} onChange={(event) => setContentRatio(Number(event.target.value))}>
                          <option value="0.35">35%</option><option value="0.5">50%</option><option value="0.65">65%</option>
                        </select>
                      </label>
                    </>
                  )}
                </div>
                <p className="demo-note">{g.demoNote}</p>
                <div className="examples__canvas">
                  <StoryMap key={`${current.id}-${lang}`} story={exampleStory} />
                </div>
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
                  <small>{c.syntax.document.caption}</small><CopyButton text={documentSnippet} lang={lang} />
                </figcaption>
                <pre>
                  <code>{documentSnippet}</code>
                </pre>
              </figure>
              <figure className="code">
                <figcaption>
                  <span>{c.syntax.note.label}</span>
                  <small>{c.syntax.note.caption}</small><CopyButton text={noteSnippet} lang={lang} />
                </figcaption>
                <pre>
                  <code>{noteSnippet}</code>
                </pre>
              </figure>
            </div>
            <div className="settings-reference">
              <h3>{g.settingsHeading}</h3>
              <p>{g.precedence}</p>
              <p className="table-hint">{g.tableHint}</p>
              <div className="table-scroll" role="region" aria-label={g.settingsHeading} tabIndex={0}>
                <table><thead><tr>{g.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
                  <tbody>{g.settings.map(([key, value, meaning]) => <tr key={key}><th scope="row"><code>{key}</code></th><td><code>{value}</code></td><td>{meaning}</td></tr>)}</tbody>
                </table>
              </div>
              <p className="settings-note">{g.documentOnly}</p>
            </div>

          </div>
        </section>

        <section className="band band--dark" id="start">
          <div className="shell">
            <header className="section-head">
              <h2>{c.start.heading}</h2>
              <p className="section-lede">{c.start.lede}</p>
            </header>
            <div className="host-summary">
              {c.hosts.items.map((item) => <div key={item.name}><h3>{item.name}</h3><p>{item.body}</p><small>{item.note}</small></div>)}
            </div>
            <div className="start">
              <div className="start__col">
                <h3>{c.start.obsidian.heading}</h3>
                <ol className="steps">
                  {c.start.obsidian.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <a className="btn btn--primary" href={LINKS.community}>{g.download}</a>
              </div>
              <div className="start__col">
                <h3>{c.start.libraries.heading}</h3>
                <p className="start__body">{c.start.libraries.body}</p>
                <pre className="terminal">
                  <code>{npmSnippet}</code>
                </pre>
                <pre className="terminal"><code>{reactSnippet}</code></pre>
                <a className="text-link" href={LINKS.react}>{g.reactGuide} <Arrow /></a>
                <h3>{c.start.docusaurus.heading}</h3>
                <p className="start__body">{c.start.docusaurus.body}</p>
                <pre className="terminal">
                  <code>{docusaurusSnippet}</code>
                </pre>
                <a className="text-link" href={LINKS.remark}>{g.remarkGuide} <Arrow /></a>
              </div>
            </div>
            <nav className="links" aria-label={g.resources}>
              <a href={LINKS.spec}>{c.start.links.spec}</a>
              <a href={LINKS.architecture}>{c.start.links.architecture}</a>
              <a href={LINKS.plugin}>{c.start.links.plugin}</a>
              <a href={LINKS.repo}>{c.start.links.repository}</a>
            </nav>
          </div>
        </section>
        <section className="band faq" id="questions">
          <div className="shell feature-layout">
            <header className="section-head"><h2>{g.faqHeading}</h2><p className="section-lede">{g.faqLede}</p></header>
            <div>{g.faq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
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
