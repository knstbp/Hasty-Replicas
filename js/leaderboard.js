/* ==========================================================================
   Real-Time Cloud Leaderboard Engine
   - Instant real-time multi-user sync via public cloud relay (`ntfy.sh`)
   - Permanent historical archive in `data/leaderboard.json` (auto-synced by
     GitHub Actions built-in GITHUB_TOKEN without requiring any user setup!)
   ========================================================================== */

(function () {
  const REPO_OWNER = 'knstbp';
  const REPO_NAME = 'Hasty-Replicas';
  const FILE_PATH = 'data/leaderboard.json';
  const CLOUD_RELAY_TOPIC = 'hasty_replicas_lb_knstbp_v1';
  const CLOUD_RELAY_POST_URL = `https://ntfy.sh/${CLOUD_RELAY_TOPIC}`;
  const CLOUD_RELAY_POLL_URL = `https://ntfy.sh/${CLOUD_RELAY_TOPIC}/json?poll=1&since=48h`;

  const LS_PLAYER_NAME = 'hasty_replicas_player_name_v1';
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
      entries: DEFAULT_ENTRIES.slice()
    };
  }

  function saveLocalCache(db) {
    try {
      localStorage.setItem(LS_LOCAL_CACHE, JSON.stringify(db));
    } catch (e) {}
  }

  async function fetchCloudRelayEntries() {
    try {
      const resp = await fetch(`${CLOUD_RELAY_POLL_URL}&t=${Date.now()}`, { cache: 'no-store' });
      if (!resp.ok) return [];
      const text = await resp.text();
      const lines = text.trim().split('\n');
      let entries = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const pkt = JSON.parse(line);
          if (pkt && pkt.event === 'message' && pkt.message) {
            const payload = JSON.parse(pkt.message);
            if (payload && Array.isArray(payload.entries)) {
              entries = mergeAndSortEntries(entries, payload.entries);
            } else if (payload && payload.player && payload.paintingId) {
              entries = mergeAndSortEntries(entries, [payload]);
            }
          }
        } catch (e) {}
      }
      return entries;
    } catch (e) {
      return [];
    }
  }

  async function fetchRepoArchiveEntries() {
    const urls = [
      `./${FILE_PATH}?t=${Date.now()}`,
      `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${FILE_PATH}?t=${Date.now()}`
    ];
    for (let i = 0; i < urls.length; i++) {
      try {
        const resp = await fetch(urls[i], { cache: 'no-store' });
        if (resp.ok) {
          const data = await resp.json();
          if (data && Array.isArray(data.entries)) {
            return data.entries;
          }
        }
      } catch (e) {}
    }
    return [];
  }

  window.GitHubLeaderboard = {
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

    /**
     * Fetches and merges:
     * 1. Real-time online cloud relay scores (`ntfy.sh`)
     * 2. Permanent repository archive (`data/leaderboard.json`)
     * 3. Local cache & seed entries
     */
    async fetchLeaderboard() {
      const localDb = loadLocalCache();
      const [relayEntries, archiveEntries] = await Promise.all([
        fetchCloudRelayEntries(),
        fetchRepoArchiveEntries()
      ]);

      let merged = mergeAndSortEntries(DEFAULT_ENTRIES, archiveEntries);
      merged = mergeAndSortEntries(merged, localDb.entries);
      merged = mergeAndSortEntries(merged, relayEntries);

      const result = {
        updatedAt: new Date().toISOString(),
        entries: merged,
        source: relayEntries.length ? 'cloud-live' : 'archive'
      };
      saveLocalCache(result);
      return result;
    },

    /**
     * Submits a player's score and automatically broadcasts it to the live
     * online cloud leaderboard (zero setup required!).
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

      // Broadcast compact snapshot (top 25 + new entry) to real-time cloud relay
      let cloudSynced = false;
      try {
        const snapshotEntries = mergeAndSortEntries(updatedEntries.slice(0, 24), [newEntry]);
        const payload = JSON.stringify({
          type: 'lb_snapshot',
          entries: snapshotEntries
        });
        const resp = await fetch(CLOUD_RELAY_POST_URL, {
          method: 'POST',
          body: payload
        });
        cloudSynced = resp.ok;
      } catch (e) {
        cloudSynced = false;
      }

      return {
        ok: true,
        cloudSynced,
        entry: newEntry,
        overallRank,
        paintingRank,
        totalPaintingEntries: paintingEntries.length,
        db: updatedDb
      };
    }
  };
})();
