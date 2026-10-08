import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { buildWipeoutMesh } from '../wipeoutGeometry';
import { warnUnknownGeometryVariant, __resetUnknownVariantWarnings } from '../CadRenderer';

describe('buildWipeoutMesh', () => {
  it('produces a Mesh for a quad of 4 vertices', () => {
    const obj = buildWipeoutMesh([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ]);
    expect(obj).toBeInstanceOf(THREE.Mesh);
  });

  it('uses an opaque MeshBasicMaterial (Wipeout masks underlying geometry)', () => {
    const mesh = buildWipeoutMesh([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect(mesh).not.toBeNull();
    const material = mesh!.material as THREE.MeshBasicMaterial;
    expect(material).toBeInstanceOf(THREE.MeshBasicMaterial);
    // Wipeout is opaque-mask by AutoCAD spec — transparent OFF.
    expect(material.transparent).toBe(false);
    expect(material.opacity).toBe(1);
  });

  it('places the mesh at a positive z so it occludes underlying entities', () => {
    const mesh = buildWipeoutMesh([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect(mesh).not.toBeNull();
    expect(mesh!.position.z).toBeGreaterThan(0);
  });

  it('builds a triangulated ShapeGeometry that bounds the input vertices', () => {
    const verts = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ];
    const mesh = buildWipeoutMesh(verts);
    expect(mesh).not.toBeNull();
    const box = new THREE.Box3().setFromObject(mesh!);
    expect(box.min.x).toBeCloseTo(0);
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.x).toBeCloseTo(4);
    expect(box.max.y).toBeCloseTo(3);
  });

  it('returns null for degenerate inputs (< 3 vertices)', () => {
    expect(buildWipeoutMesh([])).toBeNull();
    expect(buildWipeoutMesh([{ x: 0, y: 0 }])).toBeNull();
    expect(
      buildWipeoutMesh([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toBeNull();
  });
});

describe('warnUnknownGeometryVariant (S4-D telemetry)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    __resetUnknownVariantWarnings();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns once when the kernel emits a variant the renderer cannot draw', () => {
    warnUnknownGeometryVariant({ FutureWidget: { foo: 1 } });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const payload = warnSpy.mock.calls[0].join(' ');
    expect(payload).toContain('renderer.unknown_geometry_variant');
    expect(payload).toContain('FutureWidget');
  });

  it('stays silent on repeated occurrences of the same unknown variant', () => {
    for (let i = 0; i < 50; i++) {
      warnUnknownGeometryVariant({ FutureWidget: {} });
    }
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('warns once per distinct unknown variant', () => {
    warnUnknownGeometryVariant({ FutureWidget: {} });
    warnUnknownGeometryVariant({ AnotherWidget: {} });
    warnUnknownGeometryVariant({ FutureWidget: {} });
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('does not warn for variants the renderer is expected to handle', () => {
    // Sample of known variants from packages/kernel/src/entity.rs.
    warnUnknownGeometryVariant({ Line: {} });
    warnUnknownGeometryVariant({ Circle: {} });
    warnUnknownGeometryVariant({ Wipeout: {} });
    warnUnknownGeometryVariant({ Leader: {} });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('ignores empty geometry objects', () => {
    warnUnknownGeometryVariant({});
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
