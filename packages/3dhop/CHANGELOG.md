# @ikaros-arch/3dhop

## 0.2.0

### Minor Changes

- [`d226c18`](https://github.com/ikaros-arch/react-3dhop/commit/d226c18e923626b8953279f138048a8febed782b) Thanks [@hallvard-indgjerd](https://github.com/hallvard-indgjerd)! - First release under the `@ikaros-arch` scope.

  - The vendored 3DHOP runtime is now its own package, `@ikaros-arch/3dhop`, and a peer dependency of
    `@ikaros-arch/react-3dhop`. The default `assetBaseUrl` is `/node_modules/@ikaros-arch/3dhop`; the
    7 MB sample model is no longer shipped, so `modelUrl`/`models` should always be supplied.
  - Packages ship an `exports` map, `sideEffects: false`, and accept React 17, 18 and 19.
  - Every vendored file that differs from upstream 3DHOP 4.3 carries a modification notice, and
    `PROVENANCE.md` states the licence of each file (GPL-3.0 / MIT / BSD-3-Clause).
