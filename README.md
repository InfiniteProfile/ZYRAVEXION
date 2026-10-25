# ZYRAVEXION

**ONE UNIVERSE. INFINITE IDENTITIES.**

ZYRAVEXION is a static, browser-only cosmic identity universe. It deterministically generates profile cards and abstract SVG avatars from positive decimal IDs, supports direct navigation to any ID, and loads the stream automatically as the visitor scrolls.

## Features

- Deterministic profile names, classifications, descriptions, traits, colors, and procedural SVG avatars.
- Positive decimal-string profile IDs, including very long IDs. The identity engine never converts profile IDs to JavaScript `Number`.
- Normalization of leading zeros (`00042` resolves to `42`) and rejection of zero, negative values, decimal points, and non-digits.
- Hash-based routes such as `#/profile/42`, compatible with GitHub Pages and other static hosts.
- Automatic forward loading with `IntersectionObserver`, a scroll-position fallback, a guarded load queue, and a retained window of rendered cards.
- Backward browsing of previously virtualized profile cards by regenerating the preceding IDs when the top spacer is approached.
- Search, random identity, previous/next navigation, copy ID, copy profile link, universe information, and appearance settings.
- Responsive layouts, a mobile navigation bar, keyboard-accessible controls, reduced-motion support, and visible search text/caret.
- No backend, database, API key, account, or profile-by-profile network requests.

## Files

```text
ZYRAVEXION/
├── index.html
├── style.css
├── script.js
└── README.md
```

## How deterministic profiles work

The normalized ID is kept as a decimal string and is the profile's exact identity key. A deterministic string hash produces seeds that select repeatable name parts, classifications, description phrases, colors, traits, and avatar geometry. The same normalized ID therefore renders the same profile data on every reload.

Decorative attributes and generated display names are selected from reusable combinations and may repeat across different IDs. The exact profile ID remains distinct and is displayed and used for routing, so identity uniqueness is based on the ID—not on a claim that every decorative field is collision-free.

## Arbitrary-length profile IDs

IDs are validated as decimal strings. Incrementing, decrementing, comparison, and leading-zero normalization are done with digit-by-digit string operations. `Number`, floating-point conversion, scientific notation, and `maxlength` are not used for profile IDs. The browser's actual memory/input limits still apply to physically enormous strings, but the application imposes no configured maximum digit count.

Examples to try in search:

- `1`
- `2048`
- `00000042` (normalizes to `42`)
- `999999999999999999999999999999999999999999999999999999`

## Infinite scrolling and memory

The feed generates another batch when the sentinel nears the viewport, with a scroll-position fallback in case observer callbacks are missed. A guarded queue avoids overlapping forward batches. Only a bounded window of profile-card chunks is kept in the DOM; older content is represented by a height spacer and can be regenerated while navigating back upward. The physical scroll spacer is periodically rebased during very long sessions to avoid growing the browser's document height without bound. As with all browser pages, available RAM and the browser's maximum physical scroll coordinate are finite, but there is no programmed profile count or end-of-feed state.

Profile generation is local; new cards do not require network calls. The page imports Google Fonts as an optional visual enhancement. If that external request is unavailable, system fonts are used instead and all core features remain local.

## Deploy to GitHub Pages

1. Create a repository named `ZYRAVEXION` (or use your preferred repository name).
2. Upload `index.html`, `style.css`, `script.js`, and `README.md` to the repository root.
3. Open **Settings → Pages** in the repository.
4. Choose **Deploy from a branch**, select the default branch and `/ (root)`, then save.
5. Open the published Pages URL. Hash routes such as `#/profile/123456` can be opened directly without server-side route configuration.

The folder name and repository name do not affect the code. Asset paths are relative.

## Customize the cosmic theme

Edit CSS variables at the top of `style.css`. The main palette is:

- Background: `#05040A`
- Secondary background: `#0B0914`
- Card: `#11101C`
- Violet: `#8B5CF6`
- Electric purple: `#A855F7`
- Cyan: `#22D3EE`
- Magenta: `#EC4899`
- Primary text: `#F5F3FF`
- Secondary text: `#A7A1B8`
- Border: `#29243A`

Edit the deterministic vocabulary arrays near the top of `script.js` to customize identity naming and descriptions. Keep the validation and decimal-string functions intact if arbitrary-length IDs are required.

## Testing checklist

Run the included browser app and check these cases:

1. Search for ID `1`, then ID `2`; verify their exact IDs and generated data appear.
2. Open the same ID twice and compare name, classification, and traits.
3. Search a very long ID and verify the exact digits remain in the route and detail view.
4. Search `00042` and confirm it resolves to profile `42`.
5. Try `0`, `-1`, `2.5`, and `abc`; each should produce a validation message while preserving the input.
6. Scroll down and confirm that batches appear automatically; scroll upward toward the top spacer to regenerate earlier cards.
7. Open a card, test previous/next, copy ID, copy link, browser Back, and the feed-return button.
8. Open search on a narrow phone viewport and verify input digits/caret are clearly visible.
9. Toggle Cosmic glow and Compact stream; settings are saved locally when browser storage is available.

The core identity arithmetic and routes can be tested in the browser console using `window.Zyravexion`, for example:

```js
Zyravexion.normalizeDecimal('00042')
Zyravexion.incrementDecimal('999999999999999999999999')
Zyravexion.decrementDecimal('1000000000000000000000000')
Zyravexion.generateProfile('999999999999999999999999999999999999999999').id
```

## Technical notes and limitations

- The displayed profile name is deterministic but is not guaranteed to be globally unique by itself; the exact normalized decimal ID is the unique identity key.
- A random identity uses a cryptographically sourced random digit sequence of a varied length. This is a practical sampler, not a uniform distribution over all positive integers.
- The default feed orders positive IDs in ascending order. Browser history and direct hash routes work without a server.
- Text, SVG, and CSS are self-contained. Google Fonts are optional and may be unavailable offline.
- No claim of testing on every Android device or hosting platform is made. Browser behavior and physical memory/scroll limits vary by device.
