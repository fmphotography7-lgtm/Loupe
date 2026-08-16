/* StudioFlow g163 · WALL PERSPECTIVE — measuring a wall that is NOT square to the camera.
   =========================================================================================
   Kirk's own method, which the existing calibration implements: stand square to the wall, know
   the ceiling is 8 feet, stack eight equal squares up it, and use the same square sideways to get
   the width. That is exactly right — AND IT ONLY WORKS SQUARE ON. The reason is worth stating,
   because it is the whole problem: when the wall is square to the camera the scale is the same
   everywhere, so one square measures the whole wall. The moment the wall turns away, the far end
   is smaller than the near end — equal distances on the wall are no longer equal in pixels — and
   a single square measures nothing but the spot it sits on.

   SO A TILTED WALL NEEDS FOUR POINTS, NOT A STACK. Four corners of a known rectangle pin down a
   HOMOGRAPHY: the 3x3 transform between the flat wall and the photograph. Once that exists, every
   point on the wall can be converted either way, the scale can be reported anywhere on it, and a
   picture can be drawn on the wall in correct perspective rather than pasted flat.

   THE PART THAT LOOKS IMPOSSIBLE AND IS NOT: he clicks the wall's four corners and tells us the
   ceiling height. That is one real measurement for a shape with two unknowns — how can the WIDTH
   come out? Because a rectangle carries information a general quadrilateral does not: its edges
   are parallel in pairs and its corners are square. The two pairs of edges give two vanishing
   points; for a real camera those directions are perpendicular, and that single constraint yields
   the focal length. With the focal length known the rectangle can be un-projected and its true
   proportions read off. Then the known 8 feet turns proportions into inches.

   WHAT IT REFUSES TO DO: when the wall is nearly square on, the vanishing points run off towards
   infinity and the focal length becomes numerically meaningless — the constraint is real but the
   arithmetic is dominated by click error. That case is DETECTED and handed back to the simple
   method, which is exactly right there. A solver that reports a confident number from a degenerate
   configuration is worse than one that says "use the square-on method for this photograph".

   No dependencies, pure numbers in and out, so it can be tested against synthetic photographs of
   walls whose real size is known.
   ========================================================================================= */
