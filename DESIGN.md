# Lethabo, Your Legal Pal: design guide

This is how the app looks and why, so you can change it or extend it in the same style.
Everything lives in three files:

| File | What it holds |
|---|---|
| `.streamlit/config.toml` | The Streamlit theme: colours, fonts, corner radius. One light theme, pinned, so a visitor's dark mode never makes the text unreadable. |
| `style.css` | The design system: colour and spacing tokens, then every component. Loaded by `load_css()` in `app.py` on every run. |
| `static/` | The living layer (the sunbird companion and gold dust). `living-layer.js` is the shared kit, `lethabo-living.js` is this site's settings. |

## The idea: "Convergence"

The South African flag's Y means "different paths coming together into one road ahead".
That is also how Lethabo works: a crew of AI agents turns many sources into one plain answer.
So the welcome page redraws the Y in deep greens, and the road runs straight under the
visitor's question. Their question is where everything meets.

- **Welcome** (topic form, research wait, research error): one deep green "veld" field,
  the Y arms on wide screens, the road band behind the topic field, a gold button, the
  legal note, example topics, and the sunbird with gold dust.
- **Chat**: calm white paper for reading the law. A slim green masthead with a 3px gold
  rule (the road, condensed), gold "you" bubbles, Lethabo's green tile. No companion, no
  dust, no moving things.

### Colour roles

- **Gold** is warmth and the visitor's action: "Howzit!", the main button, send, your chat bubble, the research light.
- **Green** is Lethabo and trust.
- **Flag blue** marks links and the keyboard focus ring on white.
- **Red** only ever means an error.
- The full flag, the coat of arms and government marks are never used, so the app can't be mistaken for an official service.

## Tokens (top of `style.css`)

Change a colour or size here and it changes everywhere. The seven original brand
properties (`--sa-green`, `--sa-gold`, `--sa-black`, `--sa-red`, `--sa-blue`, `--sa-white`,
`--light-grey`) are kept exactly as they were.

| Token | Value | Used for |
|---|---|---|
| `--veld` | `#004C33` | Welcome page, header, chat masthead |
| `--veld-deep` | `#003624` | The Y's inner triangle, crew signposts, pause button |
| `--paper` | `#FFFFFF` | Chat page, topic field, chat dock |
| `--mist` | `#EFF5F0` | Soft text on green; table heads, quotes, code |
| `--ink` / `--ink-2` | `#0F1D16` / `#43554B` | Text and secondary text on white |
| `--green-700` | `#00653F` | The "Lethabo" name label, list numbers |
| `--gold` (= `--sa-gold`) | `#FFB612` | Actions and highlights. Never as text on white (too faint) |
| `--you` / `--you-edge` | `#FFF4D9` / `#F2D58A` | Your chat bubble |
| `--link` (= `--sa-blue`) | `#001489` | Links and the focus ring on white |
| `--alert-ink` / `--alert-wash` | `#A3231C` / `#FCEDEB` | Error cards |

Spacing uses a 4px base (`--s-1` 4px up to `--s-8` 64px). Radii: field 14px, error card 12px,
signpost 10px, buttons and pills fully round. Shadows always have an offset and a soft blur
(`--sh-field`, `--sh-cta`, `--sh-tile`, `--sh-dock`); nothing glows.

Every text colour pair is at least 4.5:1 contrast (gold on green is the lowest, 5.74:1).
Before adding a new pair, check it with any WCAG contrast checker.

## Fonts

| Role | Font | Where it's set |
|---|---|---|
| Titles, headings, "Howzit!", numbers | **Gabarito** 800 (700 for headings inside answers) | `headingFont` in `config.toml`; `--font-display` in CSS |
| Everything else | **Atkinson Hyperlegible Next**, a typeface designed to be easy to read for people with low vision | `font` in `config.toml`; `--font-text` in CSS |
| The eagle in the title | **Noto Emoji**, one glyph only, so it looks the same on every phone | the `@import` on the first line of `style.css` |

All three come from Google Fonts.

## Components

Every hook in `style.css` is either a Streamlit `data-testid` or a `.st-key-<key>` class,
which Streamlit adds to any container or widget you give a `key`. Never style the
`st-emotion-cache-...` classes: they change with every Streamlit release.

| Piece | In `app.py` | CSS hook |
|---|---|---|
| Welcome hero (green, roomy) | `st.container(key="hero")` | `.st-key-hero` |
| Chat masthead (slim green bar, gold rule) | the same container with `key="masthead"` | `.st-key-masthead` |
| Topic field on the road | `st.container(key="road")` around `st.text_input` | `.st-key-road` (the road and Y are its `::before` and `::after`) |
| Gold main button | `st.button(..., type="primary")` inside the hero | `.st-key-hero [data-testid="stBaseButton-primary"]` |
| Legal note | `st.container(key="guide_note")` + `st.caption` | `.st-key-guide_note` |
| Example topics | `st.pills(..., key="examples")` | `.st-key-examples` |
| Crew signposts | `st.container(key="crew")` with a numbered list | `.st-key-crew` |
| Sticky chat head | `st.container(key="chat_head", horizontal=True)` | the `stLayoutWrapper` around `.st-key-chat_head` |
| Messages, bubbles, lists, tables | `st.chat_message` + `st.markdown` | `[data-testid="stChatMessage"]` and friends |
| Chat dock and its legal note | `st.chat_input` | `[data-testid="stBottom"]` |

