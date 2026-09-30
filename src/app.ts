import type { Document, Feature, MateConstraint, ParamSpec, Params, Xform } from './cad/types.ts';
import { DENSITY, identityTransform, uid } from './cad/types.ts';
import { initKernel } from './cad/kernel.ts';
import { assemblyBounds, rebuild, type Rebuild } from './cad/rebuild.ts';
import { objText, stlBinary, stlZip, threeMf, visibleBodies } from './cad/export.ts';
import { blankProject, idbGet, idbSet, parseProject, serialize } from './cad/storage.ts';
import { categories, defaultParams, partById, PARTS } from './parts/registry.ts';
import { gearboxProject, rcBoatProject, rcCarProject } from './templates.ts';
import { createViewport, type ShadeMode, type ViewTool, type Viewport } from './viewport.ts';
import wasmUrl from 'manifold-3d/manifold.wasm?url';

type History = { past: string[]; future: string[] };

export function boot(root: Element) {
  root.innerHTML = shell();
  const $ = <T extends Element>(sel: string) => {
    const node = root.querySelector(sel);
    if (!node) throw new Error(`Missing ${sel}`);
    return node as T;
  };

  let doc: Document = blankProject();
  let built: Rebuild = { features: [], mates: new Map(), warnings: [] };
  let selection: string[] = [];
  let tool: ViewTool = 'select';
  let shade: ShadeMode = 'shaded';
  let category = 'All';
  let query = '';
  let snap = true;
  let supportAngle = 45;
  let sectionOn = false;
  let busy = false;
  let gesture = false;
  const history: History = { past: [], future: [] };
  let view: Viewport | null = null;
  let rebuildToken = 0;

  const canvas = $<HTMLCanvasElement>('#view');
  const toastEl = $<HTMLElement>('#toast');
  const statusEl = $<HTMLElement>('#status');
  const treeEl = $<HTMLElement>('#tree');
  const libEl = $<HTMLElement>('#library');
  const filtersEl = $<HTMLElement>('#filters');
  const inspector = $<HTMLElement>('#inspector');
  const welcome = $<HTMLDialogElement>('#welcome');
  const help = $<HTMLDialogElement>('#help');
  const mateDlg = $<HTMLDialogElement>('#mate');

  const toast = (text: string) => {
    toastEl.textContent = text;
    toastEl.hidden = false;
    window.setTimeout(() => {
      toastEl.hidden = true;
    }, 2800);
  };

  view = createViewport(canvas, {
    onSelect: (ids, additive) => {
      if (!ids.length && !additive) selection = [];
      else if (additive) selection = [...new Set([...selection, ...ids])];
      else selection = ids;
      syncChrome();
    },
    onTransform: (id, xform, phase) => {
      const feature = featureById(id);
      if (!feature || feature.locked || driven(id)) return;
      if (phase === 'start') pushHistory();
      feature.transform = xform;
      if (phase === 'end') {
        for (const mate of doc.mates) {
          if (mate.movingId === id && mate.live) {
            mate.live = false;
            toast('Mate released. Solve it again from the inspector if you still want it driving.');
          }
        }
        schedule();
      } else syncStatus();
    },
    onMeasure: (text) => {
      statusEl.textContent = text;
    },
  });

  function featureById(id: string) {
    return doc.features.find((f) => f.id === id);
  }

  function driven(id: string) {
    return doc.mates.some((mate) => mate.live && mate.movingId === id);
  }

  function pushHistory() {
    history.past.push(serialize(doc));
    if (history.past.length > 80) history.past.shift();
    history.future = [];
  }

  function mutate(fn: () => void) {
    pushHistory();
    fn();
    schedule(true);
  }

  function schedule(refreshInspector = false) {
    const token = ++rebuildToken;
    const veil = $<HTMLElement>('#busy');
    busy = true;
    veil.hidden = false;
    window.setTimeout(() => {
      if (token !== rebuildToken) return;
      try {
        built = rebuild(doc);
        if (built.warnings.length) toast(built.warnings[0]);
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Rebuild failed.');
      }
      busy = false;
      veil.hidden = true;
      view?.setShade(shade, supportAngle);
      view?.setScene(doc, built);
      view?.setSelection(selection.filter((id) => !driven(id)));
      view?.setTool(tool);
      view?.setBed(doc.bed.x, doc.bed.y, doc.bed.visible);
      view?.setSection(sectionOn ? sectionHeight() : null);
      renderTree();
      syncStatus();
      if (refreshInspector) renderInspector();
      else updateMeshStats();
      void idbSet('autosave', serialize(doc));
    }, 16);
  }

  function updateMeshStats() {
    const feature = selection.length === 1 ? featureById(selection[0]) : undefined;
    const mesh = feature ? built.features.find((item) => item.id === feature.id) : undefined;
    const stats = root.querySelector('#mesh-stats');
    if (stats && mesh) stats.textContent = `${mesh.triangles.toLocaleString()} triangles · ${(mesh.volume / 1000).toFixed(2)} cm³${mesh.world ? ` · ${span(mesh.world)} mm` : ''}`;
  }

  function syncChrome() {
    renderLibrary();
    renderTree();
    renderInspector();
    syncStatus();
    view?.setSelection(selection.filter((id) => !driven(id)));
    view?.setTool(tool);
    view?.setSnap(snap ? 1 : null, snap ? 15 : null);
    view?.setBed(doc.bed.x, doc.bed.y, doc.bed.visible);
    view?.setSection(sectionOn ? sectionHeight() : null);
    paintPressed();
  }

  function sectionHeight() {
    const box = assemblyBounds(doc, built);
    return (box.min[2] + box.max[2]) / 2;
  }

  function syncStatus() {
    const box = assemblyBounds(doc, built);
    const size = [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]];
    let volume = 0;
    let tris = 0;
    for (const feature of doc.features) {
      if (!feature.visible || feature.suppressed) continue;
      const mesh = built.features.find((item) => item.id === feature.id);
      if (!mesh) continue;
      volume += mesh.volume;
      tris += mesh.triangles;
    }
    const grams = (volume / 1000) * DENSITY[doc.material];
    const over = size[0] > doc.bed.x + 0.1 || size[1] > doc.bed.y + 0.1;
    statusEl.innerHTML = `<span>${doc.name}</span><span>${size.map((n) => n.toFixed(1)).join(' × ')} mm</span><span>${(volume / 1000).toFixed(2)} cm³</span><span>${grams.toFixed(1)} g ${doc.material.toUpperCase()}</span><span>${tris.toLocaleString()} tris</span><span class="${over ? 'warn' : 'ok'}">${over ? 'Larger than the bed' : 'On the bed'}</span><span>${busy ? 'Rebuilding' : 'Ready'}</span>`;
  }

  function renderLibrary() {
    filtersEl.innerHTML = ['All', ...categories()]
      .map((cat) => `<button type="button" class="btn" data-cat="${cat}" aria-pressed="${category === cat}">${cat}</button>`)
      .join('');
    const q = query.trim().toLowerCase();
    const items = PARTS.filter((part) => (category === 'All' || part.category === category) && (!q || `${part.name} ${part.blurb} ${part.tags.join(' ')}`.toLowerCase().includes(q)));
    libEl.innerHTML = items
      .map((part) => `<button type="button" class="lib-card" data-add="${part.id}"><strong>${part.name}</strong><span>${part.blurb}</span></button>`)
      .join('');
  }

  function renderTree() {
    const roots = doc.features.filter((f) => !f.suppressed);
    const html: string[] = [];
    const row = (feature: Feature, child = false) => {
      const err = built.features.find((item) => item.id === feature.id)?.error;
      html.push(`<div class="${child ? 'child' : ''}"><button type="button" class="tree-row" data-pick="${feature.id}" aria-selected="${selection.includes(feature.id)}"><span><strong>${feature.name}</strong>${err ? `<small>${err}</small>` : ''}</span><span>${feature.visible ? '' : 'hidden'}</span></button></div>`);
    };
    for (const feature of roots) {
      row(feature);
      if (feature.kind === 'boolean') {
        for (const id of feature.sources) {
          const source = featureById(id);
          if (source) row(source, true);
        }
      }
      if (feature.kind === 'pattern') {
        const source = featureById(feature.source);
        if (source) row(source, true);
      }
    }
    treeEl.innerHTML = html.join('') || '<p class="muted">No parts yet. Add one from the library, or start an RC car or boat.</p>';
  }

  function renderInspector() {
    const feature = selection.length === 1 ? featureById(selection[0]) : undefined;
    if (!feature) {
      inspector.innerHTML = `<h2>Inspector</h2><p class="muted">Select a part. The first selected solid is the base for Subtract.</p><fieldset><legend>Project</legend><div class="grid2">${field('Project name', `<input id="proj-name" value="${escapeAttr(doc.name)}">`)}${field('Material', select('proj-material', ['pla', 'petg', 'abs', 'asa', 'tpu'], doc.material))}${field('Bed X', numInput('bed-x', doc.bed.x, 50, 500, 1))}${field('Bed Y', numInput('bed-y', doc.bed.y, 50, 500, 1))}</div><label><input id="bed-vis" type="checkbox" ${doc.bed.visible ? 'checked' : ''}> Show bed</label></fieldset>`;
      return;
    }
    const mesh = built.features.find((item) => item.id === feature.id);
    const mateNotes = doc.mates.filter((mate) => mate.movingId === feature.id || mate.fixedId === feature.id);
    const lockedMove = feature.locked || driven(feature.id);
    inspector.innerHTML = `
      <div class="row-actions">
        <button type="button" class="btn" id="act-dup">Duplicate</button>
        <button type="button" class="btn" id="act-bed">Drop to bed</button>
        <button type="button" class="btn" id="act-center">Center XY</button>
        <button type="button" class="btn danger" id="act-del">Delete</button>
      </div>
      <fieldset><legend>${feature.name}</legend>
        <div class="grid2">
          ${field('Name', `<input id="f-name" value="${escapeAttr(feature.name)}">`)}
          ${field('Color', `<input id="f-color" type="color" value="${feature.color}">`)}
        </div>
        <label><input id="f-vis" type="checkbox" ${feature.visible ? 'checked' : ''}> Visible</label>
        <label><input id="f-lock" type="checkbox" ${feature.locked ? 'checked' : ''}> Locked</label>
        ${mesh?.error ? `<p class="warn">${mesh.error}</p>` : ''}
        ${mesh ? `<p class="muted" id="mesh-stats">${mesh.triangles.toLocaleString()} triangles · ${(mesh.volume / 1000).toFixed(2)} cm³${mesh.world ? ` · ${span(mesh.world)} mm` : ''}</p>` : ''}
      </fieldset>
      <fieldset><legend>Transform</legend>
        ${lockedMove ? `<p class="muted">${driven(feature.id) ? 'A live mate is driving this part.' : 'Locked.'}</p>` : ''}
        <div class="grid2">
          ${xyzInputs('pos', 'Position', feature.transform.position, lockedMove)}
          ${xyzInputs('rot', 'Rotation', feature.transform.rotation, lockedMove)}
        </div>
      </fieldset>
      ${feature.kind === 'part' ? paramFields(feature.generator, feature.params) : ''}
      ${feature.kind === 'boolean' ? booleanFields(feature) : ''}
      ${feature.kind === 'pattern' ? patternFields(feature) : ''}
      <fieldset><legend>Mates</legend>
        ${mateNotes.map((mate) => `<p>${mate.live ? 'Live' : 'Released'} · ${mate.movingId === feature.id ? 'moves to' : 'anchors'} ${featureById(mate.movingId === feature.id ? mate.fixedId : mate.movingId)?.name ?? 'part'} <button type="button" class="btn" data-unmate="${mate.id}">${mate.live ? 'Release' : 'Solve'}</button> <button type="button" class="btn danger" data-del-mate="${mate.id}">Remove</button></p>`).join('') || '<p class="muted">No mates on this part.</p>'}
        <button type="button" class="btn" id="act-mate">Mate this part…</button>
      </fieldset>`;
  }

  function paramFields(generator: string, params: Params) {
    const mod = partById(generator);
    if (!mod) return '';
    const inputs = mod.params.map((spec) => field(spec.label, control(spec, params))).join('');
    return `<fieldset><legend>${mod.name}</legend><p class="muted">${mod.help}</p><div class="grid2">${inputs}</div></fieldset>`;
  }

  function control(spec: ParamSpec, params: Params) {
    const value = params[spec.key] ?? spec.default;
    if (spec.type === 'bool') return `<label><input data-param="${spec.key}" type="checkbox" ${value ? 'checked' : ''}> ${spec.help ?? spec.label}</label>`;
    if (spec.type === 'select') return `<select data-param="${spec.key}">${spec.options.map((opt) => `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`).join('')}</select>`;
    if (spec.type === 'text') return `<textarea data-param="${spec.key}" rows="4">${escapeText(String(value))}</textarea>`;
    const step = spec.type === 'int' ? 1 : spec.step;
    return numInput('', Number(value), spec.min, spec.max, step, spec.key);
  }

  function booleanFields(feature: Extract<Feature, { kind: 'boolean' }>) {
    return `<fieldset><legend>Boolean</legend><p>${feature.op}. Base: ${featureById(feature.sources[0])?.name ?? 'missing'}</p><button type="button" class="btn" id="act-separate">Separate</button></fieldset>`;
  }

  function patternFields(feature: Extract<Feature, { kind: 'pattern' }>) {
    return `<fieldset><legend>Pattern</legend>
      <div class="grid2">
        ${field('Count', numInput('pat-count', feature.count, 1, 24, 1))}
        ${field('Step angle', numInput('pat-angle', feature.stepAngle, 1, 180, 1))}
        ${field('Spacing X', numInput('pat-sx', feature.spacing[0], -200, 200, 1))}
        ${field('Spacing Y', numInput('pat-sy', feature.spacing[1], -200, 200, 1))}
        ${field('Spacing Z', numInput('pat-sz', feature.spacing[2], -200, 200, 1))}
        ${field('Axis', select('pat-axis', ['x', 'y', 'z'], feature.axis))}
        ${field('Mirror plane', select('pat-plane', ['yz', 'zx', 'xy'], feature.plane))}
      </div>
      <button type="button" class="btn" id="act-separate">Separate</button>
    </fieldset>`;
  }

  function paintPressed() {
    root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.tool === tool)));
    root.querySelectorAll<HTMLButtonElement>('[data-shade]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.shade === shade)));
    $<HTMLButtonElement>('#snap').setAttribute('aria-pressed', String(snap));
    $<HTMLButtonElement>('#section').setAttribute('aria-pressed', String(sectionOn));
  }

  function placePosition(): [number, number, number] {
    const current = selection[0] ? featureById(selection[0]) : undefined;
    const mesh = current ? built.features.find((item) => item.id === current.id) : undefined;
    if (mesh?.world) return [mesh.world.max[0] + 6, 0, 0];
    return [0, 0, 0];
  }

  function addPart(id: string) {
    const mod = partById(id);
    if (!mod) return;
    mutate(() => {
      const feature: Feature = {
        kind: 'part',
        id: uid(),
        name: mod.name,
        visible: true,
        locked: false,
        suppressed: false,
        color: mod.color,
        generator: mod.id,
        params: defaultParams(mod),
        transform: { ...identityTransform(), position: placePosition() },
      };
      doc.features.push(feature);
      selection = [feature.id];
    });
  }

  function loadDoc(next: Document, name?: string) {
    welcome.close();
    mutate(() => {
      doc = next;
      if (name) doc.name = name;
      selection = [];
    });
    view?.frame('iso');
  }

  function selectedFeatures() {
    return selection.map((id) => featureById(id)).filter((f): f is Feature => !!f && !f.suppressed);
  }

  function makeBoolean(op: 'union' | 'subtract' | 'intersect') {
    const sources = selectedFeatures();
    if (sources.length < 2) {
      toast('Select two or more solids. The first one is kept.');
      return;
    }
    mutate(() => {
      const feature: Feature = {
        kind: 'boolean',
        id: uid(),
        name: op === 'subtract' ? 'Cut' : op === 'union' ? 'Union' : 'Intersect',
        visible: true,
        locked: false,
        suppressed: false,
        color: sources[0].color,
        op,
        sources: sources.map((f) => f.id),
        transform: identityTransform(),
      };
      for (const source of sources) source.suppressed = true;
      doc.features.push(feature);
      selection = [feature.id];
    });
  }

  function makePattern(mode: 'linear' | 'circular' | 'mirror') {
    const source = selectedFeatures()[0];
    if (!source) {
      toast('Select one solid to pattern.');
      return;
    }
    mutate(() => {
      const feature: Feature = {
        kind: 'pattern',
        id: uid(),
        name: mode === 'mirror' ? 'Mirror' : mode === 'circular' ? 'Circular pattern' : 'Linear pattern',
        visible: true,
        locked: false,
        suppressed: false,
        color: source.color,
        mode,
        source: source.id,
        count: mode === 'mirror' ? 2 : 3,
        spacing: [20, 0, 0],
        axis: 'z',
        stepAngle: 60,
        plane: 'yz',
        transform: identityTransform(),
      };
      source.suppressed = true;
      doc.features.push(feature);
      selection = [feature.id];
    });
  }

  async function saveBlob(filename: string, data: BlobPart | Uint8Array, mime: string) {
    const part: BlobPart =
      typeof data === 'string'
        ? data
        : data instanceof Uint8Array
          ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
          : (data as BlobPart);
    const blob = new Blob([part], { type: mime });
    const picker = (window as Window & { showSaveFilePicker?: (opts: { suggestedName: string }) => Promise<{ createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }> }).showSaveFilePicker;
    if (picker) {
      try {
        const handle = await picker({ suggestedName: filename });
        const stream = await handle.createWritable();
        await stream.write(blob);
        await stream.close();
        return;
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') return;
      }
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function exportBodies(onlySelection = false) {
    return visibleBodies(doc, built, onlySelection ? selection : undefined);
  }

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest('button');
    if (!button) return;
    const cat = button.dataset.cat;
    if (cat) {
      category = cat;
      renderLibrary();
      return;
    }
    const add = button.dataset.add;
    if (add) {
      addPart(add);
      return;
    }
    const pick = button.dataset.pick;
    if (pick) {
      selection = (event as MouseEvent).shiftKey ? [...new Set([...selection, pick])] : [pick];
      syncChrome();
      return;
    }
    if (button.dataset.tool) {
      tool = button.dataset.tool as ViewTool;
      if (tool === 'measure') toast('Pick two points on the model.');
      syncChrome();
      return;
    }
    if (button.dataset.shade) {
      shade = button.dataset.shade as ShadeMode;
      view?.setShade(shade, supportAngle);
      view?.setScene(doc, built);
      syncChrome();
      return;
    }
    const action = button.id || button.dataset.action;
    if (action === 'snap') {
      snap = !snap;
      syncChrome();
    } else if (action === 'section') {
      sectionOn = !sectionOn;
      syncChrome();
    } else if (action === 'undo') undo();
    else if (action === 'redo') redo();
    else if (action === 'fit' || action === 'top' || action === 'front' || action === 'right' || action === 'iso') view?.frame(action);
    else if (action === 'union' || action === 'subtract' || action === 'intersect') makeBoolean(action);
    else if (action === 'linear' || action === 'circular' || action === 'mirror') makePattern(action);
    else if (action === 'new') confirmReplace(() => loadDoc(blankProject('Untitled')));
    else if (action === 'example-car') confirmReplace(() => loadDoc(rcCarProject()));
    else if (action === 'example-boat') confirmReplace(() => loadDoc(rcBoatProject()));
    else if (action === 'example-gear') confirmReplace(() => loadDoc(gearboxProject()));
    else if (action === 'help') help.showModal();
    else if (action === 'stl-sel') void saveBlob('platen-selected.stl', exportBodies(true).length ? stlBinary(exportBodies(true)) : new Uint8Array(), 'model/stl');
    else if (action === 'stl-all') void saveBlob(`${slug(doc.name)}.stl`, stlBinary(exportBodies()), 'model/stl');
    else if (action === 'stl-zip') void saveBlob(`${slug(doc.name)}-parts.zip`, stlZip(exportBodies()), 'application/zip');
    else if (action === 'export-3mf') void saveBlob(`${slug(doc.name)}.3mf`, threeMf(exportBodies()), 'model/3mf');
    else if (action === 'export-obj') void saveBlob(`${slug(doc.name)}.obj`, objText(exportBodies()), 'text/plain');
    else if (action === 'save') void saveBlob(`${slug(doc.name)}.platen.json`, serialize(doc), 'application/json');
    else if (action === 'open') $<HTMLInputElement>('#open-file').click();
    else if (action === 'act-dup') duplicate();
    else if (action === 'act-del') removeSelection();
    else if (action === 'act-bed') dropToBed();
    else if (action === 'act-center') centerXY();
    else if (action === 'act-separate') separate();
    else if (action === 'act-mate') openMate();
    else if (button.dataset.unmate) {
      const mate = doc.mates.find((item) => item.id === button.dataset.unmate);
      if (mate) mutate(() => (mate.live = !mate.live));
    } else if (button.dataset.delMate) {
      mutate(() => {
        doc.mates = doc.mates.filter((item) => item.id !== button.dataset.delMate);
      });
    } else if (action === 'mate-apply') applyMate();
    (button.closest('[popover]') as HTMLElement | null)?.hidePopover?.();
  });

  root.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (target.id === 'search') {
      query = target.value;
      renderLibrary();
      return;
    }
    if (!gesture && (target.dataset.param || target.id.startsWith('pos') || target.id.startsWith('rot') || target.id.startsWith('pat') || target.id.startsWith('f-') || target.id.startsWith('proj') || target.id.startsWith('bed'))) {
      pushHistory();
      gesture = true;
    }
    applyInspector(target);
  });

  root.addEventListener('change', (event) => {
    gesture = false;
    const target = event.target as HTMLInputElement;
    if (target.id === 'open-file' && target.files?.[0]) {
      const file = target.files[0];
      void file.text().then((text) => {
        try {
          loadDoc(parseProject(text));
          toast(`Opened ${file.name}`);
        } catch (error) {
          toast(error instanceof Error ? error.message : 'Could not open that file.');
        }
      });
      target.value = '';
      return;
    }
    if (target.id === 'support-angle') {
      supportAngle = Number(target.value) || 45;
      view?.setShade(shade, supportAngle);
      view?.setScene(doc, built);
    }
  });

  root.addEventListener('focusout', () => {
    gesture = false;
  });

  window.addEventListener('keydown', (event) => {
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && key === 'z') {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
    } else if ((event.metaKey || event.ctrlKey) && key === 'y') {
      event.preventDefault();
      redo();
    } else if ((event.metaKey || event.ctrlKey) && key === 'd') {
      event.preventDefault();
      duplicate();
    } else if ((event.metaKey || event.ctrlKey) && key === 's') {
      event.preventDefault();
      void saveBlob(`${slug(doc.name)}.platen.json`, serialize(doc), 'application/json');
    } else if (key === 'delete' || key === 'backspace') removeSelection();
    else if (key === 'f') view?.frame('fit');
    else if (key === 'h') toggleHide();
    else if (key === 'escape') {
      selection = [];
      tool = 'select';
      syncChrome();
    } else if (key === 'q') {
      tool = 'select';
      syncChrome();
    } else if (key === 'w') {
      tool = 'move';
      syncChrome();
    } else if (key === 'e') {
      tool = 'rotate';
      syncChrome();
    } else if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key) && selection.length) {
      event.preventDefault();
      nudge(key, event.shiftKey ? 0.1 : snap ? 1 : 1);
    }
  });

  function applyInspector(target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
    const feature = selection.length === 1 ? featureById(selection[0]) : undefined;
    if (target.id === 'proj-name') doc.name = target.value;
    if (target.id === 'proj-material') doc.material = (target as HTMLSelectElement).value as Document['material'];
    if (target.id === 'bed-x') doc.bed.x = Number(target.value) || doc.bed.x;
    if (target.id === 'bed-y') doc.bed.y = Number(target.value) || doc.bed.y;
    if (target.id === 'bed-vis') doc.bed.visible = (target as HTMLInputElement).checked;
    if (feature) {
      if (target.id === 'f-name') feature.name = target.value;
      if (target.id === 'f-color') feature.color = (target as HTMLInputElement).value;
      if (target.id === 'f-vis') feature.visible = (target as HTMLInputElement).checked;
      if (target.id === 'f-lock') feature.locked = (target as HTMLInputElement).checked;
      const axis = target.id.startsWith('pos') ? 'position' : target.id.startsWith('rot') ? 'rotation' : null;
      if (axis) {
        const index = Number(target.id.slice(-1));
        (feature.transform[axis] as Xform['position'])[index] = Number(target.value) || 0;
      }
      if (feature.kind === 'part' && target.dataset.param) {
        const mod = partById(feature.generator);
        const key = target.dataset.param;
        if ((target as HTMLInputElement).type === 'checkbox') feature.params[key] = (target as HTMLInputElement).checked;
        else if (target instanceof HTMLTextAreaElement || (mod?.params.find((spec) => spec.key === key)?.type === 'select') || mod?.params.find((spec) => spec.key === key)?.type === 'text') feature.params[key] = target.value;
        else feature.params[key] = Number(target.value);
        mod?.onParam?.(key, feature.params);
        if (key === 'preset') renderInspector();
      }
      if (feature.kind === 'pattern') {
        if (target.id === 'pat-count') feature.count = Number(target.value) || 1;
        if (target.id === 'pat-angle') feature.stepAngle = Number(target.value) || 0;
        if (target.id === 'pat-sx') feature.spacing[0] = Number(target.value) || 0;
        if (target.id === 'pat-sy') feature.spacing[1] = Number(target.value) || 0;
        if (target.id === 'pat-sz') feature.spacing[2] = Number(target.value) || 0;
        if (target.id === 'pat-axis') feature.axis = target.value as 'x' | 'y' | 'z';
        if (target.id === 'pat-plane') feature.plane = target.value as 'xy' | 'yz' | 'zx';
      }
    }
    schedule();
  }

  function undo() {
    const prev = history.past.pop();
    if (!prev) return;
    history.future.push(serialize(doc));
    doc = parseProject(prev);
    selection = [];
    schedule();
  }

  function redo() {
    const next = history.future.pop();
    if (!next) return;
    history.past.push(serialize(doc));
    doc = parseProject(next);
    selection = [];
    schedule();
  }

  function duplicate() {
    const feature = selection.length === 1 ? featureById(selection[0]) : undefined;
    if (!feature || feature.kind !== 'part') {
      toast('Duplicate works on a single part.');
      return;
    }
    mutate(() => {
      const copy: Feature = JSON.parse(JSON.stringify(feature)) as Feature;
      copy.id = uid();
      copy.name = `${feature.name} copy`;
      copy.transform = { ...feature.transform, position: [...feature.transform.position] as Xform['position'], rotation: [...feature.transform.rotation] as Xform['rotation'], scale: [...feature.transform.scale] as Xform['scale'] };
      copy.transform.position[0] += 10;
      doc.features.push(copy);
      selection = [copy.id];
    });
  }

  function removeSelection() {
    if (!selection.length) return;
    mutate(() => {
      const ids = new Set(selection);
      doc.features = doc.features.filter((f) => !ids.has(f.id));
      for (const feature of doc.features) {
        if (feature.kind === 'boolean') feature.sources = feature.sources.filter((id) => !ids.has(id));
      }
      doc.features = doc.features.filter((f) => f.kind !== 'boolean' || f.sources.length >= 2);
      doc.features = doc.features.filter((f) => f.kind !== 'pattern' || !ids.has(f.source));
      for (const feature of doc.features) {
        if (feature.suppressed) {
          const used = doc.features.some((other) => (other.kind === 'boolean' && other.sources.includes(feature.id)) || (other.kind === 'pattern' && other.source === feature.id));
          if (!used) feature.suppressed = false;
        }
      }
      doc.mates = doc.mates.filter((mate) => !ids.has(mate.movingId) && !ids.has(mate.fixedId));
      selection = [];
    });
  }

  function separate() {
    const feature = selection.length === 1 ? featureById(selection[0]) : undefined;
    if (!feature || (feature.kind !== 'boolean' && feature.kind !== 'pattern')) return;
    mutate(() => {
      const ids = feature.kind === 'boolean' ? feature.sources : [feature.source];
      for (const id of ids) {
        const source = featureById(id);
        if (source) source.suppressed = false;
      }
      doc.features = doc.features.filter((item) => item.id !== feature.id);
      selection = ids;
    });
  }

  function dropToBed() {
    const feature = selection.length === 1 ? featureById(selection[0]) : undefined;
    const mesh = feature ? built.features.find((item) => item.id === feature.id) : undefined;
    if (!feature || !mesh?.world) return;
    mutate(() => {
      feature.transform.position[2] -= mesh.world!.min[2];
    });
  }

  function centerXY() {
    const feature = selection.length === 1 ? featureById(selection[0]) : undefined;
    const mesh = feature ? built.features.find((item) => item.id === feature.id) : undefined;
    if (!feature || !mesh?.world) return;
    mutate(() => {
      const cx = (mesh.world!.min[0] + mesh.world!.max[0]) / 2;
      const cy = (mesh.world!.min[1] + mesh.world!.max[1]) / 2;
      feature.transform.position[0] -= cx;
      feature.transform.position[1] -= cy;
    });
  }

  function toggleHide() {
    mutate(() => {
      for (const id of selection) {
        const feature = featureById(id);
        if (feature) feature.visible = !feature.visible;
      }
    });
  }

  function nudge(key: string, step: number) {
    mutate(() => {
      for (const id of selection) {
        const feature = featureById(id);
        if (!feature || feature.locked || driven(id)) continue;
        if (key === 'arrowleft') feature.transform.position[0] -= step;
        if (key === 'arrowright') feature.transform.position[0] += step;
        if (key === 'arrowup') feature.transform.position[1] += step;
        if (key === 'arrowdown') feature.transform.position[1] -= step;
      }
    });
  }

  function openMate() {
    const moving = selection[0] ? featureById(selection[0]) : undefined;
    if (!moving) return;
    const movingMates = built.mates.get(moving.id) ?? [];
    const others = doc.features.filter((f) => f.id !== moving.id && f.kind === 'part');
    if (!movingMates.length || !others.length) {
      toast('This part needs a mate frame and another part to mate to.');
      return;
    }
    const fixed = others[0];
    const fixedMates = built.mates.get(fixed.id) ?? [];
    $<HTMLElement>('#mate-body').innerHTML = `
      <p>Move <strong>${moving.name}</strong> onto another part.</p>
      ${field('Onto', `<select id="mate-fixed">${others.map((f) => `<option value="${f.id}">${f.name}</option>`).join('')}</select>`)}
      ${field('This frame', `<select id="mate-moving">${movingMates.map((m) => `<option value="${m.id}">${m.label}</option>`).join('')}</select>`)}
      ${field('Target frame', `<select id="mate-target">${fixedMates.map((m) => `<option value="${m.id}">${m.label}</option>`).join('')}</select>`)}
      ${field('Distance', numInput('mate-dist', 0, -200, 200, 0.1))}
      ${field('Spin', numInput('mate-spin', 0, -180, 180, 1))}
      <label><input id="mate-flip" type="checkbox"> Flip axis</label>
      <button type="button" class="primary" id="mate-apply">Apply mate</button>`;
    const fixedSel = $<HTMLSelectElement>('#mate-fixed');
    const refreshTargets = () => {
      const mates = built.mates.get(fixedSel.value) ?? [];
      $<HTMLSelectElement>('#mate-target').innerHTML = mates.map((m) => `<option value="${m.id}">${m.label}</option>`).join('');
    };
    fixedSel.addEventListener('change', refreshTargets);
    mateDlg.showModal();
  }

  function applyMate() {
    const moving = selection[0];
    if (!moving) return;
    const constraint: MateConstraint = {
      id: uid('m'),
      movingId: moving,
      movingMate: $<HTMLSelectElement>('#mate-moving').value,
      fixedId: $<HTMLSelectElement>('#mate-fixed').value,
      fixedMate: $<HTMLSelectElement>('#mate-target').value,
      distance: Number($<HTMLInputElement>('#mate-dist').value) || 0,
      spin: Number($<HTMLInputElement>('#mate-spin').value) || 0,
      flip: $<HTMLInputElement>('#mate-flip').checked,
      live: true,
    };
    mateDlg.close();
    mutate(() => {
      doc.mates.push(constraint);
    });
  }

  function confirmReplace(fn: () => void) {
    if (doc.features.length && !window.confirm('Replace the current project? It is still in the local autosave until you overwrite that too.')) return;
    fn();
  }

  void (async () => {
    try {
      await initKernel(() => wasmUrl);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'The geometry kernel failed to load.');
      return;
    }
    const saved = await idbGet('autosave').catch(() => null);
    if (saved) {
      try {
        doc = parseProject(saved);
        toast('Restored the project saved in this browser.');
      } catch {
        doc = blankProject();
      }
    }
    schedule();
    if (!doc.features.length) welcome.showModal();
    view?.frame('iso');
  })();
}

