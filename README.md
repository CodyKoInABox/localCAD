# Platen

Platen is a local CAD program for designing 3D-printable machines: gears, shafts, fasteners, wheels, hulls, and the boards that drive them. It runs entirely in the browser. There is no server, no account, and no slicer. You export a solid and slice it in your usual tool.

Units are millimeters. Z is up, which is the print direction.

## Use it

Open the GitHub Pages site, or run it locally:

```bash
npm install
npm run dev
```

`npm run build` writes a static `dist/` folder. `npm run check` rebuilds every catalog part and the three starter kits and checks that each one is a solid with volume.

Projects autosave in this browser (IndexedDB). File → Save writes a `.platen.json` you can move between computers. File → Open reads it back. Nothing is uploaded.

## Starter kits

- **RC buggy** — chassis, pillow blocks, axles, four wheels, a 40T/16T mesh, N20 motor, steering servo, Nano, and a LiPo tray.
- **RC boat** — shelled planing hull, motor bulkhead, stern tube, prop shaft, propeller, rudder, servo, hatch, Nano, and pack.
- **Gearbox** — a case, two shafts, and a mated 36T/20T pair. Center distance is `module × (teeth + mate teeth) / 2`.

Parts in a kit stay editable. Change a tooth count or a bore and the solid rebuilds.

## Modeling

- Add parts from the library. Search for gear, shaft, M3, SG90, hull, bearing.
- The first selected solid is the base for **Subtract**. Select the plastic, then the bolt hole or heat-set cavity.
- **Mate** moves one part so a frame (a bore, a shaft end, a mounting hole) lands on another. Live mates keep driving that part until you drag it or release the mate.
- **Mirror**, **Line**, and **Circle** build patterns. Separate explodes them back into the original solids.
- **Overhang** tints faces steeper than the support angle, measured from the vertical build axis.
- **Drop to bed** puts the lowest point on z = 0.

Export STL (one file or a zip of parts), 3MF with one object per part, or OBJ.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` builds `dist/` and deploys it. In the repo settings, set Pages → Build and deployment → GitHub Actions. The site is static. The geometry kernel is a WebAssembly file served from the same origin.

## Shortcuts

| Key | Action |
| --- | --- |
| Q / W / E | Select / Move / Rotate |
| F | Fit |
| H | Hide |
| Arrows | Nudge 1 mm (Shift = 0.1 mm) |
| Delete | Delete selection |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Ctrl+D | Duplicate |
| Ctrl+S | Save project |

## Catalog

Primitives, involute spur / helical / herringbone / bevel / internal gears, racks, worms, GT2 and V pulleys, couplers, print-in-place universal joints and hinges, shafts (stepped, D, keyed, splined, grooved, threaded), metric screws, nuts, washers, heat-sets, bearings, Arduino Uno / Nano / Mega, ESP32 DevKit, SG90 and MG996 servos, N20 / 130 / 540-class motors, 28BYJ-48, 18650 holders, LiPo bricks, RC wheels, casters, omni wheels, planing and displacement hulls, rudders, propellers, stern tubes, chassis plates, gear cases, steering knuckles, and pillow blocks.

Solids are built with [Manifold](https://github.com/elalish/manifold), so booleans are watertight when they succeed.

## License

GPL-3.0-only. See `LICENSE`.
