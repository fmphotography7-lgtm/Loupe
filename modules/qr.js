/* Minimal QR Code encoder — byte mode, error correction level M, versions 1..10.
   No dependencies. Returns a boolean matrix. Enough for any URL up to 213 bytes. */
(function (root) {
  'use strict';

  // Error-correction codewords per block, and number of blocks, versions 1..10,
  // for each correction level. Higher levels recover more of a damaged code,
  // which is what lets a logo sit over the middle of it.
  var ECC = {
    L: { bits: 1, per: [null,  7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
                  blk: [null,  1,  1,  1,  1,  1,  2,  2,  2,  2,  4] },
    M: { bits: 0, per: [null, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
                  blk: [null,  1,  1,  1,  2,  2,  4,  4,  4,  5,  5] },
    Q: { bits: 3, per: [null, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
                  blk: [null,  1,  1,  2,  2,  4,  4,  6,  6,  8,  8] },
    H: { bits: 2, per: [null, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
                  blk: [null,  1,  1,  2,  4,  4,  4,  5,  6,  8,  8] }
  };
  var MAX_VERSION = 10;

  function rawDataModules(ver) {
    var result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var n = Math.floor(ver / 7) + 2;
      result -= (25 * n - 10) * n - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }
  function totalCodewords(ver) { return Math.floor(rawDataModules(ver) / 8); }
  function dataCodewords(ver, ecl) { return totalCodewords(ver) - ecl.per[ver] * ecl.blk[ver]; }

  function alignPositions(ver) {
    if (ver === 1) return [];
    var n = Math.floor(ver / 7) + 2;
    var size = ver * 4 + 17;
    var step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    var out = [6];
    for (var pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
    return out;
  }

  // ---- Galois field GF(256), primitive polynomial 0x11D ----
  function gfMul(a, b) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((b >>> i) & 1) * a;
    }
    return z & 0xFF;
  }
  function rsGenerator(degree) {
    var result = [];
    for (var i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    var root = 1;
    for (var i2 = 0; i2 < degree; i2++) {
      for (var j = 0; j < result.length; j++) {
        result[j] = gfMul(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return result;
  }
  function rsRemainder(data, generator) {
    var result = generator.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ result.shift();
      result.push(0);
      generator.forEach(function (g, i) { result[i] ^= gfMul(g, factor); });
    });
    return result;
  }

  function utf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); }
      else if (c >= 0xD800 && c < 0xDC00 && i + 1 < str.length) {
        var c2 = str.charCodeAt(++i);
        var cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
        out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
      } else { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F)); }
    }
    return out;
  }

  function chooseVersion(byteLen, ecl) {
    for (var v = 1; v <= MAX_VERSION; v++) {
      var ccBits = v <= 9 ? 8 : 16;
      if (4 + ccBits + byteLen * 8 <= dataCodewords(v, ecl) * 8) return v;
    }
    return -1;
  }

  function buildCodewords(bytes, ver, ecl) {
    var bits = [];
    function push(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    push(4, 4);                          // byte mode
    push(bytes.length, ver <= 9 ? 8 : 16);
    bytes.forEach(function (b) { push(b, 8); });

    var capacity = dataCodewords(ver, ecl) * 8;
    push(0, Math.min(4, capacity - bits.length));
    push(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < capacity; pad ^= 0xEC ^ 0x11) push(pad, 8);

    var cw = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cw.push(b);
    }
    return cw;
  }

  function interleave(data, ver, ecl) {
    var numBlocks = ecl.blk[ver];
    var eccLen = ecl.per[ver];
    var rawCw = totalCodewords(ver);
    var numShort = numBlocks - rawCw % numBlocks;
    var shortLen = Math.floor(rawCw / numBlocks) - eccLen;

    var blocks = [], gen = rsGenerator(eccLen), k = 0;
    for (var i = 0; i < numBlocks; i++) {
      var len = shortLen + (i < numShort ? 0 : 1);
      var dat = data.slice(k, k + len);
      k += len;
      blocks.push({ data: dat, ecc: rsRemainder(dat, gen) });
    }

    var result = [];
    for (var i2 = 0; i2 < shortLen + 1; i2++) {
      for (var b = 0; b < blocks.length; b++) {
        if (i2 < shortLen || b >= numShort) result.push(blocks[b].data[i2]);
      }
    }
    for (var i3 = 0; i3 < eccLen; i3++) {
      for (var b2 = 0; b2 < blocks.length; b2++) result.push(blocks[b2].ecc[i3]);
    }
    return result;
  }

  function makeMatrix(ver) {
    var size = ver * 4 + 17, m = [], fn = [];
    for (var y = 0; y < size; y++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    return { size: size, m: m, fn: fn };
  }
  function setFn(g, x, y, val) {
    if (x < 0 || y < 0 || x >= g.size || y >= g.size) return;
    g.m[y][x] = val; g.fn[y][x] = true;
  }
  function drawFinder(g, cx, cy) {
    for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
      var d = Math.max(Math.abs(dx), Math.abs(dy));
      setFn(g, cx + dx, cy + dy, d !== 2 && d !== 4);
    }
  }
  function drawAlign(g, cx, cy) {
    for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
      setFn(g, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  function drawFunction(g, ver) {
    var size = g.size;
    for (var i = 0; i < size; i++) {
      setFn(g, 6, i, i % 2 === 0);
      setFn(g, i, 6, i % 2 === 0);
    }
    drawFinder(g, 3, 3); drawFinder(g, size - 4, 3); drawFinder(g, 3, size - 4);

    var pos = alignPositions(ver);
    for (var a = 0; a < pos.length; a++) for (var b = 0; b < pos.length; b++) {
      if ((a === 0 && b === 0) || (a === 0 && b === pos.length - 1) || (a === pos.length - 1 && b === 0)) continue;
      drawAlign(g, pos[a], pos[b]);
    }
    setFn(g, 8, size - 8, true); // dark module

    if (ver >= 7) {
      var rem = ver;
      for (var k = 0; k < 12; k++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var bits = ver << 12 | rem;
      for (var i2 = 0; i2 < 18; i2++) {
        var bit = ((bits >>> i2) & 1) !== 0;
        var aa = size - 11 + i2 % 3, bb = Math.floor(i2 / 3);
        setFn(g, aa, bb, bit); setFn(g, bb, aa, bit);
      }
    }
  }
  function drawFormat(g, mask, ecl) {
    var data = ecl.bits << 3 | mask;
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = (data << 10 | rem) ^ 0x5412;
    var size = g.size;
    for (var i2 = 0; i2 <= 5; i2++) setFn(g, 8, i2, ((bits >>> i2) & 1) !== 0);
    setFn(g, 8, 7, ((bits >>> 6) & 1) !== 0);
    setFn(g, 8, 8, ((bits >>> 7) & 1) !== 0);
    setFn(g, 7, 8, ((bits >>> 8) & 1) !== 0);
    for (var i3 = 9; i3 < 15; i3++) setFn(g, 14 - i3, 8, ((bits >>> i3) & 1) !== 0);
    for (var i4 = 0; i4 < 8; i4++) setFn(g, size - 1 - i4, 8, ((bits >>> i4) & 1) !== 0);
    for (var i5 = 8; i5 < 15; i5++) setFn(g, 8, size - 15 + i5, ((bits >>> i5) & 1) !== 0);
    setFn(g, 8, size - 8, true);
  }

  function drawCodewords(g, cw) {
    var size = g.size, i = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j;
          var upward = ((right + 1) & 2) === 0;
          var y = upward ? size - 1 - vert : vert;
          if (!g.fn[y][x] && i < cw.length * 8) {
            g.m[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
            i++;
          }
        }
      }
    }
  }
  function applyMask(g, mask) {
    for (var y = 0; y < g.size; y++) for (var x = 0; x < g.size; x++) {
      if (g.fn[y][x]) continue;
      var invert;
      switch (mask) {
        case 0: invert = (x + y) % 2 === 0; break;
        case 1: invert = y % 2 === 0; break;
        case 2: invert = x % 3 === 0; break;
        case 3: invert = (x + y) % 3 === 0; break;
        case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: invert = x * y % 2 + x * y % 3 === 0; break;
        case 6: invert = (x * y % 2 + x * y % 3) % 2 === 0; break;
        case 7: invert = ((x + y) % 2 + x * y % 3) % 2 === 0; break;
      }
      if (invert) g.m[y][x] = !g.m[y][x];
    }
  }

  function penalty(g) {
    var size = g.size, m = g.m, p = 0;
    var PN1 = 3, PN2 = 3, PN3 = 40, PN4 = 10;

    function addHistory(run, hist) {
      if (hist[0] === 0) run += size;      // light border counts as a run
      hist.pop(); hist.unshift(run);
    }
    function countPatterns(hist) {
      var n = hist[1];
      var core = n > 0 && hist[2] === n && hist[3] === n * 3 && hist[4] === n && hist[5] === n;
      return (core && hist[0] >= n * 4 && hist[6] >= n ? 1 : 0)
           + (core && hist[6] >= n * 4 && hist[0] >= n ? 1 : 0);
    }
    function terminate(colour, run, hist) {
      if (colour) { addHistory(run, hist); run = 0; }
      run += size;
      addHistory(run, hist);
      return countPatterns(hist);
    }

    for (var y = 0; y < size; y++) {
      var hist = [0, 0, 0, 0, 0, 0, 0], colour = false, run = 0;
      for (var x = 0; x < size; x++) {
        if (m[y][x] === colour) {
          run++;
          if (run === 5) p += PN1; else if (run > 5) p++;
        } else {
          addHistory(run, hist);
          if (!colour) p += countPatterns(hist) * PN3;
          colour = m[y][x]; run = 1;
        }
      }
      p += terminate(colour, run, hist) * PN3;
    }
    for (var x2 = 0; x2 < size; x2++) {
      var hist2 = [0, 0, 0, 0, 0, 0, 0], colour2 = false, run2 = 0;
      for (var y2 = 0; y2 < size; y2++) {
        if (m[y2][x2] === colour2) {
          run2++;
          if (run2 === 5) p += PN1; else if (run2 > 5) p++;
        } else {
          addHistory(run2, hist2);
          if (!colour2) p += countPatterns(hist2) * PN3;
          colour2 = m[y2][x2]; run2 = 1;
        }
      }
      p += terminate(colour2, run2, hist2) * PN3;
    }

    for (var y3 = 0; y3 < size - 1; y3++) for (var x3 = 0; x3 < size - 1; x3++) {
      var c = m[y3][x3];
      if (c === m[y3][x3 + 1] && c === m[y3 + 1][x3] && c === m[y3 + 1][x3 + 1]) p += PN2;
    }

    var dark = 0;
    for (var y4 = 0; y4 < size; y4++) for (var x4 = 0; x4 < size; x4++) if (m[y4][x4]) dark++;
    var total = size * size;
    for (var k = 0; dark * 20 < (9 - k) * total || dark * 20 > (11 + k) * total; k++) p += PN4;
    return p;
  }

  function encode(text, level) {
    var name = String(level || 'M').toUpperCase();
    var ecl = ECC[name];
    if (!ecl) throw new Error('Unknown error-correction level: ' + level);

    var bytes = utf8Bytes(String(text));
    var ver = chooseVersion(bytes.length, ecl);
    if (ver < 0) throw new Error('Too much data for a version-' + MAX_VERSION + ' QR code at level ' + name + ' (' + bytes.length + ' bytes).');
    var cw = interleave(buildCodewords(bytes, ver, ecl), ver, ecl);

    var best = null, bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      var g = makeMatrix(ver);
      drawFunction(g, ver);
      drawFormat(g, mask, ecl);
      drawCodewords(g, cw);
      applyMask(g, mask);
      drawFormat(g, mask, ecl);
      var s = penalty(g);
      if (s < bestScore) { bestScore = s; best = g; }
    }
    return { size: best.size, version: ver, level: name, modules: best.m };
  }

  // Largest byte payload that fits at each level, for callers that want to warn early.
  function capacity(level) {
    var ecl = ECC[String(level || 'M').toUpperCase()];
    if (!ecl) return 0;
    return dataCodewords(MAX_VERSION, ecl) - 3;
  }

  root.SFQR = { encode: encode, capacity: capacity, MAX_VERSION: MAX_VERSION, LEVELS: ['L', 'M', 'Q', 'H'] };
})(typeof window !== 'undefined' ? window : globalThis);