The legal note "Lethabo is a guide, not a substitute for a real lawyer." (Lethabo's own
words from `agents.py`) appears under the main button and under the chat input. Keep it
visible, full strength and never animated.

## Motion

All page motion is plain CSS, written inside `@media (prefers-reduced-motion: no-preference)`,
so a visitor who asks for less motion gets a still, complete page.

- **The signature moment:** when research starts, the four crew signposts stand up off the
  road in 3D (a `rotateX` turn hinged on their bottom edge, staggered by 90ms), the sunbird
  does one loop, and gold light flows along the road and the Y for exactly as long as the
  crew is working (it is tied to Streamlit's real spinner).
- **Errors:** the road and the Y lose their colour ("it didn't come together") and come back on retry.
- **Small things:** buttons change colour on hover and press down 1px; "Lethabo is thinking" shows three breathing gold dots.
- **Never:** entrance animations on load, hover lifts, or moving things in the chat.
  Streamlit reruns the whole script on every click, so load animations would replay.

## Adding a new page or section in this style

1. **A new state on the welcome screen** (for example a "how it works" note): put it inside
   `with hero:` in `app.py`, give its container a `key`, and space it with a `margin-top` rule
   in section 4 of `style.css`, like the other hero children. It sits on green automatically,
   and text inherits white.
2. **A new reading page** (Streamlit multipage, in a `pages/` folder): call
   `load_css("style.css")` at the top, start with `st.container(key="masthead")` holding the
   title, and put the content below it. It gets the paper ground, the green bar with the
   gold rule, and the reading styles.
3. **New colours or sizes:** add a token to `:root` first, then use the token. Check contrast.
4. **New rules** go in the matching numbered section of `style.css`. Motion goes only inside
   section 12 (no-preference), with a still fallback.
5. **Check it** at 390px and 1440px wide: no sideways scrolling, a visible focus ring on every
   control when you press Tab, and the legal note still in view.

## Living layer: the malachite sunbird

**Which character and why.** A malachite sunbird: a real South African bird, emerald green
with yellow chest tufts, so literally the flag's green and gold. It's quick and bright, it
rests by hovering, and Lethabo means "joy", which suits the voice ("Howzit!", "Okay, sharp!").
It reads as a friendly guide, not a mascot. Its green and gold keep it distinct from the
Intuthuko sunbird (Growth Green and Spark).

**Where it lives.** Only on the welcome view (the topic form, the research wait and the
research error). It flies in, keeps you company, and perches beside the title or beside
"Or try an example". It never rests on the field, the main button or the legal note. When
the chat opens it disappears completely (no bird, no dust, no pause button), and it flies in
again after "Start a New Topic". It does one celebratory loop when research starts, never on
errors.

**How it gets onto the page.** Streamlit doesn't let a page run its own scripts, so `app.py`
has a tiny hidden frame (`LIVING_LOADER`) that adds `static/living-layer.js` and
`static/lethabo-living.js` to the page once per visit. `enableStaticServing` in
`config.toml` serves those files. After changing that setting, restart the server.

**Changing its options.** Edit the `HOME` object at the top of `static/lethabo-living.js`:

| Option | Now | What it does |
|---|---|---|
| `character` | `'sunbird'` | Also: `butterfly`, `bee`, `swallow`, `falcon`, `firefly`, `spark`, or `'none'` for dust only |
| `colors` / `colorsOnDark` | SA green, malachite, gold | Its palette over white areas, and over the green page (the main look) |
| `size` | `52` | Wingspan in pixels on desktop; phones get 80% (`mobileScale`) |
| `perch` | the title and the "Or try an example" label | Where it may land (CSS selectors) |
| `dust` | gold, pale gold and white, `amount: 0.55` | Lower the amount for subtler dust, or set `dust: false` |
| `tilt` | the example pills | These lean toward the mouse in 3D |
| `magnetic` | "Explain This to Me!" | The button leans toward the mouse |
| `introDelay` | `1200` | Milliseconds before it flies in |
| `toggle` | bottom-left, "Moving effects" | The pause button. Below 1024px wide, `style.css` docks it in the left of the green header so it never covers a pill or the legal note |
| `storageKey` | `'lethabo-living'` | Remembers a visitor's pause choice |

Visitors can always stop the motion with the pause button, and anyone with "reduce motion"
switched on starts with it paused. Never edit `static/living-layer.js` itself: it's a shared
kit (v1.1.0), so updating it later is a plain file copy.

## Things to know

- Built and checked on Streamlit 1.66. `requirements.txt` doesn't pin Streamlit, so a new
  release could rename a `data-testid`; if something suddenly looks unstyled, check the hooks.
- `style.css` is read on every run, so edits show after a browser reload; `config.toml`
  theme edits also show on reload, but `[server]` settings need a server restart.
