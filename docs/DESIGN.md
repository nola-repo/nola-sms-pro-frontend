# Admin interface design context

## Product surface

The admin portal is an operational console for NOLA SMS Pro staff. Its job is to make account, message, credit, and platform state easy to scan and act on. The visual language should stay calm and instrument-like: clear hierarchy, compact data, restrained blue emphasis, and status colors used only for meaningful state.

## Existing visual system

- **Brand blue:** `#1751a5`; interactive and active blue: `#2b83fa`; gradient endpoint: `#1d6bd4`.
- **Light canvas and control fill:** `#f7f7f7`; white surface: `#ffffff`; primary text: `#111111`; secondary text: `#6e6e73`.
- **Dark surfaces:** page shell `#151515`, cards `#1a1b1e`, controls `#0d0e10`.
- **Status colors:** green for success, amber for degraded or incomplete data, red for unavailable or failed actions. Always pair color with text and an icon or other semantic cue.
- **Typography:** Poppins for interface text; use a monospace face for identifiers and machine-readable references.
- **Shape and density:** rounded cards and controls with subtle borders and shadows; favor compact, readable data over decorative space.
- **Icons:** React Icons, primarily Feather (`react-icons/fi`).

The admin palette is implemented in `admin/tailwind.config.cjs`, `admin/src/index.css`, and existing component utility classes. Preserve those roles when extending a screen; do not introduce a parallel palette for one feature.

## Data and feedback surfaces

Activity feeds and log tables use stable loading regions, explicit empty states, and inline notices. A green “healthy” state means the latest diagnostic request succeeded; amber means the diagnostic state is unavailable or incomplete; red means an actionable failure. Stale rows remain readable but must be labeled with their last successful load time.

Motion is limited to progress feedback and small state transitions. Respect reduced-motion preferences and do not animate status indicators continuously when they do not communicate changing information.
