<script lang="ts">
  import { getContext } from 'svelte';
  import type { AppState } from '$lib/stores/AppState.svelte';
  import type { Entity } from '$lib/types/kernel';

  const app = getContext<AppState>('app');

  let { entity, layers, onUpdate, onChangeLayer, onCollapse } = $props<{
    entity: Entity | null;
    layers: string[];
    onUpdate: (id: string, geometryJson: string) => void;
    onChangeLayer: (entityId: string, layerId: string) => void;
    onCollapse?: () => void;
  }>();

  let generalOpen = $state(true);
  let geometryOpen = $state(true);

  let editValues = $state<Record<string, string>>({});

  function getEntityType(ent: Entity): string {
    return Object.keys(ent.geometry)[0];
  }

  function getGeom(ent: Entity): Record<string, unknown> {
    const type = getEntityType(ent);
    return (ent.geometry as Record<string, Record<string, unknown>>)[type];
  }

  function initEditValues(ent: Entity) {
    if (!ent) return;
    const type = getEntityType(ent);
    const g = getGeom(ent);
    const vals: Record<string, string> = {};

    if (type === 'Line') {
      vals['start_x'] = g.start.x.toFixed(4);
      vals['start_y'] = g.start.y.toFixed(4);
      vals['end_x'] = g.end.x.toFixed(4);
      vals['end_y'] = g.end.y.toFixed(4);
    } else if (type === 'Circle') {
      vals['center_x'] = g.center.x.toFixed(4);
      vals['center_y'] = g.center.y.toFixed(4);
      vals['radius'] = g.radius.toFixed(4);
    } else if (type === 'Arc') {
      vals['center_x'] = g.center.x.toFixed(4);
      vals['center_y'] = g.center.y.toFixed(4);
      vals['radius'] = g.radius.toFixed(4);
      vals['start_angle'] = ((g.start_angle * 180) / Math.PI).toFixed(2);
      vals['end_angle'] = ((g.end_angle * 180) / Math.PI).toFixed(2);
    } else if (type === 'Rectangle') {
      vals['origin_x'] = g.origin.x.toFixed(4);
      vals['origin_y'] = g.origin.y.toFixed(4);
      vals['width'] = g.width.toFixed(4);
      vals['height'] = g.height.toFixed(4);
      vals['rotation'] = ((g.rotation * 180) / Math.PI).toFixed(2);
    } else if (type === 'Text') {
      vals['position_x'] = g.position.x.toFixed(4);
      vals['position_y'] = g.position.y.toFixed(4);
      vals['content'] = g.content;
      vals['height'] = g.height.toFixed(4);
      vals['rotation'] = ((g.rotation * 180) / Math.PI).toFixed(2);
    } else if (type === 'Ellipse') {
      vals['center_x'] = g.center.x.toFixed(4);
      vals['center_y'] = g.center.y.toFixed(4);
      vals['semi_major'] = g.semi_major.toFixed(4);
      vals['semi_minor'] = g.semi_minor.toFixed(4);
      vals['rotation'] = ((g.rotation * 180) / Math.PI).toFixed(2);
    } else if (type === 'Dimension') {
      vals['start_x'] = g.start.x.toFixed(4);
      vals['start_y'] = g.start.y.toFixed(4);
      vals['end_x'] = g.end.x.toFixed(4);
      vals['end_y'] = g.end.y.toFixed(4);
      vals['offset'] = g.offset.toFixed(4);
    } else if (type === 'Polyline') {
      vals['closed'] = g.closed ? 'true' : 'false';
    } else if (type === 'Spline') {
      vals['degree'] = String(g.degree ?? 3);
      vals['closed'] = g.closed ? 'true' : 'false';
    } else if (type === 'Point') {
      vals['position_x'] = g.position.x.toFixed(4);
      vals['position_y'] = g.position.y.toFixed(4);
    } else if (type === 'ConstructionLine') {
      vals['origin_x'] = g.origin.x.toFixed(4);
      vals['origin_y'] = g.origin.y.toFixed(4);
      vals['direction_x'] = g.direction.x.toFixed(4);
      vals['direction_y'] = g.direction.y.toFixed(4);
    } else if (type === 'RevisionCloud') {
      vals['arc_length'] = g.arc_length.toFixed(4);
    } else if (type === 'BlockRef') {
      vals['insertion_x'] = g.insertion.x.toFixed(4);
      vals['insertion_y'] = g.insertion.y.toFixed(4);
      vals['rotation'] = (((g.rotation || 0) * 180) / Math.PI).toFixed(2);
      vals['scale_x'] = (g.scale_x ?? 1).toFixed(4);
      vals['scale_y'] = (g.scale_y ?? 1).toFixed(4);
    }

    editValues = vals;
  }

  let prevEntityId = $state<string | null>(null);
  $effect(() => {
    if (entity && entity.id !== prevEntityId) {
      prevEntityId = entity.id;
      initEditValues(entity);
    } else if (!entity) {
      prevEntityId = null;
      editValues = {};
    }
  });

  function commitGeometry() {
    if (!entity) return;
    const type = getEntityType(entity);
    let geom: Record<string, unknown>;

    if (type === 'Line') {
      geom = {
        Line: {
          start: { x: parseFloat(editValues['start_x']), y: parseFloat(editValues['start_y']) },
          end: { x: parseFloat(editValues['end_x']), y: parseFloat(editValues['end_y']) },
        },
      };
    } else if (type === 'Circle') {
      geom = {
        Circle: {
          center: { x: parseFloat(editValues['center_x']), y: parseFloat(editValues['center_y']) },
          radius: parseFloat(editValues['radius']),
        },
      };
    } else if (type === 'Arc') {
      geom = {
        Arc: {
          center: { x: parseFloat(editValues['center_x']), y: parseFloat(editValues['center_y']) },
          radius: parseFloat(editValues['radius']),
          start_angle: (parseFloat(editValues['start_angle']) * Math.PI) / 180,
          end_angle: (parseFloat(editValues['end_angle']) * Math.PI) / 180,
        },
      };
    } else if (type === 'Rectangle') {
      geom = {
        Rectangle: {
          origin: { x: parseFloat(editValues['origin_x']), y: parseFloat(editValues['origin_y']) },
          width: parseFloat(editValues['width']),
          height: parseFloat(editValues['height']),
          rotation: (parseFloat(editValues['rotation']) * Math.PI) / 180,
        },
      };
    } else if (type === 'Text') {
      geom = {
        Text: {
          position: {
            x: parseFloat(editValues['position_x']),
            y: parseFloat(editValues['position_y']),
          },
          content: editValues['content'],
          height: parseFloat(editValues['height']),
          rotation: (parseFloat(editValues['rotation']) * Math.PI) / 180,
        },
      };
    } else if (type === 'Ellipse') {
      geom = {
        Ellipse: {
          center: { x: parseFloat(editValues['center_x']), y: parseFloat(editValues['center_y']) },
          semi_major: parseFloat(editValues['semi_major']),
          semi_minor: parseFloat(editValues['semi_minor']),
          rotation: (parseFloat(editValues['rotation']) * Math.PI) / 180,
        },
      };
    } else if (type === 'Dimension') {
      geom = {
        Dimension: {
          start: { x: parseFloat(editValues['start_x']), y: parseFloat(editValues['start_y']) },
          end: { x: parseFloat(editValues['end_x']), y: parseFloat(editValues['end_y']) },
          offset: parseFloat(editValues['offset']),
          text_override: getGeom(entity).text_override ?? null,
        },
      };
    } else if (type === 'Polyline') {
      const g = getGeom(entity);
      geom = { Polyline: { vertices: g.vertices, closed: editValues['closed'] === 'true' } };
    } else if (type === 'Spline') {
      const g = getGeom(entity);
      geom = {
        Spline: {
          control_points: g.control_points,
          degree: parseInt(editValues['degree']) || 3,
          closed: editValues['closed'] === 'true',
        },
      };
    } else if (type === 'Point') {
      geom = {
        Point: {
          position: {
            x: parseFloat(editValues['position_x']),
            y: parseFloat(editValues['position_y']),
          },
        },
      };
    } else if (type === 'ConstructionLine') {
      geom = {
        ConstructionLine: {
          origin: { x: parseFloat(editValues['origin_x']), y: parseFloat(editValues['origin_y']) },
          direction: {
            x: parseFloat(editValues['direction_x']),
            y: parseFloat(editValues['direction_y']),
          },
        },
      };
    } else {
      return;
    }

    for (const val of Object.values(editValues)) {
      if (
        val !== 'true' &&
        val !== 'false' &&
        typeof val === 'string' &&
        val !== editValues['content'] &&
        isNaN(parseFloat(val))
      )
        return;
    }

    onUpdate(entity.id, JSON.stringify(geom));
  }

  function handleFieldKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  }

  function handleFieldBlur() {
    commitGeometry();
  }

  function computedLength(g: Record<string, unknown>): string {
    const len = Math.sqrt((g.end.x - g.start.x) ** 2 + (g.end.y - g.start.y) ** 2);
    return app.formatLinear(len);
  }

  function computedCircumference(radius: number): string {
    return app.formatLinear(2 * Math.PI * radius);
  }

  function computedArea(type: string, g: Record<string, unknown>): string | null {
    if (type === 'Circle') return app.formatLinear(Math.PI * g.radius ** 2);
    if (type === 'Rectangle') return app.formatLinear(g.width * g.height);
    if (type === 'Ellipse') return app.formatLinear(Math.PI * g.semi_major * g.semi_minor);
    if (type === 'Polyline' && g.closed && g.vertices.length >= 3) {
      let area = 0;
      const verts = g.vertices;
      for (let i = 0; i < verts.length; i++) {
        const j = (i + 1) % verts.length;
        area += verts[i].x * verts[j].y - verts[j].x * verts[i].y;
      }
      return app.formatLinear(Math.abs(area / 2));
    }
    return null;
  }

  let selectedIds = $derived(app.selection.getSelectedIds());
  let selectedCount = $derived(selectedIds.length);

  function getMultiSelectEntities(): Entity[] {
    if (!app.kernel) return [];
    return selectedIds
      .map((id) => {
        const json = app.kernel.get_entity_json(id);
        return json ? JSON.parse(json) : null;
      })
      .filter(Boolean);
  }

  function getCommonLayer(entities: Entity[]): string | null {
    if (entities.length === 0) return null;
    const first = entities[0].layer_id;
    return entities.every((e) => e.layer_id === first) ? first : null;
  }

  function handleBatchLayerChange(layerId: string) {
    for (const id of selectedIds) {
      onChangeLayer(id, layerId);
    }
  }

  function handleBatchColorChange(color: string) {
    for (const id of selectedIds) {
      app.executeCommand({ type: 'SetEntityColor', id, color: color || undefined });
    }
  }
  function handleBatchLinetypeChange(linetype: string) {
    for (const id of selectedIds) {
      app.executeCommand({ type: 'SetEntityLinetype', id, linetype: linetype || undefined });
    }
  }
  function handleBatchLineweightChange(lineweight: string) {
    const lw = lineweight ? parseFloat(lineweight) : undefined;
    for (const id of selectedIds) {
      app.executeCommand({ type: 'SetEntityLineweight', id, lineweight: lw });
    }
  }
  function getCommonStyle(entities: Entity[], prop: string): string | null {
    if (entities.length === 0) return null;
    const first = (entities[0].style as Record<string, unknown>)?.[prop] ?? '';
    return entities.every((e) => ((e.style as Record<string, unknown>)?.[prop] ?? '') === first)
      ? String(first)
      : null;
  }

  function getLayerCount(): number {
    return app.getLayerNames().length;
  }