function shell() {
  return `
  <div class="app">
    <header class="topbar">
      <div class="brand"><h1>Platen</h1><p>Local CAD for the print bed</p></div>
      <div class="toolbar">
        <button type="button" class="btn" popovertarget="file-menu">File</button>
        <button type="button" class="btn" id="undo">Undo</button>
        <button type="button" class="btn" id="redo">Redo</button>
        <span class="sep"></span>
        <button type="button" class="btn" data-tool="select">Select</button>
        <button type="button" class="btn" data-tool="move">Move</button>
        <button type="button" class="btn" data-tool="rotate">Rotate</button>
        <button type="button" class="btn" data-tool="measure">Measure</button>
        <span class="sep"></span>
        <button type="button" class="btn" id="union">Union</button>
        <button type="button" class="btn" id="subtract">Subtract</button>
        <button type="button" class="btn" id="intersect">Intersect</button>
        <button type="button" class="btn" id="mirror">Mirror</button>
        <button type="button" class="btn" id="linear">Line</button>
        <button type="button" class="btn" id="circular">Circle</button>
        <span class="sep"></span>
        <button type="button" class="btn" id="top">Top</button>
        <button type="button" class="btn" id="front">Front</button>
        <button type="button" class="btn" id="right">Right</button>
        <button type="button" class="btn" id="iso">Iso</button>
        <button type="button" class="btn" id="fit">Fit</button>
        <span class="sep"></span>
        <button type="button" class="btn" data-shade="shaded">Shaded</button>
        <button type="button" class="btn" data-shade="wire">Wire</button>
        <button type="button" class="btn" data-shade="overhang">Overhang</button>
        <button type="button" class="btn" id="section">Section</button>
        <button type="button" class="btn" id="snap" aria-pressed="true">Snap</button>
        <label class="muted">Support ° <input id="support-angle" type="number" min="20" max="70" step="1" value="45" style="width:64px"></label>
        <button type="button" class="btn" popovertarget="export-menu">Export</button>
        <button type="button" class="btn" id="help">Help</button>
      </div>
    </header>
    <div class="workspace">
      <aside class="library">
        <div class="tabs">
          <button type="button" class="primary" id="example-car">RC car</button>
          <button type="button" class="btn" id="example-boat">RC boat</button>
          <button type="button" class="btn" id="example-gear">Gearbox</button>
        </div>
        <search class="search"><label>Library <input id="search" type="search" placeholder="Gears, shafts, bolts, hulls…"></label></search>
        <div class="filters" id="filters"></div>
        <div class="lib-list" id="library"></div>
        <h2 class="muted" style="padding:0 8px">Model</h2>
        <div class="tree" id="tree"></div>
      </aside>
      <main class="stage">
        <canvas id="view" aria-label="3D viewport. Drag to orbit, scroll to zoom. Use the model tree to select parts."></canvas>
        <p class="stage-note">Z up · millimeters · orbit drag, scroll zoom, right-drag pan</p>
        <div id="busy" class="busy" hidden>Building solids…</div>
      </main>
      <aside class="inspector" id="inspector"></aside>
    </div>
    <footer id="status" class="statusbar" aria-live="polite"></footer>
  </div>
  <div id="file-menu" class="menu-pop" popover="auto">
    <button type="button" id="new">New</button>
    <button type="button" id="open">Open project</button>
    <button type="button" id="save">Save project</button>
    <button type="button" id="example-car">RC buggy</button>
    <button type="button" id="example-boat">RC boat</button>
    <button type="button" id="example-gear">Gearbox</button>
  </div>
  <div id="export-menu" class="menu-pop" popover="auto">
    <button type="button" id="stl-sel">STL, selected</button>
    <button type="button" id="stl-all">STL, all visible</button>
    <button type="button" id="stl-zip">STL zip, separate parts</button>
    <button type="button" id="export-3mf">3MF, separate objects</button>
    <button type="button" id="export-obj">OBJ</button>
  </div>
  <input id="open-file" type="file" accept="application/json,.json" hidden>
  <dialog id="welcome">
    <form method="dialog" class="dialog">
      <h2>Design a printable machine</h2>
      <p>Platen runs entirely in this browser. Projects stay on this computer. Export STL, 3MF, or OBJ and slice somewhere else.</p>
      <div class="kits">
        <button type="button" class="primary" id="example-car" value="car">Start an RC buggy</button>
        <button type="button" class="btn" id="example-boat">Start an RC boat</button>
        <button type="button" class="btn" id="example-gear">Start a gearbox</button>
        <button type="submit" class="btn" value="empty">Empty bed</button>
      </div>
      <p class="muted">Drop gears, shafts, bolts, bearings, and Arduino-sized boards from the library. Mate a bore to a shaft. Subtract bolt holes. The first solid you select is the one Subtract keeps.</p>
    </form>
  </dialog>
  <dialog id="help">
    <form method="dialog" class="dialog">
      <h2>How to build with Platen</h2>
      <ol>
        <li>Start from the RC buggy, RC boat, or gearbox, or add parts from the library.</li>
        <li>Edit millimeters in the inspector. Gears use module and tooth count. Center distance is module × (teeth + mate teeth) / 2.</li>
        <li>Select the part that should move, choose Mate, and pick the shaft or bore it should land on.</li>
        <li>Select the plastic first, then the bolt hole or heat-set cavity, and Subtract.</li>
        <li>Overhang view tints faces steeper than the support angle, measured from vertical, with +Z as the build direction.</li>
        <li>Export an STL of everything visible, a zip of separate parts, or a 3MF.</li>
      </ol>
      <p>Keys: Q select, W move, E rotate, F fit, H hide, arrows nudge, Delete, Ctrl+Z, Ctrl+D, Ctrl+S.</p>
      <button type="submit" class="primary">Close</button>
    </form>
  </dialog>
  <dialog id="mate"><form method="dialog" class="dialog" id="mate-body"></form></dialog>
  <div id="toast" class="toast" role="status" hidden></div>`;
}