window.SFWallPerspective = {

  /* ---- small matrix helpers -------------------------------------------------------------- */

  /* Solve A x = b by Gaussian elimination with partial pivoting. Written out rather than pulled
     in, because it is eight equations and a dependency would be a poor trade. */
  solve(A, b){
    const n = b.length;
    const M = A.map((row, i) => row.slice().concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < 1e-12) return null;          // singular: the points are degenerate
      const t = M[c]; M[c] = M[piv]; M[piv] = t;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c] / M[c][c];
        if (!f) continue;
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    /* row[i] IS the diagonal entry of row i after full elimination. `row[i][i]` — indexing into a
       NUMBER — was silently undefined, so every homography came back NaN and every perspective
       solve reported "proportions could not be recovered". Caught only because the solver was
       tested against synthetic walls whose true width was known; a source review would have read
       straight past it. */
    return M.map((row, i) => row[n] / row[i]);
  },

  /* The homography taking four source points to four destination points. Standard eight-equation
     form with h33 fixed at 1 — which is safe here because a wall corner never maps to infinity. */
  homography(src, dst){
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const { x, y } = src[i], { x: u, y: v } = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = this.solve(A, b);
    if (!h) return null;
    return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
  },
  apply(H, p){
    const w = H[2][0] * p.x + H[2][1] * p.y + H[2][2];
    if (!isFinite(w) || Math.abs(w) < 1e-12) return null;
    return { x: (H[0][0] * p.x + H[0][1] * p.y + H[0][2]) / w,
             y: (H[1][0] * p.x + H[1][1] * p.y + H[1][2]) / w };
  },
  invert(H){
    const [a, b, c] = H[0], [d, e, f] = H[1], [g, h, i] = H[2];
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if (!isFinite(det) || Math.abs(det) < 1e-12) return null;
    const inv = [
      [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
      [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
      [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det]
    ];
    return inv;
  },

  /* Where two lines meet, in homogeneous coordinates so parallel lines give a point at infinity
     rather than a division by zero. */
  vanishing(p1, p2, p3, p4){
    const l1 = this.cross(this.h(p1), this.h(p2));
    const l2 = this.cross(this.h(p3), this.h(p4));
    return this.cross(l1, l2);                                // [x, y, w]; w ~ 0 means parallel
  },
  h(p){ return [p.x, p.y, 1]; },
  cross(a, b){
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  },

  /* ---- the solver ------------------------------------------------------------------------ */

  /* corners: the wall's four corners as clicked, in order — bottom-left, bottom-right, top-right,
     top-left, in PIXELS. heightInches: the known floor-to-ceiling height. principal: the image
     centre, which is where a camera's optical axis sits unless the photograph has been cropped
     off-centre.

     Returns the real width, the transform both ways, and — as much as anything — how much it
     trusts itself. */
  /* ==========================================================================================
     g205 — WOULD THIS ANSWER SURVIVE A CLICK LANDING ONE PIXEL OUT?
     ==========================================================================================
     The perspective solve needs two vanishing points with a right angle between them. When one of
     them is far away — a wall photographed with the camera level, which is most interior shots —
     the arithmetic still RUNS and still returns a number, but that number is built out of whatever
     error is in the clicks rather than out of the wall.

     KIRK'S OWN CALIBRATION IS THE CASE. His verticals lean 3px and 1px across 217px and 512px, so
     the answer came back as a confident 228 inches for a wall of about twelve feet — and because
     the solve "succeeded", the branch that would have ASKED FOR HIS LENS never ran, so the 17mm he
     supplied was ignored and setting it changed nothing. Six builds of "it still looks flat" trace
     back to this one number being wrong.

     DISTANCE IS NOT THE DISCRIMINATOR — my first fix used it and the tests immediately caught that
     it rejects genuine two-point walls whose vertical vanishing point is legitimately distant.
     STABILITY IS. Every corner he clicks is a pixel or two out; the question is whether the answer
     survives that. MEASURED: a real two-point wall moves 1.5–3.5% when a corner is nudged one
     pixel. His moves 22%. There is no overlap, so the threshold is not a compromise between two
     populations — it sits in an empty gap between them. */
  STABILITY_LIMIT: 0.10,

  stability(corners, heightInches, principal, focalPx){
    const base = this.solveWallRaw(corners, heightInches, principal, focalPx);
    if (!base || !base.ok || !(base.widthInches > 0)) return null;
    let lo = base.widthInches, hi = base.widthInches;
    for (let i = 0; i < 4; i++) {
      const nudges = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let n = 0; n < nudges.length; n++) {
        const moved = corners.map((p, j) => j === i
          ? { x: p.x + nudges[n][0], y: p.y + nudges[n][1] } : p);
        const s = this.solveWallRaw(moved, heightInches, principal, focalPx);
        if (s && s.ok && isFinite(s.widthInches) && s.widthInches > 0) {
          if (s.widthInches < lo) lo = s.widthInches;
          if (s.widthInches > hi) hi = s.widthInches;
        }
      }
    }
    return (hi - lo) / base.widthInches;
  },

  /* The public solve: the arithmetic, then the question of whether to believe it. */
  solveWall(corners, heightInches, principal, focalPx){
    const out = this.solveWallRaw(corners, heightInches, principal, focalPx);
    if (!out || !out.ok || out.method !== 'perspective') return out;
    /* Only the perspective branch can be ill-conditioned this way: square-on measures a height
       directly, and level-camera is already using a focal length he supplied. */
    const spread = this.stability(corners, heightInches, principal, focalPx);
    if (spread == null || spread <= this.STABILITY_LIMIT) {
      return Object.assign(out, { stability: spread });
    }
    /* Not trustworthy. Try the level-camera route, which uses a real lens instead of a
       vanishing point that is not there. */
    if (focalPx > 0) {
      /* `solveWallRaw` already takes a focal length and, when the corners alone will not do,
         routes through withFocal() itself. Rather than reproduce that here — and get the corner
         ordering wrong, which is what my first attempt did by calling a helper that does not
         exist — the raw solve is simply asked again in the state where it MUST use the lens. */
      const forced = this.solveWallRaw(corners, heightInches, principal, focalPx, true);
      if (forced && forced.ok) return Object.assign(forced, { stability: spread });
    }
    return { ok: false, method: 'needs-focal', needs: 'focal-or-width', stability: spread,
      heightInches: Number(heightInches),
      reason: 'These four corners do not pin the wall down on their own \u2014 nudging one by a single '
        + 'pixel changes the width by ' + Math.round(spread * 100) + '%. Set the lens (or read it '
        + 'from the photograph) and the wall can be measured exactly.' };
  },

  /* `mustUseLens` is set by solveWall when the perspective answer failed its stability check: it
     skips that branch entirely so the level-camera path — the one that uses his actual lens — is
     reached. Without it the same untrustworthy answer would simply be recomputed. */
  solveWallRaw(corners, heightInches, principal, focalPx, mustUseLens){
    const c = (corners || []).map(p => ({ x: Number(p.x), y: Number(p.y) }));
    if (c.length !== 4 || c.some(p => !isFinite(p.x) || !isFinite(p.y))) {
      return { ok: false, reason: 'Four corners are needed.' };
    }
    const H = Number(heightInches);
    if (!(H > 0)) return { ok: false, reason: 'The ceiling height is needed.' };
    const [bl, br, tr, tl] = c;

    /* Vanishing point of the two HORIZONTAL edges (floor line and ceiling line), and of the two
       VERTICAL edges. On a real wall those directions are perpendicular. */
    const vh = this.vanishing(bl, br, tl, tr);
    const vv = this.vanishing(bl, tl, br, tr);

    /* How far from parallel each pair is. A tiny w means the edges are parallel in the picture,
       i.e. that axis is square on and its vanishing point is at infinity. Scaled against the
       quadrilateral's own size so the test means the same on any image resolution. */
    const span = Math.max(
      Math.hypot(br.x - bl.x, br.y - bl.y), Math.hypot(tr.x - tl.x, tr.y - tl.y),
      Math.hypot(tl.x - bl.x, tl.y - bl.y), Math.hypot(tr.x - br.x, tr.y - br.y)) || 1;
    const conv = v => Math.abs(v[2]) < 1e-12 ? Infinity : Math.hypot(v[0] / v[2], v[1] / v[2]) / span;
    const dh = conv(vh), dv = conv(vv);

    const p0 = principal && isFinite(principal.x) ? principal : this.centroid(c);
    const out = { ok: true, corners: c, heightInches: H, principal: p0, convergeH: dh, convergeV: dv };

    /* THE SQUARE-ON CASE. Both pairs of edges effectively parallel: his stacked-squares method is
       not merely adequate here, it is BETTER, because the perspective solution is being asked to
       divide by something indistinguishable from zero. Reported as a distinct answer, not as a
       failure. */
    const FAR = 12;                                  // vanishing point ≥ 12 quad-widths away
    if (dh > FAR && dv > FAR) {
      const pxH = (Math.hypot(tl.x - bl.x, tl.y - bl.y) + Math.hypot(tr.x - br.x, tr.y - br.y)) / 2;
      const pxW = (Math.hypot(br.x - bl.x, br.y - bl.y) + Math.hypot(tr.x - tl.x, tr.y - tl.y)) / 2;
      const ppi = pxH / H;
      /* Degenerate clicks land HERE, not in the perspective branch: four identical points give
         parallel-everything, which reads as square-on, and 0/0 then produced a confident NaN
         width. Caught by a test, not by reading. A refusal is the only honest answer to a wall
         with no size. */
      if (!(pxH > 1) || !(pxW > 1) || !(ppi > 0)) {
        return Object.assign(out, { ok: false, method: 'square-on',
          reason: 'Those four points are on top of each other or in a line \u2014 click the wall\u2019s four corners.' });
      }
      return Object.assign(out, {
        method: 'square-on', widthInches: pxW / ppi, ppi,
        note: 'This wall is square to the camera, so one scale covers all of it \u2014 the same as counting squares up the wall.',
        H3: this.homography(
          [{ x: 0, y: 0 }, { x: pxW / ppi, y: 0 }, { x: pxW / ppi, y: H }, { x: 0, y: H }],
          [bl, br, tr, tl])
      });
    }

    /* THE PERSPECTIVE CASE. Two vanishing points, one right angle between them: that is the whole
       constraint, and it gives the focal length.
         f² = -(vh - p0) · (vv - p0)
       A NEGATIVE result is not a rounding problem — it means no real camera could have produced
       these four points as a rectangle, so the clicks are wrong (usually a corner out of order, or
       a wall that is not actually rectangular). Said plainly rather than square-rooted anyway. */
    let focal = null, aspect = null;
    /* ==========================================================================================
       g205 — FINITE IS NOT THE SAME AS NEAR, AND THAT ONE WORD COST KIRK SIX BUILDS.
       ==========================================================================================
       This branch used to run whenever both vanishing points were FINITE. But `f² = -(vh-p0)·(vv-p0)`
       only means anything when both points are actually somewhere: a vanishing point far away is a
       pair of edges that are parallel for every practical purpose, and the dot product with it is
       dominated by whatever tiny error is in the clicks.

       KIRK'S OWN CALIBRATION, read off his screenshot: his two vertical edges lean by 3px and 1px
       across 217px and 512px. Their vanishing point lands about 45,000 pixels away — EIGHTY
       quad-widths. The square-on test above already calls twelve "infinity". This branch called
       the same number finite, computed a focal length of 802px from it, and reported a 12ft wall
       as 228 inches. Everything downstream inherited that: the wall angle came out at 22° where
       the photograph plainly shows about 60°, and a canvas's edge shrank to two pixels.

       WORSE, IT MADE HIS LENS USELESS. Because this branch "succeeded", the level-camera path
       below never ran — so the 17mm he supplied was ignored, and setting it correctly changed
       nothing at all. That is exactly what he reported, twice.

       MY FIRST FIX WAS TOO BLUNT and the tests caught it: reusing FAR=12 here rejected genuine
       two-point walls (yaw 35°, pitch 8°) whose vertical vanishing point is legitimately distant
       but still usable. Distance is not the discriminator.

       STABILITY IS. The honest question is not "how far away is that point" but "would the answer
       survive a click landing one pixel out" — which every click does. So the solve is run again
       with each corner nudged, and if the recovered width swings wildly, the geometry is not
       carrying the information and the code says so instead of returning a confident number.
       That check lives in solveWall below, after a width has been computed. */
    if (!mustUseLens && isFinite(dh) && isFinite(dv)) {
      const a = { x: vh[0] / vh[2] - p0.x, y: vh[1] / vh[2] - p0.y };
      const b = { x: vv[0] / vv[2] - p0.x, y: vv[1] / vv[2] - p0.y };
      const f2 = -(a.x * b.x + a.y * b.y);
      if (f2 > 1e-6) focal = Math.sqrt(f2);
      else return Object.assign(out, { ok: false, method: 'perspective',
        reason: 'Those four points cannot be a rectangle seen by a camera. Check the corners are in order \u2014 bottom-left, bottom-right, top-right, top-left \u2014 and that they are the corners of the wall itself.' });
    }

    /* With the focal length the corners become directions in space. The rectangle's true
       proportions are the ratio of the two edge directions' lengths once un-projected. */
    if (focal) {
      /* The homography from a UNIT SQUARE to the picture. Built directly rather than by inverting
         the picture-to-square one: that inverse has entries around 1e-3 and a determinant around
         1e-9, which my own singularity guard rejected as degenerate. Solving the other direction
         needs no inverse at all, and the numbers stay near 1. */
      const Hi = this.homography(
        [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], [bl, br, tr, tl]);
      if (!Hi) return Object.assign(out, { ok: false, reason: 'Those four corners are in a line or repeat.' });
      /* Aspect from the standard rectangle-rectification result: with h1,h2 the first two columns
         of the homography from the unit square, and K the camera, the two constraints
         h1'K^-T K^-1 h2 = 0 and h1'K^-T K^-1 h1 = h2'K^-T K^-1 h2 give the width/height ratio. */
      const k = 1 / focal;
      const col = j => ({ x: Hi[0][j], y: Hi[1][j], z: Hi[2][j] });
      const h1 = col(0), h2 = col(1);
      const dot = (u, v) => (u.x - p0.x * u.z) * (v.x - p0.x * v.z) * k * k
                          + (u.y - p0.y * u.z) * (v.y - p0.y * v.z) * k * k
                          + u.z * v.z;
      const n1 = dot(h1, h1), n2 = dot(h2, h2);
      if (!(n1 > 0) || !(n2 > 0)) return Object.assign(out, { ok: false, reason: 'The wall proportions could not be recovered from those corners.' });
      aspect = Math.sqrt(n1 / n2);                    // width / height, in real units
      const widthInches = aspect * H;
      const H3 = this.homography(
        [{ x: 0, y: 0 }, { x: widthInches, y: 0 }, { x: widthInches, y: H }, { x: 0, y: H }],
        [bl, br, tr, tl]);
      return Object.assign(out, { method: 'perspective', focal, aspect, widthInches, H3,
        note: 'The wall turns away from the camera, so the scale changes across it \u2014 there is no single inches-per-pixel for the whole wall.' });
    }

    /* ONE AXIS SQUARE ON, THE OTHER NOT — and this is the COMMON case, not an edge case: a phone
       held level, wall running away to one side. The verticals stay parallel, so the vertical
       vanishing point is at infinity and the orthogonality trick has nothing to bite on. THE
       FOCAL LENGTH IS GENUINELY NOT RECOVERABLE from the rectangle alone here; that is geometry,
       not a shortcoming of the code, and no amount of cleverness with these four points fixes it.

       So it asks for the one number that closes it. In order of how little work it is for him:
         1. the focal length from the photograph's own EXIF, which his phone writes and StudioFlow
            already has exiftool to read;
         2. failing that, one real horizontal distance he has measured on the wall.
       Either resolves it completely. Told plainly, because "take the photo again from a different
       angle" is a worse answer than "your phone already recorded the number". */
    if (focalPx > 0) {
      const solved = this.withFocal(c, H, p0, focalPx);
      if (solved) return Object.assign(out, solved, { method: 'level-camera',
        note: 'The camera was level, so the wall\u2019s proportions came from the lens\u2019s focal length rather than from the corners.' });
    }
    return Object.assign(out, { ok: false, method: 'needs-focal',
      needs: 'focal-or-width',
      reason: 'The camera was level with the wall, which keeps the vertical edges parallel \u2014 and that means the four corners alone cannot give the width. Two things fix it: the focal length from the photograph\u2019s EXIF (your phone records it), or one horizontal distance you have measured on the wall.' });
  },

  /* Proportions from a KNOWN focal length. No vanishing points are involved, so this works for any
     view including the level-camera one — the columns of the unit-square homography, un-projected
     through the camera, have lengths in the ratio width:height. */
  withFocal(c, heightInches, p0, focalPx){
    const [bl, br, tr, tl] = c;
    const Hi = this.homography(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], [bl, br, tr, tl]);
    if (!Hi) return null;
    const k = 1 / focalPx;
    const col = j => ({ x: Hi[0][j], y: Hi[1][j], z: Hi[2][j] });
    const dot = (u, v) => (u.x - p0.x * u.z) * (v.x - p0.x * v.z) * k * k
                        + (u.y - p0.y * u.z) * (v.y - p0.y * v.z) * k * k + u.z * v.z;
    const h1 = col(0), h2 = col(1);
    const n1 = dot(h1, h1), n2 = dot(h2, h2);
    if (!(n1 > 0) || !(n2 > 0)) return null;
    const aspect = Math.sqrt(n1 / n2);
    const widthInches = aspect * heightInches;
    return { ok: true, focal: focalPx, aspect, widthInches, focalGiven: true,
      H3: this.homography(
        [{ x: 0, y: 0 }, { x: widthInches, y: 0 }, { x: widthInches, y: heightInches }, { x: 0, y: heightInches }],
        [bl, br, tr, tl]) };
  },

  /* Focal length in PIXELS from what a phone actually records: the 35mm-equivalent focal length,
     which needs no sensor size at all — it IS the number normalised to a 36mm-wide frame. */
  focalPxFromExif(exif, imageWidthPx){
    const w = Number(imageWidthPx);
    if (!(w > 0)) return null;
    const eq = Number(exif && (exif.FocalLengthIn35mmFormat || exif.FocalLengthIn35mmFilm));
    if (eq > 0) return w * eq / 36;
    /* Otherwise the real focal length and the sensor width are both needed, and a guessed sensor
       size would be a guessed answer wearing a decimal point. */
    const f = Number(exif && exif.FocalLength);
    const sw = Number(exif && (exif.SensorWidthMm || exif.FocalPlaneSensorWidth));
    if (f > 0 && sw > 0) return w * f / sw;
    return null;
  },

  centroid(pts){
    return { x: pts.reduce((n, p) => n + p.x, 0) / pts.length,
             y: pts.reduce((n, p) => n + p.y, 0) / pts.length };
  },

  /* ---- what the rest of the app asks it ---------------------------------------------------- */

  /* ==========================================================================================
     g200 — THE WALL AS A REAL PLANE IN SPACE, not a flat mapping.
     ==========================================================================================
     g190 places a piece correctly using the homography as a 2D projective map. Its size and
     perspective are right, but its third column is (0,0,1,0): anything sticking OUT of the wall
     contributes nothing to the screen, so a canvas's side faces collapse to a line and cannot be
     seen. That is the whole reason the 3D render never appeared on a calibrated wall.

     A homography of a PLANE carries more than the flat map, though, once the camera is known:

         H = K [ r1  r2  t ]

     where r1 and r2 are the wall's own axes in camera space, t is where its origin sits, and K is
     the camera. So r1 = K⁻¹h1 (normalised), r2 = K⁻¹h2 at the same scale, and the wall's NORMAL is
     r3 = r1 × r2 — the direction a canvas's depth actually runs. The calibration already stores
     the focal length that makes K, because g163 had to solve for it to measure the wall at all.

     WHAT THIS IS NOT: a general 3D engine. It recovers ONE plane's pose, which is exactly what a
     wall is, and hands back the numbers CSS needs to draw on it.

     REAL ROTATIONS ARE NOT GUARANTEED by the arithmetic. Click error means K⁻¹h1 and K⁻¹h2 are
     never exactly perpendicular or exactly equal in length, so the raw result is a near-rotation.
     It is ORTHONORMALISED (Gram-Schmidt) before use — an un-orthonormalised basis shears the piece
     slightly, which reads as a subtly wrong shape that is very hard to attribute.
     ========================================================================================== */
  /* ==========================================================================================
     g202 — AN ESTIMATED FOCAL LENGTH, AND WHY IT IS HONEST HERE.
     ==========================================================================================
     Kirk: "is that necessary for the 3d render as the image is shot with a large aperture and
     there is no visible difference with depth of field. i just need it to show thickness."

     TWO SEPARATE THINGS SHARE THE WORD. Aperture governs what is in focus. FOCAL LENGTH here
     governs how strongly the room CONVERGES — a wide lens makes near things much larger than far
     ones, a long lens flattens them. It is geometry, not blur, and nothing about his aperture
     tells us anything about it.

     WHAT ACTUALLY DEPENDS ON IT, and this is the part that makes an estimate defensible:
       - the piece's SIZE and PERSPECTIVE come from the homography and are EXACT without it;
       - only the DEPTH DIRECTION — which way a canvas's thickness runs, and how much of it shows —
         needs the camera.
     So a wrong-ish focal length gives slightly wrong foreshortening on a 1.5in edge. A MISSING one
     gives no edge at all, which is what he has been looking at for four builds.

     35mm-equivalent horizontal: f_px = (focal35 / 36) x imageWidth. 26mm is what most phones and
     the wide end of a kit zoom sit at, and it is the shot a room photograph usually is.
     THE ESTIMATE IS ALWAYS LABELLED AS ONE — a guessed number presented as measured is how a wrong
     answer survives for months (g163's whole reason for refusing to guess a sensor size).
     ========================================================================================== */
  estimateFocalPx(imageWidthPx, mm35){
    const w = Number(imageWidthPx);
    if (!(w > 0)) return 0;
    const f35 = Number(mm35) > 0 ? Number(mm35) : 26;
    return (f35 / 36) * w;
  },

  /* The common choices, in the words a photographer uses rather than a number he has to convert. */
  /* g203 — HIS KIT FIRST, THEN A CLIENT'S PHONE. Kirk: "i shot this with a 17mm lens, but most of
     the lenses i will use for interior shots will be 16mm. we would also need phone as an option
     and .6 or .5 so if i get a client image i can ask what they shot it with."
     THE PHONE ENTRIES ARE NAMED THE WAY THE PHONE NAMES THEM. Nobody answers "13 millimetres" when
     asked what they shot on — they say "the 0.5". The millimetres behind each are the 35mm
     equivalents those buttons actually correspond to on current phones: 1x ≈ 26, 0.6x ≈ 16,
     0.5x ≈ 13. Approximate by nature, which is fine: it is a starting point he can type over, and
     for a client's photograph it is the only thing anyone will be able to tell him. */
  FOCAL_CHOICES: [
    { mm: 16, name: 'My interior lens \u2014 16 mm' },
    { mm: 17, name: '17 mm' },
    { mm: 14, name: 'Ultra-wide \u2014 14 mm' },
    { mm: 24, name: 'Wide \u2014 24 mm' },
    { mm: 35, name: 'Standard \u2014 35 mm' },
    { mm: 50, name: 'Normal \u2014 50 mm' },
    { mm: 13, name: 'Phone, the 0.5 \u2014 about 13 mm' },
    { mm: 16, name: 'Phone, the 0.6 \u2014 about 16 mm' },
    { mm: 26, name: 'Phone, the main camera \u2014 about 26 mm' },
    { mm: 48, name: 'Phone, the 2x \u2014 about 48 mm' }
  ],

  pose(H, focalPx, principal){
    if (!H || !(focalPx > 0)) return null;
    const cx = (principal && principal.x) || 0, cy = (principal && principal.y) || 0;
    /* K⁻¹ applied to a column: undo the principal point, then the focal length. */
    const un = c => ({ x: (c.x - cx * c.z) / focalPx, y: (c.y - cy * c.z) / focalPx, z: c.z });
    const col = j => ({ x: H[0][j], y: H[1][j], z: H[2][j] });
    const a1 = un(col(0)), a2 = un(col(1)), a3 = un(col(2));

    const len = v => Math.hypot(v.x, v.y, v.z);
    const l1 = len(a1), l2 = len(a2);
    if (!(l1 > 1e-9) || !(l2 > 1e-9)) return null;
    /* One scale for both axes — the geometric mean, so neither axis is privileged when the two
       disagree slightly. A per-axis normalisation would stretch the piece along one direction. */
    const lambda = 1 / Math.sqrt(l1 * l2);

    const mul = (v, k) => ({ x: v.x * k, y: v.y * k, z: v.z * k });
    const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
    const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
    const norm = v => { const m = len(v); return m > 1e-12 ? mul(v, 1 / m) : null; };

    let r1 = norm(mul(a1, lambda));
    let r2raw = mul(a2, lambda);
    if (!r1 || !r2raw) return null;
    /* Gram-Schmidt: keep r1, take only the part of r2 perpendicular to it. */
    let r2 = norm(sub(r2raw, mul(r1, dot(r1, r2raw))));
    if (!r2) return null;
    const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
    let r3 = norm(cross(r1, r2));
    if (!r3) return null;

    const t = mul(a3, lambda);
    /* A plane behind the camera is a sign ambiguity in the decomposition, not a real answer:
       H and −H describe the same 2D map. Flip the whole pose so the wall is in front. */
    if (t.z < 0) { r1 = mul(r1, -1); r2 = mul(r2, -1); r3 = mul(r3, -1); t.x = -t.x; t.y = -t.y; t.z = -t.z; }
    /* The normal must point back towards the camera, or a canvas's depth would be built sticking
       out of the front of the wall. */
    if (r3.z > 0) r3 = mul(r3, -1);

    return { r1, r2, r3, t, focalPx, cx, cy,
      /* How far the wall's origin sits from the camera, in the wall's own units (inches). */
      distance: len(t) };
  },

  /* Project a point in WALL INCHES through a recovered pose, the way a pinhole camera does.
     Used to check the pose against the homography it came from — if the two disagree, the
     decomposition is wrong and everything drawn from it would be subtly off. */
  projectPose(pose, u, v, w){
    if (!pose) return null;
    const X = pose.r1.x * u + pose.r2.x * v + pose.r3.x * (w || 0) + pose.t.x;
    const Y = pose.r1.y * u + pose.r2.y * v + pose.r3.y * (w || 0) + pose.t.y;
    const Z = pose.r1.z * u + pose.r2.z * v + pose.r3.z * (w || 0) + pose.t.z;
    if (!(Math.abs(Z) > 1e-9)) return null;
    return { x: pose.cx + pose.focalPx * X / Z, y: pose.cy + pose.focalPx * Y / Z, depth: Z };
  },

  /* ==========================================================================================
     g200 — THE POSE AS A CSS TRANSFORM.
     ==========================================================================================
     CSS applies perspective about `perspective-origin` with the viewer at +z:

         screen = origin + (p - origin) / (1 - z/d)

     A pinhole camera gives `screen = c + f·X/Z`. Setting d = f, the perspective origin to the
     camera's principal point, and **z = f − Z**, the two become the same equation. That single
     substitution is what lets a real camera pose drive a CSS transform with no fudge factor:
     CSS z counts TOWARDS the viewer, camera depth counts AWAY, and f − Z converts between them.

     The element is laid out at its nominal pixel size and this matrix does the rest, so the piece's
     own children — the four side faces from g165 — are carried along in a space where the third
     axis is the WALL'S NORMAL. That is precisely what the g190 matrix could not express, and why
     the edges never appeared.
     ========================================================================================== */
  cssMatrix(pose, opts){
    if (!pose) return null;
    const o = opts || {};
    const wIn = Number(o.pieceWidthIn), hIn = Number(o.pieceHeightIn);
    const wPx = Number(o.elementWidthPx), hPx = Number(o.elementHeightPx);
    if (!(wIn > 0) || !(hIn > 0) || !(wPx > 0) || !(hPx > 0)) return null;
    /* Inches per element pixel. The element is a picture of the piece; the wall is measured in
       inches; this is the only place the two meet. */
    const sx = wIn / wPx, sy = hIn / hPx;

    const u0 = Number(o.leftIn) || 0;          /* the piece's left edge, in wall inches */
    const vTop = (Number(o.bottomIn) || 0) + hIn;   /* wall v runs UP, so the TOP is bottom + height */

    const r1 = pose.r1, r2 = pose.r2, r3 = pose.r3, t = pose.t, f = pose.focalPx;
    /* Local +x runs right along the wall; local +y runs DOWN the element, which is −v on the wall. */
    const cX = { x: r1.x * sx, y: r1.y * sx, z: r1.z * sx };
    const cY = { x: -r2.x * sy, y: -r2.y * sy, z: -r2.z * sy };
    /* Local +z is towards the viewer in CSS, so it maps to the normal already flipped to face the
       camera in pose(). Scaled like x, so a depth given in element pixels means the same inches. */
    const cZ = { x: r3.x * sx, y: r3.y * sx, z: r3.z * sx };
    /* Where the element's own (0,0) — its top-left — sits in camera space. */
    const O = {
      x: r1.x * u0 + r2.x * vTop + t.x,
      y: r1.y * u0 + r2.y * vTop + t.y,
      z: r1.z * u0 + r2.z * vTop + t.z
    };
    /* matrix3d is COLUMN-MAJOR, and the z row is negated because CSS z = f − Z. */
    const m = [
      cX.x, cX.y, -cX.z, 0,
      cY.x, cY.y, -cY.z, 0,
      cZ.x, cZ.y, -cZ.z, 0,
      pose.cx + O.x, pose.cy + O.y, f - O.z, 1
    ];
    return {
      transform: 'matrix3d(' + m.map(n => (Math.abs(n) < 1e-9 ? 0 : Number(n.toFixed(6)))).join(',') + ')',
      perspective: f,
      perspectiveOrigin: { x: pose.cx, y: pose.cy },
      /* A real depth in inches, expressed in the element pixels the faces are built from. */
      depthPxFor: inches => (Number(inches) || 0) / sx,
      matrix: m
    };
  },

  /* Apply the CSS pipeline exactly as a browser would, so the transform can be checked against the
     homography rather than trusted. */
  cssProject(css, x, y, z){
    const m = css.matrix, f = css.perspective;
    const X = m[0] * x + m[4] * y + m[8] * (z || 0) + m[12];
    const Y = m[1] * x + m[5] * y + m[9] * (z || 0) + m[13];
    const Z = m[2] * x + m[6] * y + m[10] * (z || 0) + m[14];
    const k = 1 - Z / f;
    if (!(Math.abs(k) > 1e-9)) return null;
    return { x: css.perspectiveOrigin.x + (X - css.perspectiveOrigin.x) / k,
             y: css.perspectiveOrigin.y + (Y - css.perspectiveOrigin.y) / k };
  },

  /* Inches-per-pixel AT A POINT on the wall. On a tilted wall this genuinely differs from one end
     to the other, which is the fact the old single `ppi` could not express. Measured by stepping
     one inch along the wall from that point and seeing how far that is in the picture. */
  ppiAt(sol, wallX, wallY){
    if (!sol || !sol.H3) return null;
    const a = this.apply(sol.H3, { x: wallX, y: wallY });
    const b = this.apply(sol.H3, { x: wallX + 1, y: wallY });
    if (!a || !b) return null;
    return Math.hypot(b.x - a.x, b.y - a.y);
  },
  /* A picture's four corners, in pixels, for a piece of known size hung at a known place. This is
     what lets a print be drawn ON the wall rather than pasted flat over it. */
  quadFor(sol, wallX, wallY, widthInches, heightInches){
    if (!sol || !sol.H3) return null;
    const pts = [{ x: wallX, y: wallY }, { x: wallX + widthInches, y: wallY },
      { x: wallX + widthInches, y: wallY + heightInches }, { x: wallX, y: wallY + heightInches }]
      .map(p => this.apply(sol.H3, p));
    return pts.some(p => !p) ? null : pts;
  }
};
