---
"@ikaros-arch/react-3dhop": minor
---

Added `getAnnotationScreenPosition(presenter, id)`, which projects an already-registered spot's 3D position onto the canvas in CSS pixels, with a `visible` flag for when the point is behind the camera or outside the current view frustum. Call it again from a `registerTrackballObserver` callback to keep a UI element (e.g. a popup) glued to a spot as the camera orbits/pans/zooms.

Fixed `<Annotations>` forwarding a stale `annotation` on `onAnnotationPick` after a property-only edit (e.g. retyping a spot's label, or a colour/radius change) that hadn't gone through a full scene rebuild since the last pick. The presenter lifecycle fills in `event.annotation` from its own `annotationDefinitionsRef`, which - like the scene contribution it patches in place - is only refreshed by a real `setScene`; picks now resolve the annotation from this component's own (always current) data instead.