</script>

<aside class="properties-panel">
  <div class="panel-header">
    <span>Properties</span>
    {#if onCollapse}
      <button onclick={onCollapse} title="Collapse">&times;</button>
    {/if}
  </div>

  {#if entity && selectedCount <= 1}
    {@const type = getEntityType(entity)}
    {@const geom = getGeom(entity)}

    <button class="section-header" onclick={() => (generalOpen = !generalOpen)}>
      <span class="section-arrow">{generalOpen ? '\u25BE' : '\u25B8'}</span>
      <span>General</span>
    </button>
    {#if generalOpen}
      <div class="section-body">
        <div class="prop-row">
          <span class="prop-label">Type</span>
          <span class="prop-value-ro">{type}</span>
        </div>
        <div class="prop-row">
          <span class="prop-label">ID</span>
          <span class="prop-value-ro id-value">{entity.id}</span>
        </div>
        <div class="prop-row">
          <span class="prop-label">Layer</span>
          <select
            class="prop-select"
            value={entity.layer_id}
            onchange={(e) => onChangeLayer(entity.id, e.currentTarget.value)}
          >
            {#each layers as layerId (layerId)}
              <option value={layerId}>{layerId}</option>
            {/each}
          </select>
        </div>
        <div class="prop-row">
          <span class="prop-label">Color</span>
          <span class="prop-value-ro">{entity.style?.color || 'ByLayer'}</span>
        </div>
        <div class="prop-row">
          <span class="prop-label">Linetype</span>
          <span class="prop-value-ro">{entity.style?.linetype || 'ByLayer'}</span>
        </div>
        <div class="prop-row">
          <span class="prop-label">Lineweight</span>
          <span class="prop-value-ro"
            >{entity.style?.lineweight != null
              ? entity.style.lineweight.toFixed(2)
              : 'ByLayer'}</span
          >
        </div>
      </div>
    {/if}

    <button class="section-header" onclick={() => (geometryOpen = !geometryOpen)}>
      <span class="section-arrow">{geometryOpen ? '\u25BE' : '\u25B8'}</span>
      <span>Geometry</span>
    </button>
    {#if geometryOpen}
      <div class="section-body">
        {#if type === 'Line'}
          <div class="prop-row">
            <span class="prop-label">Start X</span>
            <input
              class="prop-input"
              bind:value={editValues['start_x']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Start Y</span>
            <input
              class="prop-input"
              bind:value={editValues['start_y']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">End X</span>
            <input
              class="prop-input"
              bind:value={editValues['end_x']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">End Y</span>
            <input
              class="prop-input"
              bind:value={editValues['end_y']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Length</span>
            <span class="prop-value-computed">{computedLength(geom)}</span>
          </div>
        {:else if type === 'Circle'}
          <div class="prop-row">
            <span class="prop-label">Center X</span>
            <input
              class="prop-input"
              bind:value={editValues['center_x']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Center Y</span>
            <input
              class="prop-input"
              bind:value={editValues['center_y']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Radius</span>
            <input
              class="prop-input"
              bind:value={editValues['radius']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Circumference</span>
            <span class="prop-value-computed">{computedCircumference(geom.radius)}</span>
          </div>
          <div class="prop-row">
            <span class="prop-label">Area</span>
            <span class="prop-value-computed">{computedArea('Circle', geom)}</span>
          </div>
        {:else if type === 'Arc'}
          <div class="prop-row">
            <span class="prop-label">Center X</span>
            <input
              class="prop-input"
              bind:value={editValues['center_x']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Center Y</span>
            <input
              class="prop-input"
              bind:value={editValues['center_y']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Radius</span>
            <input
              class="prop-input"
              bind:value={editValues['radius']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Start Angle</span>
            <input
              class="prop-input"
              bind:value={editValues['start_angle']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">End Angle</span>
            <input
              class="prop-input"
              bind:value={editValues['end_angle']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
        {:else if type === 'Rectangle'}
          <div class="prop-row">
            <span class="prop-label">Origin X</span>
            <input
              class="prop-input"
              bind:value={editValues['origin_x']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Origin Y</span>
            <input
              class="prop-input"
              bind:value={editValues['origin_y']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Width</span>
            <input
              class="prop-input"
              bind:value={editValues['width']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Height</span>
            <input
              class="prop-input"
              bind:value={editValues['height']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Rotation</span>
            <input
              class="prop-input"
              bind:value={editValues['rotation']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Area</span>
            <span class="prop-value-computed">{computedArea('Rectangle', geom)}</span>
          </div>
        {:else if type === 'Polyline'}
          <div class="prop-row">
            <span class="prop-label">Vertices</span>
            <span class="prop-value-ro">{geom.vertices.length}</span>
          </div>
          <div class="prop-row">
            <span class="prop-label">Closed</span>
            <select
              class="prop-select"
              bind:value={editValues['closed']}
              onchange={handleFieldBlur}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          {#if geom.closed && geom.vertices.length >= 3}
            <div class="prop-row">
              <span class="prop-label">Area</span>
              <span class="prop-value-computed">{computedArea('Polyline', geom)}</span>
            </div>
          {/if}
        {:else if type === 'Text'}
          <div class="prop-row">
            <span class="prop-label">Position X</span>
            <input
              class="prop-input"
              bind:value={editValues['position_x']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Position Y</span>
            <input
              class="prop-input"
              bind:value={editValues['position_y']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Content</span>
            <input
              class="prop-input"
              bind:value={editValues['content']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Height</span>
            <input
              class="prop-input"
              bind:value={editValues['height']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Rotation</span>
            <input
              class="prop-input"
              bind:value={editValues['rotation']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
        {:else if type === 'Ellipse'}
          <div class="prop-row">
            <span class="prop-label">Center X</span>
            <input
              class="prop-input"
              bind:value={editValues['center_x']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Center Y</span>
            <input
              class="prop-input"
              bind:value={editValues['center_y']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Semi-major</span>
            <input
              class="prop-input"
              bind:value={editValues['semi_major']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Semi-minor</span>
            <input
              class="prop-input"
              bind:value={editValues['semi_minor']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Rotation</span>
            <input
              class="prop-input"
              bind:value={editValues['rotation']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Area</span>
            <span class="prop-value-computed">{computedArea('Ellipse', geom)}</span>
          </div>
        {:else if type === 'Dimension'}
          <div class="prop-row">
            <span class="prop-label">Start X</span>
            <input
              class="prop-input"
              bind:value={editValues['start_x']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Start Y</span>
            <input
              class="prop-input"
              bind:value={editValues['start_y']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">End X</span>
            <input
              class="prop-input"
              bind:value={editValues['end_x']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">End Y</span>
            <input
              class="prop-input"
              bind:value={editValues['end_y']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Offset</span>
            <input
              class="prop-input"
              bind:value={editValues['offset']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
        {:else if type === 'Spline'}
          <div class="prop-row">
            <span class="prop-label">Control Pts</span>
            <span class="prop-value-ro">{geom.control_points?.length ?? 0}</span>
          </div>
          <div class="prop-row">
            <span class="prop-label">Degree</span>
            <input
              class="prop-input"
              bind:value={editValues['degree']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Closed</span>
            <select
              class="prop-select"
              bind:value={editValues['closed']}
              onchange={handleFieldBlur}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        {:else if type === 'Point'}
          <div class="prop-row">
            <span class="prop-label">Position X</span>
            <input
              class="prop-input"
              bind:value={editValues['position_x']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Position Y</span>
            <input
              class="prop-input"
              bind:value={editValues['position_y']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
        {:else if type === 'ConstructionLine'}
          <div class="prop-row">
            <span class="prop-label">Origin X</span>
            <input
              class="prop-input"
              bind:value={editValues['origin_x']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Origin Y</span>
            <input
              class="prop-input"
              bind:value={editValues['origin_y']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Dir X</span>
            <input
              class="prop-input"
              bind:value={editValues['direction_x']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
          <div class="prop-row">
            <span class="prop-label">Dir Y</span>
            <input
              class="prop-input"
              bind:value={editValues['direction_y']}
              onblur={handleFieldBlur}
              onkeydown={handleFieldKeydown}
            />
          </div>
        {:else if type === 'RevisionCloud'}
          <div class="prop-row">
            <span class="prop-label">Points</span>
            <span class="prop-value-ro">{geom.boundary?.length ?? 0}</span>
          </div>
          <div class="prop-row">
            <span class="prop-label">Arc Length</span>
            <span class="prop-value-ro">{app.formatLinear(geom.arc_length)}</span>
          </div>
        {:else if type === 'BlockRef'}
          <div class="prop-row">
            <span class="prop-label">Block ID</span>
            <span class="prop-value-ro id-value">{geom.block_id}</span>
          </div>
          <div class="prop-row">
            <span class="prop-label">Insert X</span>
            <span class="prop-value-ro">{editValues['insertion_x']}</span>
          </div>
          <div class="prop-row">
            <span class="prop-label">Insert Y</span>
            <span class="prop-value-ro">{editValues['insertion_y']}</span>
          </div>
          <div class="prop-row">
            <span class="prop-label">Rotation</span>
            <span class="prop-value-ro">{editValues['rotation']}</span>
          </div>
          <div class="prop-row">
            <span class="prop-label">Scale X</span>
            <span class="prop-value-ro">{editValues['scale_x']}</span>
          </div>
          <div class="prop-row">
            <span class="prop-label">Scale Y</span>
            <span class="prop-value-ro">{editValues['scale_y']}</span>
          </div>
        {:else}
          <div class="prop-row">
            <span class="prop-label">Type</span>
            <span class="prop-value-ro">{type}</span>
          </div>
        {/if}
      </div>
    {/if}
  {:else if selectedCount > 1}
    {@const entities = getMultiSelectEntities()}
    {@const commonLayer = getCommonLayer(entities)}

    <button class="section-header" onclick={() => (generalOpen = !generalOpen)}>
      <span class="section-arrow">{generalOpen ? '\u25BE' : '\u25B8'}</span>
      <span>General</span>
    </button>
    {#if generalOpen}
      {@const commonColor = getCommonStyle(entities, 'color')}
      {@const commonLinetype = getCommonStyle(entities, 'linetype')}
      {@const commonLw = getCommonStyle(entities, 'lineweight')}
      <div class="section-body">
        <div class="multi-select-banner">{selectedCount} objects selected</div>
        <div class="prop-row">
          <span class="prop-label">Layer</span>
          {#if commonLayer}
            <select
              class="prop-select"
              value={commonLayer}
              onchange={(e) => handleBatchLayerChange(e.currentTarget.value)}
            >
              {#each layers as layerId (layerId)}
                <option value={layerId}>{layerId}</option>
              {/each}
            </select>
          {:else}
            <select
              class="prop-select"
              onchange={(e) => handleBatchLayerChange(e.currentTarget.value)}
            >
              <option value="" disabled selected>*Varies*</option>
              {#each layers as layerId (layerId)}
                <option value={layerId}>{layerId}</option>
              {/each}
            </select>
          {/if}
        </div>
        <div class="prop-row">
          <span class="prop-label">Color</span>
          <input
            class="prop-input"
            value={commonColor ?? ''}
            placeholder={commonColor === null ? '*Varies*' : 'ByLayer'}
            onchange={(e) => handleBatchColorChange(e.currentTarget.value)}
          />
        </div>
        <div class="prop-row">
          <span class="prop-label">Linetype</span>
          <select
            class="prop-select"
            value={commonLinetype ?? ''}
            onchange={(e) => handleBatchLinetypeChange(e.currentTarget.value)}
          >
            {#if commonLinetype === null}
              <option value="" disabled selected>*Varies*</option>
            {/if}
            <option value="">ByLayer</option>
            <option value="Continuous">Continuous</option>
            <option value="Dashed">Dashed</option>
            <option value="Dotted">Dotted</option>
            <option value="DashDot">DashDot</option>
          </select>
        </div>
        <div class="prop-row">
          <span class="prop-label">Lineweight</span>
          <select
            class="prop-select"
            value={commonLw ?? ''}
            onchange={(e) => handleBatchLineweightChange(e.currentTarget.value)}
          >
            {#if commonLw === null}
              <option value="" disabled selected>*Varies*</option>
            {/if}
            <option value="">ByLayer</option>
            <option value="0.13">0.13 mm</option>
            <option value="0.25">0.25 mm</option>
            <option value="0.35">0.35 mm</option>
            <option value="0.50">0.50 mm</option>
            <option value="0.70">0.70 mm</option>
            <option value="1.00">1.00 mm</option>
          </select>
        </div>
      </div>
    {/if}
  {:else}
    <div class="no-selection">
      <div class="no-sel-icon">&#9670;</div>
      <div class="no-sel-text">No selection</div>
      <div class="no-sel-hint">Select an entity to view properties</div>
      <div class="stats-section">
        <div class="section-header-static">Drawing Statistics</div>
        <div class="prop-row">
          <span class="prop-label">Entities</span>
          <span class="prop-value-ro">{app.entityCount}</span>
        </div>
        <div class="prop-row">
          <span class="prop-label">Layers</span>
          <span class="prop-value-ro">{getLayerCount()}</span>
        </div>
      </div>
    </div>
  {/if}
</aside>

<style>
  .properties-panel {
    width: 100%;
    height: 100%;
    background: var(--color-bg-secondary);
    border-left: 1px solid var(--color-border);
    padding: 0;
    overflow-y: auto;
    font-size: var(--font-size-md);
    color: var(--color-text-primary);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-lg);
    background: var(--color-bg-tertiary);
    font-weight: 600;
    color: var(--color-text-heading);
    border-bottom: 1px solid var(--color-border);
  }

  .panel-header button {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 1rem;
    padding: 0 var(--space-xs);
    line-height: 1;
  }
  .panel-header button:hover {
    color: var(--color-accent);
  }

  .section-header {
    display: flex;
    width: 100%;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-lg);
    background: var(--color-bg-tertiary);
    cursor: pointer;
    font-weight: 600;
    font-size: var(--font-size-sm);
    font-family: inherit;
    border: none;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    user-select: none;
    margin-top: var(--space-md);
    text-align: left;
  }
  .section-header:first-of-type {
    margin-top: 0;
  }
  .section-header:hover {
    background: var(--color-bg-input);
  }

  .section-arrow {
    font-size: 0.65rem;
    width: 10px;
    color: var(--color-text-secondary);
  }

  .section-body {
    padding: var(--space-sm) 0;
  }

  .prop-row {
    display: flex;
    align-items: center;
    padding: var(--space-sm) var(--space-lg);
    min-height: 24px;
  }

  .prop-label {
    width: 40%;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    flex-shrink: 0;
    text-align: right;
    padding-right: var(--space-md);
  }

  .prop-value-ro {
    width: 60%;
    color: var(--color-text-primary);
    font-family: var(--font-mono);
    font-size: var(--font-size-md);
  }

  .id-value {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prop-value-computed {
    width: 60%;
    color: var(--color-computed);
    font-family: var(--font-mono);
    font-size: var(--font-size-md);
    font-style: italic;
  }

  .prop-input {
    width: 60%;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    padding: var(--space-xs) var(--space-sm);
    font-family: var(--font-mono);
    font-size: var(--font-size-md);
    border-radius: var(--radius-sm);
    outline: none;
    transition: border-color 100ms ease;
  }
  .prop-input:focus {
    border-color: var(--color-accent);
  }

  .prop-select {
    width: 60%;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    padding: var(--space-xs) var(--space-sm);
    font-family: inherit;
    font-size: var(--font-size-md);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .prop-select:hover {
    background: var(--color-bg-hover);
  }

  .multi-select-banner {
    padding: var(--space-md) var(--space-lg);
    color: var(--color-accent);
    font-weight: 600;
    font-size: var(--font-size-sm);
    border-bottom: 1px solid var(--color-border-light);
  }

  .no-selection {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-xl) var(--space-lg) 0;
  }

  .no-sel-icon {
    color: var(--color-text-dim);
    font-size: 1.2rem;
    margin-bottom: var(--space-sm);
  }

  .no-sel-text {
    color: var(--color-text-secondary);
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .no-sel-hint {
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    margin-top: var(--space-xs);
    margin-bottom: var(--space-lg);
  }

  .stats-section {
    width: 100%;
    border-top: 1px solid var(--color-border);
    padding: 0;
  }

  .section-header-static {
    padding: var(--space-sm) var(--space-lg);
    background: var(--color-bg-tertiary);
    font-weight: 600;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    border-bottom: 1px solid var(--color-border);
  }
</style>
