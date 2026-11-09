// CrystalMoon V3 ledger: what V3 adds to the laws. Run: node tests/v3.test.cjs   (about 3 minutes)
// The V2 ledger (tests/core.test.cjs, T1–T12) still runs unchanged against this core.js.
'use strict';
const CM = require('../core.js');
const results = [];
function ok(name, cond, detail) { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); }
const N = CM.N, c = CM.MOON.c;
const at = (I, dx, dz) => I[((c[2] + dz) * N + c[1]) * N + c[0] + dx];

// ---------------------------------------------------- T13 with no crystal, or no dispersion, the light is white
{
  const empty = new Float32Array(N * N * N);
  const a = CM.tracePhotonsRGB(empty, 0.42, 1, 0.8, 0.5, { K: 8192 });
  let d0 = 0; for (let i = 0; i < a[0].length; i++) d0 = Math.max(d0, Math.abs(a[0][i] - a[2][i]), Math.abs(a[0][i] - a[1][i]));
  const ball = new Float32Array(N * N * N);
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (Math.hypot(x - c[0], y - c[1], z - (c[2] + 16)) < 4.5) ball[(z * N + y) * N + x] = 1;
  const b = CM.tracePhotonsRGB(ball, 0.42, 1, 0.8, 0, { K: 8192 });
  let d1 = 0; for (let i = 0; i < b[0].length; i++) d1 = Math.max(d1, Math.abs(b[0][i] - b[2][i]));
  ok('T13 white stays white: the three colours are identical in empty space, and through crystal when D = 0', d0 === 0 && d1 === 0, `largest |R − B|: empty space ${d0}, crystal ball with D = 0: ${d1}`);
}

// ---------------------------------------------------- T14 a crystal ball is a lens with a different focus for each colour
let ballRGB, ballPsi;
{
  const Psi = new Float32Array(N * N * N);
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (Math.hypot(x - c[0], y - c[1], z - (c[2] + 16)) < 4.5) Psi[(z * N + y) * N + x] = 1;
  const rgb = CM.tracePhotonsRGB(Psi, 0.42, 1, 0.8, 0.5, { K: 65536 });
  ballRGB = rgb; ballPsi = Psi;
  // where along the axis behind the ball (centre at dz = 16, back face at 20.5) each colour first reaches twice the free light there
  const free = (dz) => Math.pow((CM.MOON.R + 2) / dz, 2);
  const first = rgb.map((I) => { for (let dz = 17; dz < 31; dz++) if (at(I, 0, dz) > 2 * free(dz) && at(I, 0, dz) > 1) return dz; return 99; });
  const near = rgb.map((I) => at(I, 0, 20)), far = rgb.map((I) => at(I, 0, 30));
  ok('T14 the crystal splits the light: behind a crystal ball blue comes to a focus first, then green, then red (κ = 0.8, D = 0.5)',
    first[2] < first[1] && first[1] < first[0] && near[2] > 3 * near[0] && far[0] > 1.5 * far[2],
    `focus begins ${first[2]} / ${first[1]} / ${first[0]} voxels from the moon's centre for blue / green / red; light on the axis at 20: R ${near[0].toFixed(2)} G ${near[1].toFixed(2)} B ${near[2].toFixed(2)}; at 30: R ${far[0].toFixed(2)} G ${far[1].toFixed(2)} B ${far[2].toFixed(2)} (cap ${CM.PHOTON.cap})`);
}

// ---------------------------------------------------- T15 colour writes the grain
{
  const n = 40, L = CM.derive({ ...CM.law(0), kL: 0, kS: 0.5 });
  const run = (chroma) => {
    const f = new CM.Field(L, n);
    const isl = (x) => x >= 6 && x < 34;
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const i = f.idx(x, y, z); f.eps[i] = isl(x) ? 0.26 : L.epsSea; f.mask[i] = isl(x) ? 1 : 0; f.chroma[i] = chroma(y); }
    f.seedNoise(0.05, 7);
    for (let s = 0; s < 5000; s++) f.step();
    return f;
  };
  const grain = (f, pred) => { let a = 0, m = 0; for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 10; x < 30; x++) { if (!pred(y)) continue; const i = f.idx(x, y, z); if (f.psi[i] > 0.4) { m++; if (Math.abs(f.phi[i]) > 0.3) a++; } } return a / Math.max(1, m); };
  // one body, same brightness everywhere; the light is blue (B − R = +0.5) in one half and red (−0.5) in the other
  const f = run((y) => (y < 20 ? 0.5 : -0.5));
  const blue = grain(f, (y) => y >= 3 && y < 17), red = grain(f, (y) => y >= 23 && y < 37);
  const w = grain(run(() => 0), () => true);
  const bodyIn = (pred) => { let b = 0, t = 0; for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 10; x < 30; x++) { if (!pred(y)) continue; t++; if (f.psi[f.idx(x, y, z)] > 0.4) b++; } return b / t; };
  const bb = bodyIn((y) => y >= 3 && y < 17), br = bodyIn((y) => y >= 23 && y < 37);
  ok('T15 colour writes the grain: in one body under even brightness, the half in blue light is fine-grained and the half in red light is much smoother; the body is there in both',
    blue > 0.4 && red < 0.5 * blue && bb > 0.5 && br > 0.5,
    `fine lattice in ${(100 * blue).toFixed(0)}% of the body under blue, ${(100 * red).toFixed(0)}% under red, ${(100 * w).toFixed(0)}% under white; body (ψ > 0.4) fills ${(100 * bb).toFixed(0)}% of the blue half and ${(100 * br).toFixed(0)}% of the red half after 5000 steps`);
}

// ---------------------------------------------------- T16 the loop closes: the ball's own colours sort its neighbour's grain
{
  // the light field of T14 (a ball lens 16 voxels out) falls on a slab of body behind it; the slab's grain follows blue − red
  const L = CM.derive({ ...CM.law(0), kL: 0, kS: 0.5 });
  const f = new CM.Field(L, N);
  CM.setLightRGB(f, ballRGB);
  let pos = 0, neg = 0, cnt = 0;
  for (let z = c[2] + 19; z < c[2] + 31; z++) for (let y = c[1] - 6; y <= c[1] + 6; y++) for (let x = c[0] - 6; x <= c[0] + 6; x++) { const v = f.chroma[f.idx(x, y, z)]; cnt++; if (v > 0.25) pos++; if (v < -0.25) neg++; }
  ok('T16 one lens makes both kinds of place: behind the ball there are voxels the law reads as blue and (fewer) voxels it reads as red',
    pos / cnt > 0.01 && neg / cnt > 0.01, `in the 13 × 13 × 12 block behind the ball: B − R > 0.25 in ${(100 * pos / cnt).toFixed(1)}% of voxels, < −0.25 in ${(100 * neg / cnt).toFixed(1)}%`);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} pass`);
if (failed.length) process.exit(1);
