---
"@ikaros-arch/react-3dhop": minor
---

`<Annotations>` no longer forces a full `setScene` reload (re-streaming every mesh, and briefly narrowing or breaking trackball rotation while it does) for every change to its `annotations` prop.

Two separate problems contributed to this:

- A new array with the *same* content as before - the shape a consumer deriving `annotations` from broader app state inline in their render (e.g. `.map()`-ing a collection) produces on every unrelated re-render - used to be treated as a real change. The prop is now compared by content first, so an unrelated edit elsewhere in that state no longer reaches the presenter at all.
- A *genuine* change to an existing spot's colour, radius, or position - e.g. dragging a colour picker - used to rebuild the whole scene on every tick. 3DHOP reads a spot's colour/alpha/transform straight off its live scene object on every draw call rather than baking it in at `setScene` time, so this is now applied directly to the presenter's already-live spot and finished with a repaint; a full reload still happens exactly when it actually needs to (a spot is added or removed).

This also adds `updateSceneContribution` to `useThreeDHopViewer()`, used internally for the second fix above: it updates an already-registered scene contribution's record for whenever a *later* full rebuild happens for an unrelated reason, without forcing one now and without the disposer `registerSceneContribution` returns.
