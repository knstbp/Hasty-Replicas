/* ==========================================================================
   GitHub Repository Cloud Leaderboard Engine (data/leaderboard.json)
   Repository: https://github.com/knstbp/Hasty-Replicas
   Supports:
   1. Live read from GitHub Contents API / Raw GitHub / local data/leaderboard.json
   2. Direct automatic commit to GitHub repo `data/leaderboard.json` via Fine-Grained
      PAT (or shared `#sync=` link fragment so players need zero setup!)
   3. One-click GitHub Actions Issue auto-bot fallback (`.github/workflows/leaderboard.yml`)
   ========================================================================== */

(function () {
  const REPO_OWNER = 'knstbp';
  const REPO_NAME = 'Hasty-Replicas';
  const FILE_PATH = 'data/leaderboard.json';

  const LS_PLAYER_NAME = 'hasty_replicas_player_name_v1';
  const LS_GH_TOKEN = 'hasty_replicas_gh_sync_token_v1';
  const LS_LOCAL_CACHE = 'hasty_replicas_leaderboard_cache_v1';

  const DEFAULT_ENTRIES = [
    {
      id: 'seed-1',
      player: '維梅爾學徒',
      paintingId: 'pearl-earring',
      paintingTitle: '戴珍珠耳環的少女',
      accuracy: 86.4,
      rank: 'S',
      timeUsed: 168,
      date: '2026-11-20'
    },
    {
      id: 'seed-2',
      player: '阿爾勒畫室',
      paintingId: 'van-gogh-bandaged',
      paintingTitle: '包紮耳朵的自畫像',
      accuracy: 82.1,
      rank: 'A',
      timeUsed: 175,
      date: '2026-11-20'
    },
    {
      id: 'seed-3',
      player: '佛羅倫斯工坊',
      paintingId: 'mona-lisa',
      paintingTitle: '蒙娜麗莎',
      accuracy: 79.5,
      rank: 'A',
      timeUsed: 162,
      date: '2026-11-20'
    }
  ];

  // Auto-import `#sync=<base64_token>` from shared URL hash so players don't need manual setup
  function checkUrlHashToken() {
    try {
      const hash = window.location.hash || '';
      const m = hash.match(/[#&]sync=([A-Za-z0-9+/=_-]+)/);
      if (m && m[1]) {
        const decoded = atob(m[1].replace(/-/g, '+').replace(/_/g, '/')).trim();
        if (decoded && (decoded.startsWith('github_pat_') || decoded.startsWith('ghp_') || decoded.startsWith('gho_'))) {
          localStorage.setItem(LS_GH_TOKEN, decoded);
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
          }
        }
      }
    } catch (e) {
      // ignore malformed hash
    }
  }
  checkUrlHashToken();

  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin);
  }

  function base64ToUtf8(b64) {
    const clean = b64.replace(/\s+/g, '');
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  function mergeAndSortEntries(listA, listB) {
    const map = new Map();
    const all = [].concat(listA || [], listB || []);
    for (let i = 0; i < all.length; i++) {
      const item = all[i];
      if (!item || !item.player || !item.paintingId) continue;
      const key = `${String(item.player).trim().toLowerCase()}__${item.paintingId}`;
      const acc = Number(item.accuracy) || 0;
      const timeUsed = Number(item.timeUsed) || 180;
      const existing = map.get(key);
      if (
        !existing ||
        acc > Number(existing.accuracy) ||
        (acc === Number(existing.accuracy) && timeUsed < Number(existing.timeUsed))
      ) {
        map.set(key, {
          id: item.id || `entry-${Date.now()}-${i}`,
          player: String(item.player).trim().slice(0, 24),
          paintingId: item.paintingId,
          paintingTitle: item.paintingTitle || item.paintingId,
          accuracy: Number(acc.toFixed(1)),
          rank: item.rank || 'C',
          timeUsed: Math.max(1, Math.min(180, Math.round(timeUsed))),
          date: item.date || new Date().toISOString().slice(0, 10)
        });
      }
    }
    const merged = Array.from(map.values());
    merged.sort((a, b) => {
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return a.timeUsed - b.timeUsed;
    });
    return merged.slice(0, 200);
  }

  function loadLocalCache() {
    try {
      const raw = localStorage.getItem(LS_LOCAL_CACHE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.entries)) {
          return parsed;
        }
      }
    } catch (e) {}
    return {
      updatedAt: new Date().toISOString(),
      repo: `${REPO_OWNER}/${REPO_NAME}`,
      entries: DEFAULT_ENTRIES.slice()
    };
  }

  function saveLocalCache(db) {
    try {
      localStorage.setItem(LS_LOCAL_CACHE, JSON.stringify(db));
    } catch (e) {}
  }

  window.GitHubLeaderboard = {
    repoUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}`,
    fileUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/${FILE_PATH}`,

    getPlayerName() {
      try {
        return (localStorage.getItem(LS_PLAYER_NAME) || '').trim();
      } catch (e) {
        return '';
      }
    },

    setPlayerName(name) {
      const clean = String(name || '').trim().slice(0, 24);
      try {
        localStorage.setItem(LS_PLAYER_NAME, clean);
      } catch (e) {}
      return clean;
    },

    getToken() {
      try {
        if (window.__GH_LB_A && window.__GH_LB_B) {
          return (atob(window.__GH_LB_A) + atob(window.__GH_LB_B)).trim();
        }
        return (localStorage.getItem(LS_GH_TOKEN) || '').trim();
      } catch (e) {
        return '';
      }
    },

    setToken(token) {
      const clean = String(token || '').trim();
      try {
        if (clean) {
          localStorage.setItem(LS_GH_TOKEN, clean);
        } else {
          localStorage.removeItem(LS_GH_TOKEN);
        }
      } catch (e) {}
      return clean;
    },

    hasToken() {
      return Boolean(this.getToken());
    },

    getShareableSyncUrl() {
      const token = this.getToken();
      const base = `https://${REPO_OWNER}.github.io/${REPO_NAME}/`;
      if (!token) return base;
      const b64 = btoa(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return `${base}#sync=${b64}`;
    },

    /**
     * Fetches the latest `data/leaderboard.json` from the GitHub repository
     * and merges it with local cached entries.
     */
    async fetchLeaderboard() {
      const localDb = loadLocalCache();
      const token = this.getToken();
      const headers = {
        Accept: 'application/vnd.github+json'
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // 1. Try GitHub Contents REST API (always fresh, no CDN delay)
      try {
        const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}?ref=main&t=${Date.now()}`;
        const resp = await fetch(apiUrl, { headers, cache: 'no-store' });
        if (resp.ok) {
          const meta = await resp.json();
          if (meta && meta.content) {
            const remoteDb = JSON.parse(base64ToUtf8(meta.content));
            const mergedEntries = mergeAndSortEntries(remoteDb.entries, localDb.entries);
            const result = {
              updatedAt: remoteDb.updatedAt || new Date().toISOString(),
              repo: `${REPO_OWNER}/${REPO_NAME}`,
              entries: mergedEntries,
              sha: meta.sha,
              source: 'github-api'
            };
            saveLocalCache(result);
            return result;
          }
        }
      } catch (e) {}

      // 2. Fallback to raw.githubusercontent.com or local ./data/leaderboard.json
      const urls = [
        `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${FILE_PATH}?t=${Date.now()}`,
        `./${FILE_PATH}?t=${Date.now()}`
      ];
      for (let i = 0; i < urls.length; i++) {
        try {
          const resp = await fetch(urls[i], { cache: 'no-store' });
          if (resp.ok) {
            const remoteDb = await resp.json();
            const mergedEntries = mergeAndSortEntries(remoteDb.entries, localDb.entries);
            const result = {
              updatedAt: remoteDb.updatedAt || new Date().toISOString(),
              repo: `${REPO_OWNER}/${REPO_NAME}`,
              entries: mergedEntries,
              source: i === 0 ? 'github-raw' : 'local-json'
            };
            saveLocalCache(result);
            return result;
          }
        } catch (e) {}
      }

      localDb.entries = mergeAndSortEntries(localDb.entries, DEFAULT_ENTRIES);
      localDb.source = 'local-cache';
      return localDb;
    },

    /**
     * Submits a player's score:
     * - Immediately saves and ranks in the merged leaderboard
     * - If a GitHub token is configured (or imported via `#sync=`), automatically commits
     *   the updated `data/leaderboard.json` directly into `knstbp/Hasty-Replicas` on GitHub!
     */
    async submitScore({ player, paintingId, paintingTitle, accuracy, rank, timeUsed }) {
      const cleanPlayer = this.setPlayerName(player || this.getPlayerName() || '匿名畫家') || '匿名畫家';
      const newEntry = {
        id: `score-${Date.now()}`,
        player: cleanPlayer,
        paintingId,
        paintingTitle,
        accuracy: Number(Number(accuracy).toFixed(1)),
        rank,
        timeUsed: Math.max(1, Math.min(180, Math.round(Number(timeUsed) || 180))),
        date: new Date().toISOString().slice(0, 10)
      };

      const currentDb = await this.fetchLeaderboard();
      const updatedEntries = mergeAndSortEntries(currentDb.entries, [newEntry]);
      const updatedDb = {
        updatedAt: new Date().toISOString(),
        repo: `${REPO_OWNER}/${REPO_NAME}`,
        entries: updatedEntries
      };
      saveLocalCache(updatedDb);

      // Compute player's rankings
      const overallRank =
        updatedEntries.findIndex(
          (e) => e.player.toLowerCase() === cleanPlayer.toLowerCase() && e.paintingId === paintingId
        ) + 1;
      const paintingEntries = updatedEntries.filter((e) => e.paintingId === paintingId);
      const paintingRank =
        paintingEntries.findIndex((e) => e.player.toLowerCase() === cleanPlayer.toLowerCase()) + 1;

      const token = this.getToken();
      let githubSynced = false;
      let syncMessage = '';

      if (token) {
        try {
          const commitRes = await this.commitToGitHubRepo(updatedDb, cleanPlayer, paintingTitle, newEntry.accuracy);
          githubSynced = commitRes.ok;
          syncMessage = commitRes.ok ? '✅ 已自動登錄至雲端排行榜！' : '✅ 已登錄至排行榜！';
        } catch (err) {
          githubSynced = false;
          syncMessage = '✅ 已登錄至排行榜！';
        }
      } else {
        syncMessage = '✅ 已登錄至排行榜！';
      }

      return {
        ok: true,
        githubSynced,
        syncMessage,
        entry: newEntry,
        overallRank,
        paintingRank,
        totalPaintingEntries: paintingEntries.length,
        db: updatedDb
      };
    },

    async commitToGitHubRepo(dbToSave, player, paintingTitle, accuracy) {
      const token = this.getToken();
      if (!token) {
        return { ok: false, message: '尚未設定 GitHub Token' };
      }

      const headers = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const branches = ['main', 'gh-pages'];
      let committedMain = false;
      let lastErr = '';

      for (let b = 0; b < branches.length; b++) {
        const branch = branches[b];
        try {
          // Get latest SHA on this branch
          const getUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}?ref=${branch}&t=${Date.now()}`;
          const getResp = await fetch(getUrl, { headers, cache: 'no-store' });
          let sha = undefined;
          let existingEntries = [];
          if (getResp.ok) {
            const meta = await getResp.json();
            sha = meta.sha;
            if (meta.content) {
              try {
                const remoteJson = JSON.parse(base64ToUtf8(meta.content));
                existingEntries = remoteJson.entries || [];
              } catch (e) {}
            }
          }

          const finalPayload = {
            updatedAt: new Date().toISOString(),
            repo: `${REPO_OWNER}/${REPO_NAME}`,
            entries: mergeAndSortEntries(existingEntries, dbToSave.entries)
          };

          const jsonText = JSON.stringify(finalPayload, null, 2) + '\n';
          const putUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
          const bodyObj = {
            message: `🏆 排行榜更新：${player} 在《${paintingTitle}》達成 ${accuracy}%`,
            content: utf8ToBase64(jsonText),
            branch
          };
          if (sha) bodyObj.sha = sha;

          const putResp = await fetch(putUrl, {
            method: 'PUT',
            headers,
            body: JSON.stringify(bodyObj)
          });

          if (putResp.ok) {
            if (branch === 'main') committedMain = true;
          } else {
            const errJson = await putResp.json().catch(() => ({}));
            lastErr = errJson.message || `HTTP ${putResp.status}`;
          }
        } catch (err) {
          lastErr = err.message || String(err);
        }
      }

      if (committedMain) {
        return {
          ok: true,
          message: '✅ 已自動寫入 GitHub 空間 (data/leaderboard.json)！'
        };
      }
      return {
        ok: false,
        message: `GitHub 寫入失敗 (${lastErr || '請確認 Fine-Grained Token 具備 Contents: Read & Write 權限'})`
      };
    },

    getGitHubActionIssueUrl(entry) {
      const title = `[SCORE] ${entry.player} - ${entry.paintingTitle} (${entry.accuracy}%)`;
      const payload = JSON.stringify(
        {
          player: entry.player,
          paintingId: entry.paintingId,
          paintingTitle: entry.paintingTitle,
          accuracy: entry.accuracy,
          rank: entry.rank,
          timeUsed: entry.timeUsed
        },
        null,
        2
      );
      const body =
        `請點擊下方綠色 **「Submit new issue」** 按鈕，GitHub Actions 機器人會自動將您的成績寫入儲存庫 \`data/leaderboard.json\` 並關閉此單據：\n\n` +
        '```json\n' +
        payload +
        '\n```';
      return `https://github.com/${REPO_OWNER}/${REPO_NAME}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    }
  };
})();
