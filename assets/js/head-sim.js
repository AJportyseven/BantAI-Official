/* BantAI Chapter 4: interactive head simulation.
   Classic script, no dependencies. Works from file:// and from a server.
   Sensitivity values come from the backend threshold_engine.py:
   Strict 15 deg / 1 s, Balanced 20 deg / 2 s, Lenient 20 deg / 3 s. */
(function () {
  'use strict';

  var DEG = Math.PI / 180;
  var FACE_OVERRIDE = null; /* set to 0 or Math.PI only if the face points away from the viewer */
  var PRESETS = {
    strict: { angle: 15, dur: 1 },
    balanced: { angle: 20, dur: 2 },
    lenient: { angle: 20, dur: 3 }
  };

  /* ---------- pure logic ---------- */
  function evalState(yaw, angle, dur, timer, dt) {
    if (Math.abs(yaw) >= angle) {
      timer += dt;
      return { timer: timer, state: timer >= dur ? 'flagged' : 'building' };
    }
    return { timer: 0, state: 'normal' };
  }

  /* ---------- matrices (column major) ---------- */
  var ID = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  function mul(a, b) {
    var o = new Float32Array(16), c, r, k, s;
    for (c = 0; c < 4; c++) {
      for (r = 0; r < 4; r++) {
        s = 0;
        for (k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
    }
    return o;
  }
  function rotY(a) { var c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); }
  function trans(x, y, z) { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]); }
  function scl(s) { return new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]); }
  function perspective(fovy, asp, n, f) {
    var t = 1 / Math.tan(fovy / 2), nf = 1 / (n - f);
    return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]);
  }
  function nodeMatrix(n) {
    if (n.matrix) return new Float32Array(n.matrix);
    var t = n.translation || [0, 0, 0], q = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1];
    var x = q[0], y = q[1], z = q[2], w = q[3], x2 = x + x, y2 = y + y, z2 = z + z;
    var xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
    return new Float32Array([
      (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
      (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
      (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
      t[0], t[1], t[2], 1
    ]);
  }

  /* ---------- GLB parsing ---------- */
  var CT = { 5120: [1, 'getInt8'], 5121: [1, 'getUint8'], 5122: [2, 'getInt16'], 5123: [2, 'getUint16'], 5125: [4, 'getUint32'], 5126: [4, 'getFloat32'] };
  var NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

  function readAccessor(j, bin, i) {
    var a = j.accessors[i];
    if (a.bufferView == null) throw new Error('accessor without bufferView');
    var bv = j.bufferViews[a.bufferView], ct = CT[a.componentType], n = NC[a.type];
    var base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    var stride = bv.byteStride || ct[0] * n;
    var dv = new DataView(bin);
    var out = a.componentType === 5126 ? new Float32Array(a.count * n) : new Uint32Array(a.count * n);
    var k, m;
    for (k = 0; k < a.count; k++) {
      for (m = 0; m < n; m++) out[k * n + m] = dv[ct[1]](base + k * stride + m * ct[0], true);
    }
    return out;
  }

  function computeNormals(p, n, ind) {
    var t, a, b, c, ux, uy, uz, vx, vy, vz, nx, ny, nz, i, l;
    for (i = 0; i < n.length; i++) n[i] = 0;
    for (t = 0; t + 2 < ind.length; t += 3) {
      a = ind[t] * 3; b = ind[t + 1] * 3; c = ind[t + 2] * 3;
      ux = p[b] - p[a]; uy = p[b + 1] - p[a + 1]; uz = p[b + 2] - p[a + 2];
      vx = p[c] - p[a]; vy = p[c + 1] - p[a + 1]; vz = p[c + 2] - p[a + 2];
      nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
      n[a] += nx; n[a + 1] += ny; n[a + 2] += nz;
      n[b] += nx; n[b + 1] += ny; n[b + 2] += nz;
      n[c] += nx; n[c + 1] += ny; n[c + 2] += nz;
    }
    for (i = 0; i < n.length; i += 3) {
      l = Math.sqrt(n[i] * n[i] + n[i + 1] * n[i + 1] + n[i + 2] * n[i + 2]) || 1;
      n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
    }
  }

  function buildMesh(buf) {
    var dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('Not a GLB file');
    var off = 12, j = null, bin = null, len, type, s;
    while (off + 8 <= buf.byteLength) {
      len = dv.getUint32(off, true); type = dv.getUint32(off + 4, true); s = off + 8;
      if (type === 0x4E4F534A) j = JSON.parse(new TextDecoder('utf-8').decode(new Uint8Array(buf, s, len)));
      else if (type === 0x004E4942) bin = buf.slice(s, s + len);
      off = s + len;
    }
    if (!j || !bin) throw new Error('GLB chunks missing');

    var list = [];
    var scene = j.scenes && j.scenes[j.scene || 0];
    if (j.nodes && scene && scene.nodes) {
      var walk = function (i, parent) {
        var n = j.nodes[i], m = mul(parent, nodeMatrix(n));
        if (n.mesh != null) list.push([n.mesh, m]);
        (n.children || []).forEach(function (c) { walk(c, m); });
      };
      scene.nodes.forEach(function (i) { walk(i, ID); });
    } else {
      list.push([0, ID]);
    }

    var P = [], N = [], I = [], base = 0, hadN = true;
    list.forEach(function (it) {
      var m = it[1];
      j.meshes[it[0]].primitives.forEach(function (pr) {
        if (pr.mode != null && pr.mode !== 4) return;
        var pos = readAccessor(j, bin, pr.attributes.POSITION);
        var cnt = pos.length / 3;
        var nor = pr.attributes.NORMAL != null ? readAccessor(j, bin, pr.attributes.NORMAL) : null;
        var idx = pr.indices != null ? readAccessor(j, bin, pr.indices) : null;
        var k, x, y, z, nx, ny, nz, ax, ay, az, l;
        for (k = 0; k < cnt; k++) {
          x = pos[k * 3]; y = pos[k * 3 + 1]; z = pos[k * 3 + 2];
          P.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
          if (nor) {
            nx = nor[k * 3]; ny = nor[k * 3 + 1]; nz = nor[k * 3 + 2];
            ax = m[0] * nx + m[4] * ny + m[8] * nz; ay = m[1] * nx + m[5] * ny + m[9] * nz; az = m[2] * nx + m[6] * ny + m[10] * nz;
            l = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
            N.push(ax / l, ay / l, az / l);
          } else { N.push(0, 0, 0); hadN = false; }
        }
        if (idx) { for (k = 0; k < idx.length; k++) I.push(idx[k] + base); }
        else { for (k = 0; k < cnt; k++) I.push(k + base); }
        base += cnt;
      });
    });
    if (!base) throw new Error('No triangles found');
    var positions = new Float32Array(P), normals = new Float32Array(N);
    var indices = base > 65535 ? new Uint32Array(I) : new Uint16Array(I);
    if (!hadN) computeNormals(positions, normals, indices);
    var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], q, c;
    for (q = 0; q < positions.length; q += 3) {
      for (c = 0; c < 3; c++) {
        if (positions[q + c] < mn[c]) mn[c] = positions[q + c];
        if (positions[q + c] > mx[c]) mx[c] = positions[q + c];
      }
    }
    return { positions: positions, normals: normals, indices: indices, min: mn, max: mx, normalsFromFile: hadN };
  }

  if (typeof module === 'object' && module && module.exports) {
    module.exports = { buildMesh: buildMesh, evalState: evalState, PRESETS: PRESETS, mul: mul };
  }
  if (typeof document === 'undefined') return;

  /* ---------- WebGL renderer ---------- */
  var VS = 'attribute vec3 aPos;attribute vec3 aNor;uniform mat4 uMVP;uniform mat3 uNrm;varying vec3 vN;void main(){vN=uNrm*aNor;gl_Position=uMVP*vec4(aPos,1.0);}';
  var FS = 'precision mediump float;varying vec3 vN;uniform vec3 uBase;uniform vec3 uRim;void main(){vec3 n=normalize(vN);float key=max(dot(n,normalize(vec3(-0.45,0.65,0.62))),0.0);float fill=max(dot(n,normalize(vec3(0.7,-0.1,0.4))),0.0);float rim=pow(1.0-max(n.z,0.0),2.6);vec3 c=uBase*(0.30+0.80*key+0.22*fill)+uRim*rim*0.8;gl_FragColor=vec4(c,1.0);}';

  function makeRenderer(canvas, mesh) {
    var gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true }) || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL is not available');
    var wide = mesh.indices instanceof Uint32Array;
    if (wide && !gl.getExtension('OES_element_index_uint')) throw new Error('32 bit indices are not supported');
    function sh(t, src) {
      var o = gl.createShader(t);
      gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o));
      return o;
    }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    function buf(target, data, loc, size) {
      var b = gl.createBuffer();
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, gl.STATIC_DRAW);
      if (gl.getError() !== gl.NO_ERROR) throw new Error('buffer upload failed');
      if (loc >= 0) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); }
    }
    buf(gl.ARRAY_BUFFER, mesh.positions, gl.getAttribLocation(pr, 'aPos'), 3);
    buf(gl.ARRAY_BUFFER, mesh.normals, gl.getAttribLocation(pr, 'aNor'), 3);
    buf(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, -1, 0);
    var uMVP = gl.getUniformLocation(pr, 'uMVP'), uNrm = gl.getUniformLocation(pr, 'uNrm');
    gl.uniform3f(gl.getUniformLocation(pr, 'uBase'), 0.30, 0.37, 0.47);
    gl.uniform3f(gl.getUniformLocation(pr, 'uRim'), 0.573, 0.965, 1.0);
    gl.enable(gl.DEPTH_TEST);
    var k = 1.8 / (mesh.max[1] - mesh.min[1]);
    var cy = (mesh.max[1] + mesh.min[1]) / 2;
    var face = (mesh.max[2] + mesh.min[2]) >= 0 ? 0 : Math.PI;
    if (FACE_OVERRIDE !== null) face = FACE_OVERRIDE;
    var itype = wide ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    function draw(yawDeg) {
      var w = canvas.width, h = canvas.height;
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      var asp = w / h, dist = 4 / Math.min(1, asp);
      var model = mul(trans(0, -cy * k, 0), mul(scl(k), rotY(face + yawDeg * DEG)));
      var mv = mul(trans(0, 0, -dist), model);
      gl.uniformMatrix4fv(uMVP, false, mul(perspective(30 * DEG, asp, 0.1, 50), mv));
      gl.uniformMatrix3fv(uNrm, false, new Float32Array([mv[0], mv[1], mv[2], mv[4], mv[5], mv[6], mv[8], mv[9], mv[10]]));
      gl.drawElements(gl.TRIANGLES, mesh.indices.length, itype, 0);
    }
    return { draw: draw, gl: gl };
  }

  /* ---------- page wiring ---------- */
  var root = document.querySelector('.sim');
  if (!root) return;
  function $(id) { return document.getElementById(id); }
  var stage = $('sim-stage'), canvas = $('sim-canvas'), msg = $('sim-msg');
  var yawIn = $('sim-yaw'), yawOut = $('sim-yaw-out'), centerBtn = $('sim-center');
  var angIn = $('sim-angle'), angOut = $('sim-angle-out'), durIn = $('sim-dur'), durOut = $('sim-dur-out');
  var stateEl = $('sim-state'), explainEl = $('sim-explain'), fillEl = $('sim-fill'), timeEl = $('sim-time');
  var radios = root.querySelectorAll('input[name="sim-preset"]');
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var TEXT = {
    normal: { label: 'Normal', text: 'The head is inside the angle, so nothing is counted.' },
    building: { label: 'Building', text: 'The head is past the angle. The timer is running.' },
    flagged: { label: 'Flagged', text: 'The turn lasted long enough. A real flag would go to the proctor to review.' }
  };
  var S = { yaw: 0, shown: 0, angle: 20, dur: 2, timer: 0, state: '' };
  var renderer = null, dirty = true, inView = false, raf = 0, last = 0, started = false, glChecked = false;

  function setRadio(v) { Array.prototype.forEach.call(radios, function (r) { r.checked = r.value === v; }); }
  function labelSliders() {
    angOut.textContent = S.angle + '°';
    durOut.textContent = S.dur + ' s';
    angIn.setAttribute('aria-valuetext', S.angle + ' degrees');
    durIn.setAttribute('aria-valuetext', S.dur + (S.dur === 1 ? ' second' : ' seconds'));
  }
  function readSliders() { S.angle = +angIn.value; S.dur = +durIn.value; S.timer = 0; labelSliders(); }
  function applyPreset(name) {
    var p = PRESETS[name];
    if (!p) return;
    angIn.value = p.angle; durIn.value = p.dur;
    readSliders();
  }
  function yawLabel() {
    var a = Math.abs(S.yaw), side = S.yaw < 0 ? ' left' : (S.yaw > 0 ? ' right' : '');
    yawOut.textContent = a + '°' + side;
    yawIn.setAttribute('aria-valuetext', a + ' degrees' + (side || ' centre'));
  }
  function setYaw(v) {
    v = Math.max(-85, Math.min(85, Math.round(v)));
    if (v === S.yaw) return;
    S.yaw = v; yawIn.value = v; yawLabel(); wake();
  }

  function update(dt) {
    var r = evalState(S.yaw, S.angle, S.dur, S.timer, dt);
    S.timer = r.timer;
    if (r.state !== S.state) {
      S.state = r.state;
      root.setAttribute('data-state', r.state);
      stateEl.textContent = TEXT[r.state].label;
      explainEl.textContent = TEXT[r.state].text;
    }
    var t = Math.min(S.timer, S.dur);
    fillEl.style.transform = 'scaleX(' + (t / S.dur) + ')';
    timeEl.textContent = t.toFixed(1) + ' s / ' + S.dur.toFixed(1) + ' s';
    var diff = S.yaw - S.shown;
    if (reduce.matches || Math.abs(diff) < 0.02) {
      if (S.shown !== S.yaw) { S.shown = S.yaw; dirty = true; }
    } else {
      S.shown += diff * (1 - Math.exp(-dt * 7));
      dirty = true;
    }
    if (dirty && renderer) { renderer.draw(S.shown); dirty = false; }
    if (renderer && !glChecked) {
      glChecked = true;
      if (renderer.gl.getError() !== renderer.gl.NO_ERROR) fail('The 3D view could not be started. The controls still work.');
    }
    return Math.abs(S.yaw - S.shown) > 0.02 || (Math.abs(S.yaw) >= S.angle && S.timer < S.dur);
  }
  function tick(now) {
    raf = 0;
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (update(dt) && inView && !document.hidden) raf = requestAnimationFrame(tick);
    else last = 0;
  }
  function wake() { if (!raf) raf = requestAnimationFrame(tick); }

  function resize() {
    var rc = stage.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(rc.width * dpr)), h = Math.max(1, Math.round(rc.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    dirty = true;
  }
  function fail(text) {
    renderer = null;
    root.classList.remove('is-ready');
    root.classList.add('is-nogl');
    msg.textContent = text;
  }
  function loadScript(src, ok, bad) {
    var el = document.createElement('script');
    el.src = src; el.async = true; el.onload = ok; el.onerror = bad;
    document.head.appendChild(el);
  }
  function boot() {
    if (started) return;
    started = true;
    msg.textContent = 'Loading the 3D head';
    loadScript('assets/model/human-head.glb.js', function () {
      try {
        var b64 = window.BANTAI_HEAD_B64;
        window.BANTAI_HEAD_B64 = null;
        var bin = atob(b64), u = new Uint8Array(bin.length), i;
        for (i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        renderer = makeRenderer(canvas, buildMesh(u.buffer));
        root.classList.add('is-ready');
        resize(); wake();
      } catch (e) {
        if (window.console) console.error(e);
        fail('The 3D head could not be shown on this device. The controls still work.');
      }
    }, function () {
      fail('The 3D head file could not be loaded. The controls still work.');
    });
  }

  canvas.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    fail('The 3D view was interrupted. Reload the page to see it again.');
  });

  var drag = null;
  function endDrag() { if (!drag) return; drag = null; stage.classList.remove('is-drag'); }
  canvas.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    drag = { x: e.clientX, yaw: S.yaw, id: e.pointerId };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    stage.classList.add('is-drag');
    root.classList.add('has-dragged');
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    setYaw(drag.yaw + (e.clientX - drag.x) * 0.65);
  });
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  canvas.addEventListener('dragstart', function (e) { e.preventDefault(); });

  yawIn.addEventListener('input', function () { setYaw(+yawIn.value); });
  centerBtn.addEventListener('click', function () { setYaw(0); });
  angIn.addEventListener('input', function () { setRadio('custom'); readSliders(); wake(); });
  durIn.addEventListener('input', function () { setRadio('custom'); readSliders(); wake(); });
  Array.prototype.forEach.call(radios, function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      if (r.value === 'custom') S.timer = 0; else applyPreset(r.value);
      wake();
    });
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });
  if ('ResizeObserver' in window) new ResizeObserver(function () { resize(); wake(); }).observe(stage);
  else window.addEventListener('resize', function () { resize(); wake(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      inView = es[es.length - 1].isIntersecting;
      if (inView) { boot(); wake(); }
    }, { rootMargin: '600px 0px' }).observe(root);
  } else { inView = true; boot(); }

  applyPreset('balanced');
  setRadio('balanced');
  yawLabel();
  update(0);
})();
