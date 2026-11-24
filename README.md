# DeltaLabs website

A static, responsive product site built for GitHub Pages. No build tools, framework, paid services, or backend required.

## Preview locally

Run `python -m http.server 4173` from this folder and open `http://localhost:4173`.

## Update launch and contact links

Edit `config.js`:

```js
window.DELTALABS = {
  kickstarterUrl: '',
  contactEmail: '',
  updatesUrl: '',
  socials: { instagram: '', youtube: '', linkedin: '', x: '' }
};
```

Use full HTTPS URLs. Adding a Kickstarter URL updates the campaign buttons on all pages. An updates URL can connect an external mailing-list form before the campaign is live. Contact and social links appear only when configured. No email addresses are collected by this site, and there is no simulated signup form.

## Publish on GitHub Pages

Publish this folder as the repository root, push to `main`, and enable **Settings → Pages → Deploy from a branch → main / (root)**. `.nojekyll` makes this a plain static deployment. Paths are relative so it works under a project URL or a custom domain.

## Pages

- `index.html`: full-screen product film, brief customer benefits, wake light, travel, science, launch.
- `features.html`: interactive CAD mask with automatic rotation, pointer/touch dragging, keyboard controls, selectable parts, smooth separation and reassembly, and science links.
- `sleep.html`: visual circadian and sleep guide with expandable research explanations, grounded in GENED 1038 and original studies.
- `about.html`: the founders and development story.
- `science.html`: the longer course guide, study sources, and photo credits.

`styles.css`, `v4.css`, and `v5.css` hold shared layouts; `v6.css` supplies the current refinements. `features.js` uses self-hosted Three.js and `assets/mask.glb`. Feature changes return the selected component, reseat the cover, restore curvature, then flatten and clear a lane for the next component. Controls support drag, touch, arrow keys, and Home. Motion plays automatically when visible and honors system reduced-motion preferences. There are no pause buttons.

## Media

The opening film uses the supplied DeltaLabs Blender model: a dramatic moving light, slow flattening and deployment, a whole-board view of staged electrode and ear-flex folding, material close-ups, band closure, and seated magnet glints. Cuts join different views rather than reversing assembly immediately. A dimensioned magnet macro uses 2 mm discs and 2.25 mm bores. Fine grey-black foam and fabric grain are visualizations of intended materials; the original face cushion silhouette is retained. The charging scene places the mask logo-side down on a large pad, with its sides folded upward and a smooth, repeating indicator pulse.

The wake film completes reassembly and bending before slowly raising the diffuser light. The interactive light feature likewise stays dark through reassembly, then ramps its light over 2.4 seconds. Timing and shot details are recorded in `assets/animation-checks.json`.

`signals.js` (home) and `model-network.js` (features) play real recordings from `sleep-data.js`, 30 seconds at a time: EEG (Fpz-Cz) and horizontal eye movement from one hour of a held-out Sleep-EDF night, with the prototype model's own activations, stage probabilities and the human scorer's labels, plus a separate public head-worn accelerometer recording (RealWorld HAR 2016). None of it was recorded with the mask, and the accelerometer is not from the same night; the sources are credited in `science.html`. Playback runs a few consecutive epochs, then skips to another part of the hour so every stage appears, including epochs the model gets wrong. On the home panel each epoch is read, the model's estimate appears, then the human scorer's label is revealed with a match or miss badge. Reduced-motion shows a still epoch. The features panel is the "Network flow" view from `cnn-visualization` in [deltalabs-sleep](https://github.com/24mjihad/deltalabs-sleep/tree/CNNVISUALIZATION), with each layer's output size and parameter count above its column (26,693 total). Rebuild the data with `python tools/build-sleep-data.py <cnn-visualization/data.js> <accel-visualizer/web/data/lying_down.csv> sleep-data.js`.

The native films and explorer use a single canonical board. Electrode roots rise before insertion, tips fold after seating, and ear sections return around the padding. The explorer retains 180 rigid surface-mount component mounts; chip locations and orientations follow the board tangent frame without independent flights or random rotations. Detailed native plating is simplified in the browser model. Fabric and foam grain use fixed rest-surface coordinates rather than moving world coordinates.

Original wordmark and shorthand retain their white/teal brand colors and internal over/under crossings. The WebGL model uses authored assembled-to-flat morphs, corrected morph normals, simplified rough materials, and separate frame and cover geometry.

Nature, wildlife, and NASA photographs have attribution, source links, usage terms, and modifications documented in `science.html` and `assets/media-credits.json`. Photos illustrate the species and environments, not the experiments. Founder portraits come from the supplied pitch deck. Manrope is loaded from Google Fonts with local Arial/Helvetica fallbacks.

The site has no analytics, tracking cookies, payments, signup database, or data collection. Launch and social channels stay unconfigured until confirmed. The copy distinguishes planned features from validated outcomes and keeps the retail price as a target.

See `DESIGN-NOTES.md` for the reviewed startup references, product hierarchy, and animation decisions.
