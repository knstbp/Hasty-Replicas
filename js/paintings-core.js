/* ==========================================================================
   Paintings Core — Topological Geometric Faceted Vectorizer (16 Colors)
   Converts each masterpiece into a watertight, straight-edged polygonal /
   faceted vector illustration (matching the uploaded geometric vector
   reference styles) while preserving 100% accurate proportions & angles!
   Canvas coordinate space: 480 x 360 (4:3)
   ========================================================================== */

window.PAINTINGS = [];

window.CATEGORY_LABELS = {
  renaissance: '文藝復興',
  baroque: '巴洛克與洛可可',
  romanticism: '新古典、浪漫與寫實',
  impressionism: '印象派與梵谷'
};

window.ArtHelpers = {
  _imgCache: {},
  _renderedCache: {},

  hexToRgb(hex) {
    const clean = hex.replace('#', '');
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16)
    ];
  },

  rgbToHex(r, g, b) {
    return (
      '#' +
      [r, g, b]
        .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
    );
  },

  rgbToLab(r, g, b) {
    const pivotRgb = (n) => {
      const v = n / 255;
      return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
    };
    const R = pivotRgb(r);
    const G = pivotRgb(g);
    const B = pivotRgb(b);
    const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.00000;
    const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const pivotXyz = (n) => (n > 0.008856 ? Math.cbrt(n) : 7.787 * n + 16 / 116);
    const fx = pivotXyz(X);
    const fy = pivotXyz(Y);
    const fz = pivotXyz(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  },

  /**
   * Orders an array of [r, g, b] colors along a Chroma-Weighted CIELAB shortest
   * perceptual Hamiltonian path (Multi-start Nearest Neighbor + 2-opt Open TSP)
   * so colors of the same hue/chroma family are grouped together and transition
   * smoothly by lightness without alternating between different color families.
   */
  sortRgbBySimilarity(rgbList) {
    const n = rgbList.length;
    if (n <= 2) return rgbList.slice();

    const labs = rgbList.map(([r, g, b]) => this.rgbToLab(r, g, b));
    const dmat = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dL = labs[i][0] - labs[j][0];
        const da = labs[i][1] - labs[j][1];
        const db = labs[i][2] - labs[j][2];
        const d = Math.sqrt(0.45 * dL * dL + 2.4 * (da * da + db * db));
        dmat[i][j] = d;
        dmat[j][i] = d;
      }
    }

    const pathCost = (ord) => {
      let sum = 0;
      for (let k = 0; k < n - 1; k++) sum += dmat[ord[k]][ord[k + 1]];
      return sum;
    };

    let bestCost = Infinity;
    let bestOrder = null;

    for (let start = 0; start < n; start++) {
      const visited = new Uint8Array(n);
      visited[start] = 1;
      const order = [start];
      let curr = start;

      for (let step = 1; step < n; step++) {
        let bestNext = -1;
        let minD = Infinity;
        for (let cand = 0; cand < n; cand++) {
          if (!visited[cand] && dmat[curr][cand] < minD) {
            minD = dmat[curr][cand];
            bestNext = cand;
          }
        }
        visited[bestNext] = 1;
        order.push(bestNext);
        curr = bestNext;
      }

      // 2-opt open-path refinement (including reversing prefix/suffix endpoints)
      let improved = true;
      let curCost = pathCost(order);
      while (improved) {
        improved = false;
        for (let i = 0; i < n - 1; i++) {
          for (let j = i + 1; j < n; j++) {
            // Reverse segment order[i..j]
            let left = i;
            let right = j;
            while (left < right) {
              const tmp = order[left];
              order[left] = order[right];
              order[right] = tmp;
              left++;
              right--;
            }
            const newCost = pathCost(order);
            if (newCost + 1e-6 < curCost) {
              curCost = newCost;
              improved = true;
            } else {
              // Undo reversal
              left = i;
              right = j;
              while (left < right) {
                const tmp = order[left];
                order[left] = order[right];
                order[right] = tmp;
                left++;
                right--;
              }
            }
          }
        }
      }

      if (curCost < bestCost) {
        bestCost = curCost;
        bestOrder = order.slice();
      }
    }

    // Orient path so the darker endpoint comes first
    if (labs[bestOrder[0]][0] > labs[bestOrder[n - 1]][0]) {
      bestOrder.reverse();
    }

    return bestOrder.map((idx) => rgbList[idx]);
  },

  sortHexPaletteBySimilarity(hexList) {
    if (!Array.isArray(hexList) || hexList.length <= 2) return hexList;
    const uniqueHex = [];
    hexList.forEach((h) => {
      const up = String(h).toUpperCase();
      if (!uniqueHex.includes(up)) uniqueHex.push(up);
    });
    const rgbs = uniqueHex.map((h) => this.hexToRgb(h));
    const sortedRgbs = this.sortRgbBySimilarity(rgbs);
    return sortedRgbs.map(([r, g, b]) => this.rgbToHex(r, g, b));
  },

  getOriginalImageUrl(painting) {
    if (window.PAINTING_DATA_URLS && window.PAINTING_DATA_URLS[painting.id]) {
      return window.PAINTING_DATA_URLS[painting.id];
    }
    return `assets/paintings/${painting.id}.jpg`;
  },

  loadPaintingImage(painting) {
    const id = painting.id;
    if (this._imgCache[id] !== undefined) {
      return Promise.resolve(this._imgCache[id]);
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth > 20 && img.naturalHeight > 20) {
          this._imgCache[id] = img;
          resolve(img);
        } else {
          this._imgCache[id] = null;
          resolve(null);
        }
      };
      img.onerror = () => {
        this._imgCache[id] = null;
        resolve(null);
      };
      img.src = this.getOriginalImageUrl(painting);
    });
  },

  /**
   * Computes un-cropped canvas dimensions preserving the exact aspect ratio
   * of the original museum painting (multiples of 4 for clean evaluation grids).
   */
  getUncroppedDimensions(img, maxSide = 480) {
    const iw = img.naturalWidth || 480;
    const ih = img.naturalHeight || 360;
    const ratio = iw / ih;
    let w, h;
    if (ratio >= 1) {
      w = maxSide;
      h = Math.max(96, Math.round((maxSide / ratio) / 4) * 4);
    } else {
      h = maxSide;
      w = Math.max(96, Math.round((maxSide * ratio) / 4) * 4);
    }
    return { w, h, ratio: w / h };
  },

  /**
   * Draws the full original painting with ZERO cropping into (w x h).
   */
  drawFullImage(ctx, img, w, h) {
    ctx.drawImage(img, 0, 0, w, h);
  },

  /**
   * Edge-Preserving Bilateral Filter: flattens gradients into clean tonal planes
   * while keeping facial structure, eyes, nose bridge, lips & clothing folds crisp.
   */
  bilateralFilter(srcData, w, h, radius, sigmaColor) {
    const out = new Uint8ClampedArray(srcData.length);
    const lut = new Float32Array(766);
    const denom = 2 * sigmaColor * sigmaColor * 3;
    for (let d = 0; d < 766; d++) {
      lut[d] = Math.exp(-(d * d) / denom);
    }

    const offsets = [];
    const step = radius >= 4 ? 2 : 1;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist2 = dx * dx + dy * dy;
        if (dist2 > radius * radius) continue;
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
          offsets.push([dx, dy, Math.exp(-dist2 / (2 * radius * radius))]);
        } else if (dx % step === 0 && dy % step === 0) {
          offsets.push([dx, dy, Math.exp(-dist2 / (2 * radius * radius))]);
        }
      }
    }
    const oLen = offsets.length;

    for (let y = 0; y < h; y++) {
      const rowOff = y * w;
      for (let x = 0; x < w; x++) {
        const cIdx = (rowOff + x) * 4;
        const cr = srcData[cIdx], cg = srcData[cIdx + 1], cb = srcData[cIdx + 2];

        let sumR = 0, sumG = 0, sumB = 0, sumW = 0;
        for (let k = 0; k < oLen; k++) {
          const nx = x + offsets[k][0];
          const ny = y + offsets[k][1];
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const nIdx = (ny * w + nx) * 4;
          const nr = srcData[nIdx], ng = srcData[nIdx + 1], nb = srcData[nIdx + 2];
          const cDiff = Math.abs(nr - cr) + Math.abs(ng - cg) + Math.abs(nb - cb);
          const wt = offsets[k][2] * lut[cDiff];
          sumR += nr * wt;
          sumG += ng * wt;
          sumB += nb * wt;
          sumW += wt;
        }
        out[cIdx] = Math.round(sumR / sumW);
        out[cIdx + 1] = Math.round(sumG / sumW);
        out[cIdx + 2] = Math.round(sumB / sumW);
        out[cIdx + 3] = 255;
      }
    }
    return out;
  },

  /**
   * Salience-weighted 16-color K-means palette extraction.
   */
  extractPalette16(data, w, h) {
    const k = 16;
    const minSeedDist = 440;
    const samples = [];
    const weights = [];

    const cx = w * 0.5;
    const cy = h * 0.42;
    const rx = w * 0.36;
    const ry = h * 0.38;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];

        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const centerBoost = Math.exp(-(dx * dx + dy * dy) * 0.65) * 1.45;

        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const chromaBoost = ((maxC - minC) / 255) * 2.4;
        const redAccentBoost = r - g > 26 && r > 90 ? 1.5 : 0;

        const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        const extremeBoost = lum > 0.75 || lum < 0.14 ? 0.85 : 0;

        samples.push([r, g, b]);
        weights.push(1.0 + centerBoost + chromaBoost + redAccentBoost + extremeBoost);
      }
    }

    const sLen = samples.length;
    let avgR = 0, avgG = 0, avgB = 0, totalW = 0;
    for (let i = 0; i < sLen; i++) {
      const wt = weights[i];
      avgR += samples[i][0] * wt;
      avgG += samples[i][1] * wt;
      avgB += samples[i][2] * wt;
      totalW += wt;
    }
    avgR /= totalW;
    avgG /= totalW;
    avgB /= totalW;

    const centroids = [];
    let firstIdx = 0, bestScore = -1;
    for (let i = 0; i < sLen; i++) {
      const dr = samples[i][0] - avgR;
      const dg = samples[i][1] - avgG;
      const db = samples[i][2] - avgB;
      const d = (2 * dr * dr + 4 * dg * dg + 3 * db * db) * (0.65 + 0.35 * weights[i]);
      if (d > bestScore) { bestScore = d; firstIdx = i; }
    }
    centroids.push([...samples[firstIdx]]);

    while (centroids.length < k) {
      let bestIdx = -1, bestScoreVal = -1, bestRawDist = 0;
      for (let i = 0; i < sLen; i += 2) {
        let minD = Infinity;
        for (let c = 0; c < centroids.length; c++) {
          const dr = samples[i][0] - centroids[c][0];
          const dg = samples[i][1] - centroids[c][1];
          const db = samples[i][2] - centroids[c][2];
          const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
          if (d < minD) minD = d;
        }
        const score = minD * (0.58 + 0.42 * weights[i]);
        if (score > bestScoreVal) {
          bestScoreVal = score;
          bestRawDist = minD;
          bestIdx = i;
        }
      }
      if (bestIdx === -1 || bestRawDist < minSeedDist) break;
      centroids.push([...samples[bestIdx]]);
    }

    const actualK = centroids.length;
    const sums = Array.from({ length: actualK }, () => [0, 0, 0, 0]);
    for (let iter = 0; iter < 9; iter++) {
      for (let c = 0; c < actualK; c++) sums[c][0] = sums[c][1] = sums[c][2] = sums[c][3] = 0;
      for (let i = 0; i < sLen; i++) {
        const s = samples[i];
        const wt = weights[i];
        let bestC = 0, bestD = Infinity;
        for (let c = 0; c < actualK; c++) {
          const dr = s[0] - centroids[c][0];
          const dg = s[1] - centroids[c][1];
          const db = s[2] - centroids[c][2];
          const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
          if (d < bestD) { bestD = d; bestC = c; }
        }
        sums[bestC][0] += s[0] * wt;
        sums[bestC][1] += s[1] * wt;
        sums[bestC][2] += s[2] * wt;
        sums[bestC][3] += wt;
      }
      for (let c = 0; c < actualK; c++) {
        if (sums[c][3] > 0) {
          centroids[c][0] = Math.round(sums[c][0] / sums[c][3]);
          centroids[c][1] = Math.round(sums[c][1] / sums[c][3]);
          centroids[c][2] = Math.round(sums[c][2] / sums[c][3]);
        }
      }
    }

    const uniqueHex = [];
    centroids.forEach(([r, g, b]) => {
      const h = this.rgbToHex(r, g, b);
      if (!uniqueHex.includes(h)) uniqueHex.push(h);
    });
    return this.sortHexPaletteBySimilarity(uniqueHex);
  },

  quantizeDataToIndices(data, palRgb) {
    const total = data.length / 4;
    const indices = new Uint8Array(total);
    const pLen = palRgb.length;

    for (let i = 0; i < total; i++) {
      const off = i * 4;
      const r = data[off], g = data[off + 1], b = data[off + 2];
      let bestIdx = 0, bestDist = Infinity;
      for (let p = 0; p < pLen; p++) {
        const dr = r - palRgb[p][0];
        const dg = g - palRgb[p][1];
        const db = b - palRgb[p][2];
        const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = p;
          if (d === 0) break;
        }
      }
      indices[i] = bestIdx;
    }
    return indices;
  },

  /**
   * Connected-component labeling + progressive small-island absorption:
   * Eliminates fragmented micro-blocks and low-contrast transition slivers
   * into bold geometric facets while preserving high-contrast focal features
   * (eye pupils, catchlights, eyebrows, lips, pearl earring).
   */
  buildCleanRegions(idxMap, w, h, palRgb) {
    const total = w * h;
    let workIdx = new Uint8Array(idxMap);
    const areaScale = Math.max(0.45, (w * h) / 18000);

    const colorDistSq = (c1, c2) => {
      if (!palRgb || !palRgb[c1] || !palRgb[c2]) return 1000;
      const dr = palRgb[c1][0] - palRgb[c2][0];
      const dg = palRgb[c1][1] - palRgb[c2][1];
      const db = palRgb[c1][2] - palRgb[c2][2];
      return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    };

    // 1. Two passes of 3x3 majority-vote smoothing to eliminate 1px jagged teeth & thin 1px contour threads
    for (let mPass = 0; mPass < 2; mPass++) {
      const nextIdx = new Uint8Array(workIdx);
      const counts = new Uint8Array(32);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          const c = workIdx[i];
          const same4 =
            (workIdx[i - 1] === c ? 1 : 0) +
            (workIdx[i + 1] === c ? 1 : 0) +
            (workIdx[i - w] === c ? 1 : 0) +
            (workIdx[i + w] === c ? 1 : 0);
          if (same4 <= 1) {
            counts.fill(0);
            let bestNC = c;
            let bestCnt = 0;
            for (let dy = -1; dy <= 1; dy++) {
              const row = (y + dy) * w;
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nc = workIdx[row + x + dx];
                const cnt = ++counts[nc];
                if (cnt > bestCnt) {
                  bestCnt = cnt;
                  bestNC = nc;
                }
              }
            }
            if (bestCnt >= 5) {
              nextIdx[i] = bestNC;
            }
          }
        }
      }
      workIdx = nextIdx;
    }

    // 2. Progressive multi-pass small-island absorption (smallest first: 4 -> 10 -> 20 -> 35 -> 55 px)
    const baseThresholds = [4, 10, 20, 35, 55];
    const minFeaturePx = Math.max(3, Math.round(4 * areaScale));
    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    const neighborCounts = new Uint16Array(32);

    for (let pass = 0; pass < baseThresholds.length; pass++) {
      const thresh = Math.max(3, Math.round(baseThresholds[pass] * areaScale));
      visited.fill(0);

      for (let i = 0; i < total; i++) {
        if (visited[i]) continue;
        const color = workIdx[i];
        let head = 0, tail = 0;
        queue[tail++] = i;
        visited[i] = 1;

        while (head < tail) {
          const curr = queue[head++];
          const cx = curr % w;
          const cy = (curr / w) | 0;
          if (cx > 0) {
            const n = curr - 1;
            if (!visited[n] && workIdx[n] === color) { visited[n] = 1; queue[tail++] = n; }
          }
          if (cx + 1 < w) {
            const n = curr + 1;
            if (!visited[n] && workIdx[n] === color) { visited[n] = 1; queue[tail++] = n; }
          }
          if (cy > 0) {
            const n = curr - w;
            if (!visited[n] && workIdx[n] === color) { visited[n] = 1; queue[tail++] = n; }
          }
          if (cy + 1 < h) {
            const n = curr + w;
            if (!visited[n] && workIdx[n] === color) { visited[n] = 1; queue[tail++] = n; }
          }
        }

        if (tail > thresh) continue;

        // Count boundary contacts with neighboring palette colors
        neighborCounts.fill(0);
        let hasNeighbor = false;
        for (let k = 0; k < tail; k++) {
          const curr = queue[k];
          const cx = curr % w;
          const cy = (curr / w) | 0;
          if (cx > 0) {
            const nc = workIdx[curr - 1];
            if (nc !== color) { neighborCounts[nc]++; hasNeighbor = true; }
          }
          if (cx + 1 < w) {
            const nc = workIdx[curr + 1];
            if (nc !== color) { neighborCounts[nc]++; hasNeighbor = true; }
          }
          if (cy > 0) {
            const nc = workIdx[curr - w];
            if (nc !== color) { neighborCounts[nc]++; hasNeighbor = true; }
          }
          if (cy + 1 < h) {
            const nc = workIdx[curr + w];
            if (nc !== color) { neighborCounts[nc]++; hasNeighbor = true; }
          }
        }
        if (!hasNeighbor) continue;

        // Pick neighbor balancing color similarity and shared border length
        let bestNColor = color;
        let bestScore = Infinity;
        for (let nc = 0; nc < 32; nc++) {
          const cnt = neighborCounts[nc];
          if (cnt === 0) continue;
          const cDist = colorDistSq(color, nc);
          const score = cDist / (1 + 0.38 * cnt);
          if (score < bestScore) {
            bestScore = score;
            bestNColor = nc;
          }
        }

        if (bestNColor === color) continue;

        const sx = (i % w) / w;
        const sy = ((i / w) | 0) / h;
        const inFaceZone = sx > 0.25 && sx < 0.75 && sy > 0.14 && sy < 0.68;
        const minCdist = colorDistSq(color, bestNColor);

        // Preserve intentional facial features (eyes, eyebrows, pearl highlight, lips)
        if (inFaceZone && tail > minFeaturePx && minCdist > 1500) {
          continue;
        }

        const faceMaxThresh = Math.max(minFeaturePx, Math.round(11 * areaScale));
        const effThresh = inFaceZone ? Math.min(faceMaxThresh, Math.round(thresh * 0.5)) : thresh;
        if (tail <= effThresh) {
          for (let k = 0; k < tail; k++) workIdx[queue[k]] = bestNColor;
        }
      }
    }

    // Final connected components labeling
    const regMap = new Int32Array(total).fill(-1);
    const regions = [];

    for (let i = 0; i < total; i++) {
      if (regMap[i] !== -1) continue;
      const regId = regions.length;
      const color = workIdx[i];
      let head = 0, tail = 0;
      queue[tail++] = i;
      regMap[i] = regId;
      const pixels = [];

      while (head < tail) {
        const curr = queue[head++];
        pixels.push(curr);
        const cx = curr % w;
        const cy = (curr / w) | 0;
        if (cx > 0 && regMap[curr - 1] === -1 && workIdx[curr - 1] === color) {
          regMap[curr - 1] = regId; queue[tail++] = curr - 1;
        }
        if (cx + 1 < w && regMap[curr + 1] === -1 && workIdx[curr + 1] === color) {
          regMap[curr + 1] = regId; queue[tail++] = curr + 1;
        }
        if (cy > 0 && regMap[curr - w] === -1 && workIdx[curr - w] === color) {
          regMap[curr - w] = regId; queue[tail++] = curr - w;
        }
        if (cy + 1 < h && regMap[curr + w] === -1 && workIdx[curr + w] === color) {
          regMap[curr + w] = regId; queue[tail++] = curr + w;
        }
      }
      regions.push({ id: regId, colorIdx: color, pixels });
    }

    return { regMap, regions };
  },

  /**
   * Ramer-Douglas-Peucker straight-line simplification on a chain of [x, y] vertices.
   */
  rdpSimplify(pts, epsilon) {
    const n = pts.length;
    if (n <= 2) return pts;

    const x1 = pts[0][0], y1 = pts[0][1];
    const x2 = pts[n - 1][0], y2 = pts[n - 1][1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    let maxDist = -1;
    let maxIdx = 0;
    for (let i = 1; i < n - 1; i++) {
      const px = pts[i][0], py = pts[i][1];
      let d;
      if (lenSq === 0) {
        d = Math.hypot(px - x1, py - y1);
      } else {
        d = Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / Math.sqrt(lenSq);
      }
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }

    if (maxDist > epsilon) {
      const left = this.rdpSimplify(pts.slice(0, maxIdx + 1), epsilon);
      const right = this.rdpSimplify(pts.slice(maxIdx), epsilon);
      return left.slice(0, -1).concat(right);
    }
    return [pts[0], pts[n - 1]];
  },

  /**
   * TOPOLOGICAL STRAIGHT-LINE POLYGON VECTORIZER:
   * Traces every region's exact boundary loops, splits them at topological junctions
   * (where >= 3 regions meet), and simplifies each shared boundary chain canonically
   * into crisp, angular straight-line vector facets (ZERO gaps, ZERO wobbly blobs!).
   */
  vectorizeRegionsToPolygons(regMap, regions, w, h) {
    const vw = w + 1;
    const vh = h + 1;
    const isJunction = new Uint8Array(vw * vh);

    const getReg = (x, y) => (x < 0 || x >= w || y < 0 || y >= h ? -1 : regMap[y * w + x]);

    // 1. Identify topological junction vertices (degree >= 3 active boundary edges or canvas corners)
    for (let vy = 0; vy <= h; vy++) {
      for (let vx = 0; vx <= w; vx++) {
        const rTL = getReg(vx - 1, vy - 1);
        const rTR = getReg(vx, vy - 1);
        const rBL = getReg(vx - 1, vy);
        const rBR = getReg(vx, vy);

        let deg = 0;
        if (vy > 0 && rTL !== rTR) deg++;
        if (vy < h && rBL !== rBR) deg++;
        if (vx > 0 && rTL !== rBL) deg++;
        if (vx < w && rTR !== rBR) deg++;

        if (deg >= 3 || ((vx === 0 || vx === w) && (vy === 0 || vy === h))) {
          isJunction[vy * vw + vx] = 1;
        }
      }
    }

    // Helper: canonicalize & simplify a chain between two junctions so both sharing regions get identical lines!
    const chainCache = new Map();
    const simplifyCanonicalChain = (chain) => {
      const len = chain.length;
      if (len <= 2) return chain;
      const vFirst = chain[0][1] * vw + chain[0][0];
      const vLast = chain[len - 1][1] * vw + chain[len - 1][0];
      const vSec = chain[1][1] * vw + chain[1][0];
      const vPen = chain[len - 2][1] * vw + chain[len - 2][0];

      const reverse = vFirst > vLast || (vFirst === vLast && vSec > vPen);
      const key = reverse
        ? `${vLast}_${vFirst}_${vPen}_${vSec}_${len}`
        : `${vFirst}_${vLast}_${vSec}_${vPen}_${len}`;

      const cached = chainCache.get(key);
      if (cached) {
        return reverse ? [...cached].reverse() : cached;
      }

      const ordered = reverse ? [...chain].reverse() : chain;
      // Adaptive facet length: sharper facets on face/eyes, bolder facets on clothing & background!
      const mid = ordered[len >> 1];
      const mx = mid[0] / w;
      const my = mid[1] / h;
      const inFace = mx > 0.26 && mx < 0.74 && my > 0.14 && my < 0.64;
      const eps = len <= 6 ? 0.9 : inFace ? 1.55 : 2.9;

      const simp = this.rdpSimplify(ordered, eps);
      chainCache.set(key, simp);
      return reverse ? [...simp].reverse() : simp;
    };

    // 2. For each region, extract directed boundary edges and link into closed loops
    // Directions: 0 = Right (+x), 1 = Down (+y), 2 = Left (-x), 3 = Up (-y)
    const dirDx = [1, 0, -1, 0];
    const dirDy = [0, 1, 0, -1];

    const regionPolys = [];

    for (let rIdx = 0; rIdx < regions.length; rIdx++) {
      const reg = regions[rIdx];
      const rId = reg.id;
      const pList = reg.pixels;

      // Map from startVertexId -> bitmask of available outgoing directions (0..3)
      const outEdges = new Map();
      const addEdge = (vx, vy, dir) => {
        const vid = vy * vw + vx;
        outEdges.set(vid, (outEdges.get(vid) || 0) | (1 << dir));
      };

      for (let i = 0; i < pList.length; i++) {
        const p = pList[i];
        const px = p % w;
        const py = (p / w) | 0;
        if (getReg(px, py - 1) !== rId) addEdge(px, py, 0); // Top -> Right
        if (getReg(px + 1, py) !== rId) addEdge(px + 1, py, 1); // Right -> Down
        if (getReg(px, py + 1) !== rId) addEdge(px + 1, py + 1, 2); // Bottom -> Left
        if (getReg(px - 1, py) !== rId) addEdge(px, py + 1, 3); // Left -> Up
      }

      const loops = [];
      for (const [startVid, mask] of outEdges.entries()) {
        let curMask = mask;
        while (curMask !== 0) {
          let startDir = 0;
          while ((curMask & (1 << startDir)) === 0) startDir++;

          // Trace one closed loop
          const loop = [];
          let currVid = startVid;
          let dir = startDir;

          while (true) {
            const m = outEdges.get(currVid) || 0;
            if ((m & (1 << dir)) === 0) break;
            outEdges.set(currVid, m & ~(1 << dir));

            const vx = currVid % vw;
            const vy = (currVid / vw) | 0;
            loop.push([vx, vy]);

            const nx = vx + dirDx[dir];
            const ny = vy + dirDy[dir];
            const nextVid = ny * vw + nx;
            const nextMask = outEdges.get(nextVid) || 0;
            if (nextMask === 0) break;

            // Priority: right turn (clockwise around R) -> straight -> left turn
            const tryDirs = [(dir + 1) & 3, dir, (dir + 3) & 3, (dir + 2) & 3];
            let nextDir = -1;
            for (let td = 0; td < 4; td++) {
              if (nextMask & (1 << tryDirs[td])) {
                nextDir = tryDirs[td];
                break;
              }
            }
            if (nextDir === -1) break;
            currVid = nextVid;
            dir = nextDir;
            if (currVid === startVid && dir === startDir) break;
          }

          if (loop.length >= 3) {
            // Find junction indices along loop
            const jIndices = [];
            for (let i = 0; i < loop.length; i++) {
              const vid = loop[i][1] * vw + loop[i][0];
              if (isJunction[vid]) jIndices.push(i);
            }

            // If loop has < 2 junctions (isolated island loop), pick 2 canonical opposite vertices
            if (jIndices.length < 2) {
              let minIdx = 0, minVid = Infinity;
              for (let i = 0; i < loop.length; i++) {
                const vid = loop[i][1] * vw + loop[i][0];
                if (vid < minVid) { minVid = vid; minIdx = i; }
              }
              const oppIdx = (minIdx + (loop.length >> 1)) % loop.length;
              jIndices.length = 0;
              jIndices.push(Math.min(minIdx, oppIdx), Math.max(minIdx, oppIdx));
            }

            // Simplify each chain between consecutive junctions canonically
            const simplifiedLoop = [];
            const jCount = jIndices.length;
            for (let j = 0; j < jCount; j++) {
              const idxA = jIndices[j];
              const idxB = jIndices[(j + 1) % jCount];
              const chain = [];
              let k = idxA;
              while (true) {
                chain.push(loop[k]);
                if (k === idxB) break;
                k = (k + 1) % loop.length;
              }
              const simpChain = simplifyCanonicalChain(chain);
              for (let s = 0; s < simpChain.length - 1; s++) {
                simplifiedLoop.push(simpChain[s]);
              }
            }

            if (simplifiedLoop.length >= 3) {
              loops.push(simplifiedLoop);
            }
          }

          curMask = outEdges.get(startVid) || 0;
        }
      }

      if (loops.length > 0) {
        regionPolys.push({ colorIdx: reg.colorIdx, loops });
      }
    }

    return regionPolys;
  },

  quantizeCanvasToPalette(ctx, w, h, palette) {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const palRgb = palette.map(this.hexToRgb);
    const indices = this.quantizeDataToIndices(data, palRgb);

    for (let i = 0; i < indices.length; i++) {
      const rgb = palRgb[indices[i]];
      const off = i * 4;
      data[off] = rgb[0];
      data[off + 1] = rgb[1];
      data[off + 2] = rgb[2];
      data[off + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  },

  /**
   * Renders the painting as a crisp, straight-edged Geometric Faceted Vector Illustration
   * preserving 100% of the original painting's aspect ratio with ZERO cropping!
   */
  async renderMasterpieceAsync(painting, targetCanvas, maxSide = 480) {
    const img = await this.loadPaintingImage(painting);

    if (img) {
      const dims = this.getUncroppedDimensions(img, maxSide);
      const w = dims.w;
      const h = dims.h;
      if (targetCanvas.width !== w || targetCanvas.height !== h) {
        targetCanvas.width = w;
        targetCanvas.height = h;
      }

      const cacheKey = `${painting.id}_geovec16_clean_${w}x${h}`;
      if (this._renderedCache[cacheKey]) {
        const cached = this._renderedCache[cacheKey];
        const ctx = targetCanvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(cached.canvas, 0, 0);
        painting.activePalette = cached.palette;
        if (maxSide >= 400) {
          if (cached.facets) painting.facets = cached.facets;
          painting.canvasW = w;
          painting.canvasH = h;
        }
        return cached.palette;
      }

      try {
        const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
        const WW = Math.max(80, Math.round(w / 3));
        const WH = Math.max(80, Math.round(h / 3));
        const workCanvas = document.createElement('canvas');
        workCanvas.width = WW;
        workCanvas.height = WH;
        const wCtx = workCanvas.getContext('2d', { willReadFrequently: true });

        wCtx.filter = 'contrast(1.16) saturate(1.26) brightness(1.03)';
        this.drawFullImage(wCtx, img, WW, WH);
        wCtx.filter = 'none';

        // Edge-preserving bilateral passes flatten noise into clean tonal regions
        let buf = wCtx.getImageData(0, 0, WW, WH).data;
        buf = this.bilateralFilter(buf, WW, WH, 4, 42);
        buf = this.bilateralFilter(buf, WW, WH, 3, 34);

        const activePalette = this.extractPalette16(buf, WW, WH);
        const palRgb = activePalette.map(this.hexToRgb);
        const idxMap = this.quantizeDataToIndices(buf, palRgb);

        // Connected components & topological straight-line polygon vectorization!
        const { regMap, regions } = this.buildCleanRegions(idxMap, WW, WH, palRgb);
        const regionPolys = this.vectorizeRegionsToPolygons(regMap, regions, WW, WH);

        const sx = w / WW;
        const sy = h / WH;
        ctx.save();
        ctx.fillStyle = activePalette[0];
        ctx.fillRect(0, 0, w, h);

        for (let i = 0; i < regionPolys.length; i++) {
          const rp = regionPolys[i];
          const hex = activePalette[rp.colorIdx];
          ctx.fillStyle = hex;
          ctx.strokeStyle = hex;
          ctx.lineWidth = 0.8;
          ctx.lineJoin = 'bevel';
          ctx.beginPath();
          for (let l = 0; l < rp.loops.length; l++) {
            const loop = rp.loops[l];
            ctx.moveTo(loop[0][0] * sx, loop[0][1] * sy);
            for (let k = 1; k < loop.length; k++) {
              ctx.lineTo(loop[k][0] * sx, loop[k][1] * sy);
            }
            ctx.closePath();
          }
          ctx.fill('evenodd');
          ctx.stroke();
        }
        ctx.restore();

        // Snap 1px anti-aliased edge pixels strictly to the 16-color palette
        this.quantizeCanvasToPalette(ctx, w, h, activePalette);

        const cacheCanvas = document.createElement('canvas');
        cacheCanvas.width = w;
        cacheCanvas.height = h;
        cacheCanvas.getContext('2d').drawImage(targetCanvas, 0, 0);
        this._renderedCache[cacheKey] = {
          canvas: cacheCanvas,
          palette: activePalette,
          facets: regionPolys.length
        };

        painting.activePalette = activePalette;
        if (maxSide >= 400) {
          painting.facets = regionPolys.length;
          painting.canvasW = w;
          painting.canvasH = h;
        }
        return activePalette;
      } catch (e) {
        console.warn('Vectorizer fallback:', e);
      }
    }

    painting.canvasW = targetCanvas.width;
    painting.canvasH = targetCanvas.height;
    return this.renderMasterpiece(painting, targetCanvas);
  },

  // ==================== FALLBACK VECTOR PRIMITIVES ====================
  bg(ctx, color) { ctx.fillStyle = color; ctx.fillRect(0, 0, 480, 360); },
  rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); },
  roundRect(ctx, x, y, w, h, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); },
  circle(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); },
  ring(ctx, x, y, r, width, color) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); },
  arc(ctx, x, y, r, a1, a2, width, color) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, r, a1, a2); ctx.stroke(); },
  ellipse(ctx, x, y, rx, ry, color, rot = 0) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill(); },
  poly(ctx, pts, color) {
    if (pts.length < 3) return;
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fill();
  },
  line(ctx, x1, y1, x2, y2, width, color) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); },
  curve(ctx, pts, width, color) {
    if (pts.length < 2) return;
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); ctx.stroke();
  },
  waveFill(ctx, yBase, amp, freq, phase, color, bottomY = 360) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, bottomY);
    for (let x = 0; x <= 480; x += 12) ctx.lineTo(x, yBase + Math.sin((x / 480) * Math.PI * 2 * freq + phase) * amp);
    ctx.lineTo(480, bottomY); ctx.closePath(); ctx.fill();
  },
  skyBands(ctx, yTop, yBot, colors) {
    const h = (yBot - yTop) / colors.length;
    colors.forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(0, yTop + i * h, 480, Math.ceil(h) + 1); });
  },
  face(ctx, x, y, rx, ry, tier, opts) {
    this.ellipse(ctx, x, y, rx, ry, opts.skin);
    this.circle(ctx, x - rx * 0.35, y - ry * 0.08, Math.max(3, rx * 0.12), opts.eyeCol);
    this.circle(ctx, x + rx * 0.35, y - ry * 0.08, Math.max(3, rx * 0.12), opts.eyeCol);
    this.ellipse(ctx, x, y + ry * 0.5, rx * 0.3, Math.max(3, ry * 0.08), opts.lipCol);
  },
  miniPerson(ctx, x, y, s, coatCol, skinCol, hairCol) {
    this.ellipse(ctx, x, y + 36 * s, 18 * s, 30 * s, coatCol);
    this.circle(ctx, x, y - 8 * s, 11 * s, skinCol);
    this.ellipse(ctx, x, y - 14 * s, 12 * s, 6 * s, hairCol);
  },
  brushDashes(ctx, pts, len, w, color) {
    pts.forEach(([px, py]) => this.line(ctx, px - len / 2, py, px + len / 2, py, w, color));
  },

  renderMasterpiece(painting, targetCanvas) {
    const w = targetCanvas.width;
    const h = targetCanvas.height;
    const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.scale(w / 480, h / 360);
    if (painting.draw) painting.draw(ctx, this, painting.palette, 3);
    ctx.restore();
    this.quantizeCanvasToPalette(ctx, w, h, painting.palette);
    painting.activePalette = painting.palette;
    return painting.palette;
  }
};
