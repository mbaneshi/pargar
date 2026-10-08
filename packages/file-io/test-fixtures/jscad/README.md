# jscad/sample-files DXF fixtures

These files are copied verbatim from the [jscad/sample-files](https://github.com/jscad/sample-files) repository, subdirectory `dxf/jscad/`. They are licensed MIT — see `LICENSE` in this directory.

## Provenance

| Field | Value |
|-------|-------|
| Upstream repo | [github.com/jscad/sample-files](https://github.com/jscad/sample-files) |
| Upstream commit | `f6f6485e7286a50c4c304d697be9cc9f7e64beb6` |
| Upstream commit date | 2021-10-06 |
| Upstream license | MIT (declared in `package.json`, license text reproduced in `LICENSE` here) |
| Imported on | 2026-04-30 |

## Files

| File | Source path | Notes |
|------|-------------|-------|
| `circle10.dxf` | `dxf/jscad/circle10.dxf` | Polyline approximation of a circle |
| `cube.dxf` | `dxf/jscad/cube.dxf` | 3D cube as DXF — exercises 3D coords on 2D-only round-trip |
| `pyramid.dxf` | `dxf/jscad/pyramid.dxf` | 3D pyramid as DXF |
| `square10x10.dxf` | `dxf/jscad/square10x10.dxf` | Plain 2D square |

## Why only files from `dxf/jscad/`?

The upstream repo also has `dxf/bourke/`, `dxf/autocad2017/`, `dxf/dxf-parser/`, and `dxf/ezdxf/` subdirectories. The README.md says MIT applies "(unless specified otherwise)", and those subdirs are sourced from third parties (Paul Bourke's CAD tutorials, Autodesk samples, the dxf-parser project, the ezdxf project) whose individual licenses have not been individually verified here. Only the `dxf/jscad/` subdirectory is imported until that verification is done.

## Updating these fixtures

1. Bump the upstream commit hash in this README.
2. Re-download the chosen files from the new commit.
3. Verify the upstream `package.json` still declares MIT.
4. Commit both the bump and the new bytes in one atomic commit.
