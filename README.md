# Sidebar Card (with UI Editor)

A Home Assistant Lovelace sidebar card based on [DBuit/sidebar-card](https://github.com/DBuit/sidebar-card), extended with a **visual UI editor** — no more manual YAML editing!

## Features

- All original sidebar-card features preserved
- Visual editor via the Home Assistant card editor (pencil icon)
- Configure title, clock, date, and bottom card through the UI
- YAML configuration still fully supported

## Installation

### Manual

1. Copy `dist/sidebar-card.js` to your HA `/config/www/` folder
2. Add the resource in Lovelace → Resources:
   ```
   /local/sidebar-card.js
   ```
3. Add to your `ui-lovelace.yaml`:
   ```yaml
   sidebar:
     title: My Home
     digitalClock: true
     date: true
   ```

### HACS

Add this repository as a custom repository in HACS.

## Configuration

All options from the original [sidebar-card](https://github.com/DBuit/sidebar-card) are supported.

### Visual Editor

Click the **pencil icon** on any sidebar card to open the visual UI editor:

- **Allgemein**: Title, digital/analog clock, date, layout options
- **Bottom Card**: Embed any Lovelace card at the bottom of the sidebar

### YAML Reference

```yaml
sidebar:
  title: "My Home"
  digitalClock: true
  digitalClockWithSeconds: false
  twelveHourVersion: false
  period: false
  clock: false
  date: true
  dateFormat: "DD MMMM"
  hideTopMenu: false
  hideHassSidebar: false
  showTopMenuOnMobile: false
  width: 25                    # or responsive: { mobile: 0, tablet: 20, desktop: 25 }
  breakpoints:
    mobile: 768
    tablet: 1024
  sidebarMenu:
    - name: Home
      action: navigate
      navigation_path: /lovelace/0
      icon: mdi:home
    - name: Lights
      action: navigate
      navigation_path: /lovelace/lights
      icon: mdi:lightbulb
  bottomCard:
    type: weather-forecast
    cardOptions:
      entity: weather.home
    cardStyle: |
      ha-card { background: transparent; }
```

## Development

```bash
npm install
npm run build        # production build → dist/sidebar-card.js
npm start            # watch mode
```

## Credits

- Original project: [DBuit/sidebar-card](https://github.com/DBuit/sidebar-card)
- UI Editor extension: [dgirod/sidebarcard](https://github.com/dgirod/sidebarcard)