function field(label: string, control: string) {
  return `<label>${label}${control}</label>`;
}

function numInput(id: string, value: number, min: number, max: number, step: number, param?: string) {
  const ident = id ? `id="${id}"` : '';
  const data = param ? `data-param="${param}"` : '';
  return `<input ${ident} ${data} type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${Number(value.toFixed(4))}">`;
}

function select(id: string, options: string[], value: string) {
  return `<select id="${id}">${options.map((opt) => `<option ${opt === value ? 'selected' : ''}>${opt}</option>`).join('')}</select>`;
}

function xyzInputs(prefix: string, label: string, value: [number, number, number], disabled: boolean) {
  return ['X', 'Y', 'Z']
    .map((axis, index) => field(`${label} ${axis}`, `<input id="${prefix}${index}" type="number" inputmode="decimal" step="0.1" value="${Number(value[index].toFixed(3))}" ${disabled ? 'disabled' : ''}>`))
    .join('');
}

function span(box: { min: number[]; max: number[] }) {
  return [0, 1, 2].map((i) => (box.max[i] - box.min[i]).toFixed(1)).join(' × ');
}

function escapeAttr(value: string) {
  return value.replace(/[&"]/g, (ch) => (ch === '&' ? '&amp;' : '&quot;'));
}

function escapeText(value: string) {
  return value.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch] ?? ch);
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'platen';
}
