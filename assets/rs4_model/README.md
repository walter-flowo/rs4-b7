# RS4 3D model slot

Drop a licence-clean glTF binary named `rs4.glb` into this folder and the
360° tab picks it up automatically (no rebuild needed).

- The viewer recolours the body-paint material(s) to the paint selected in
  The Legend tab. Materials named like `paint`, `body`, `exterior`, `shell`
  or `lack` are matched first.
- Attribution: edit the one-line inline assignment in `site/index.html` —
  `window.RS4_MODEL_CREDIT = "";` — with the required CC credit line. It is
  rendered beneath the viewer.
- The viewer needs HTTP, not file:// (ES module). Run `site/serve.sh` and
  open http://localhost:8437/
