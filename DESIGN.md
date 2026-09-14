# PawSpace design rules

The source of truth for how screens look. Based on the Figma (`Screens.svg`) plus changes
agreed since. Sizes are in points on a 393pt-wide phone. Tokens live in `src/theme.ts`;
shared pieces in `src/components/kit.tsx`.

## Colour

| Token | Hex | Use |
|---|---|---|
| `orange` | `#FBAB4B` | Primary buttons, selected tabs, orange headers, nav handle |
| `orangeLight` | `#FFD2A3` | Selected segment/chip, breed pill, cards |
| `orangeDeep` | `#BF3D05` | Paw logo, account-screen titles, text links, progress fill |
| `bg` | `#FFFFFF` | Panels and cards |
| `bg2` / `track` | `#EFEFEF` | Grey screen background, unselected segments/chips |
| `peach` | `#FFE7CE` | "Has your living situation changed?" card |
| `danger` | `#FF7B7B` | Delete All Data |
| `text` | `#241E18` | All body text and icons |

## Type

Fonts: **Mojiw Mochizuki** for the "PawSpace" wordmark and the Welcome headline only;
**Goga** for everything else.

| Role | Size / line height | Weight |
|---|---|---|
| Screen heading (e.g. "Capture your space") | 20 | Bold |
| Screen subtitle (under the heading) | 15 / 21 | Regular |
| Section title (e.g. "Create new space") | 16 | Semibold |
| **Any question or field label** ("Dwelling Type", "Email Address", "Space Label:") | 13–16 | **Semibold** |
| Home greeting ("Hi Emily,") | 24 | Semibold |
| Body / helper text | 12.5–15 | Regular |
| **All buttons** | 15 (smaller buttons may use 12.5) | **Semibold** |
| Text links ("Go Home Instead", "Forgot password?") | 12 | Regular / Medium |

## Layout

- Side margins: 22pt on grey screens, 29pt on Home.
- Grey-screen header (`TopBar`): paw tile top-left with the back arrow under it; close ×
  or avatar on the right.
- **Heading spacing:** leave 14pt between the back arrow and the screen heading, and 6pt
  between heading and subtitle.
- Home: 24pt of space above the first section title inside the white panel.
- Corner radius: panels 20, photo cards 12, buttons 12, pills 10.
- Bottom nav: orange handle bar; swipe/tap up for the three round buttons (open by
  default on Home).

## Buttons

- **Every action button is 48pt tall** (radius 12), including joined pairs and sheet buttons.
- Primary: orange fill, dark text, **semibold**. Stacked buttons have 16–20pt between them.
- Joined pair (`JoinedButtons`): neutral left half + orange right half in one pill,
  both labels **semibold**.
- Account screens (Sign Up / Log In): orange fill, white semibold text.

## Content

- Dogs only. Never show a numeric score — use the words Poor / Adequate / Good, or
  Cramped / Snug / Spacious and Hazardous / Mostly safe / Safe.
- The dog avatar speaks in first person ("I need space to run!").
