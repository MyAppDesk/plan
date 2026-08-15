# Measure — Floor Plan Studio

Draw a flat to scale in the browser, measure every room, hang doors and windows on the walls, drop in
furniture, then look at it in 3D and walk through it at eye height.

Everything runs client-side. Your plan is saved in the browser and can be exported as JSON or PNG.

## Features

- **Rooms (estancias)** — rectangular rooms by dragging, or free polygons corner by corner. Each room has a
  name, colour, its own ceiling height, and live area / perimeter / volume figures.
- **Walls** — every edge is a real wall with its own thickness and height. Type an exact length and the wall
  resizes. Corners weld together, so neighbouring rooms share a single wall. Double-click a wall to drop a
  corner on it and bend the run around a column or a recess.
- **Extrude** — Shift-drag any wall face to pull it out (or push it in). The wall becomes three, the room
  outline follows, and openings travel with the face. Split a wall twice first and extrude the middle piece to
  get a column or a niche.
- **Partial walls** — every wall has a base height and a height, so it can be a full partition, a terrace
  parapet or a kerb (dashed on the plan), or a beam / boxing hanging from the ceiling that you walk under
  (dotted on the plan). One-click presets for each.
- **Columns & piers** — free-standing square or round structure with its own footprint, base and height:
  load-bearing pillars, plinths, or boxing over a duct. They block you in walk mode when they reach the floor,
  and let you pass when they only hang from the ceiling.
- **Resize grips** — the usual eight handles around the selection: drag to resize a room's outline or a piece
  of furniture, anchored on the opposite side.
- **Wall snapping** — furniture lands against the *face* of a wall (its thickness is respected, so nothing
  ends up buried inside it) and lines up with the wall when it is roughly parallel. Optional, toggled with
  `H`.
- **Doors & windows** — click a wall to place one, drag it along the wall, then set width, height, sill
  height, hinge side and swing direction. Openings are cut out of the 3D walls.
- **Furniture** — a catalogue of beds, wardrobes, sofas, kitchen units, sanitary ware, desks, stairs and more.
  Every piece is generated from its width / depth / height, so any size you type is correct in both 2D and 3D.
  No external assets to download.
- **Tape measure** — measure any two points on the plan.
- **Sample flat** — ships with a small flat: terrace with a parapet and two round columns, a half wall
  screening the shower, a beam across the living room and a service duct (Settings → Reset to sample flat).
- **Multiple floors** — add or duplicate floors, each with its own elevation and ceiling height.
- **3D preview** — orbit around the model with real doors, glazed windows, shadows and optional ceilings.
- **Walk simulation** — first-person mouse-look with WASD, run, crouch, and collision against walls. You can
  walk through doorways; window sills stop you.
- **Undo / redo**, grid snapping, alignment guides, autosave, JSON import/export, PNG export.

## Keyboard

| Key | Action |
| --- | --- |
| `1` `2` `3` | Plan · 3D · Walk |
| `V` `R` `P` `W` | Select · Rectangular room · Polygon room · Wall |
| `D` `N` `K` | Door · Window · Column |
| `I` `M` `X` | Furniture · Tape measure · Delete |
| `F` `G` `H` | Zoom to fit · Grid snapping · Snap furniture to walls |
| `Ctrl/⌘ Z` | Undo (add `Shift` to redo) |
| `Del` `C` | Delete / duplicate the selection |
| `Shift` | Constrain to horizontal / vertical while drawing |
| `Space` + drag | Pan with any tool |

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build
```

## Deployment

Pushing to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`
(Settings → Pages → Source: **GitHub Actions**). The Vite `base` is relative, so the build also works from any
sub-path or static host.

## Stack

React 19 + TypeScript + Vite, Zustand (with zundo for history), react-konva for the 2D plan,
react-three-fiber / three.js for the 3D view and walkthrough, Tailwind CSS v4, lucide icons.
