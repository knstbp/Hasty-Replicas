/* ==========================================================================
   名畫急就章 · Hasty Replicas — Core Game, Drawing, Scoring & Storage Engine
   ========================================================================== */

(function () {
  const STORAGE_KEY = 'sloppy_forgeries_records_v1';

  // ==================== STATE ====================
  const state = {
    canvasW: 480,
    canvasH: 360,
    evalW: 120,
    evalH: 90,

    timeLimit: 180, // Fixed 3 minutes (03:00)
    timeLeft: 180,
    timerId: null,
    roundActive: false,
    roundStarted: false,
    currentPainting: null,
    activePalette: null,

    selectedColor: '#000000',
    selectedColorIdx: 0,
    brushSize: 36,
    isDrawing: false,
    lastPt: null,

    peeksLeft: 3,
    peekTimerId: null,
    gridVisible: false,

    liveAccuracy: 0,
    lastStrokeAccuracy: 0,
    evalThrottleId: null,

    // Gallery filters & language
    activeCategory: 'all',
    searchQuery: '',
    lang: (function () {
      try {
        return localStorage.getItem('hasty_replicas_lang_v1') || 'zh';
      } catch (e) {
        return 'zh';
      }
    })(),

    // Cached offscreen evaluation canvases
    refEvalCanvas: document.createElement('canvas'),
    userEvalCanvas: document.createElement('canvas'),
    strokeCanvas: document.createElement('canvas'), // alpha-tracked painted layer
    refEvalData: null,
    refPaletteIndices: null,

    // Persistent records
    records: {
      bestById: {},
      history: []
    },

    // Cache of gallery preview dataURLs so filtering 52 paintings is instant
    thumbCache: {}
  };

  state.refEvalCanvas.width = state.evalW;
  state.refEvalCanvas.height = state.evalH;
  state.userEvalCanvas.width = state.evalW;
  state.userEvalCanvas.height = state.evalH;
  state.strokeCanvas.width = state.canvasW;
  state.strokeCanvas.height = state.canvasH;

  const refEvalCtx = state.refEvalCanvas.getContext('2d', { willReadFrequently: true });
  const userEvalCtx = state.userEvalCanvas.getContext('2d', { willReadFrequently: true });
  const strokeCtx = state.strokeCanvas.getContext('2d');

  // ==================== DOM REFERENCES ====================
  const $ = (id) => document.getElementById(id);

  const screens = {
    gallery: $('screen-gallery'),
    play: $('screen-play'),
    result: $('screen-result')
  };

  const dom = {
    // Gallery
    galleryGrid: $('gallery-grid'),
    timeModeGroup: $('time-mode-group'),
    categoryTabs: $('category-tabs'),
    gallerySearch: $('gallery-search'),
    btnRandom: $('btn-random-painting'),
    btnOpenRecords: $('btn-open-records'),
    recordsCountBadge: $('records-count-badge'),
    statMasterpieces: $('stat-masterpieces'),
    statAvgBest: $('stat-avg-best'),
    statTotalPlays: $('stat-total-plays'),
    catCountAll: $('cat-count-all'),
    btnLangHome: $('btn-toggle-lang-home'),
    btnSoundHome: $('btn-toggle-sound-home'),

    // Play
    btnBackGallery: $('btn-back-gallery'),
    playTitle: $('play-painting-title'),
    playColorBadge: $('play-color-badge'),
    playArtist: $('play-painting-artist'),
    timerBox: $('timer-box'),
    timerDisplay: $('timer-display'),
    liveAccuracyValue: $('live-accuracy-value'),
    liveRankBadge: $('live-rank-badge'),
    liveAccuracyFill: $('live-accuracy-fill'),
    btnGridToggle: $('btn-grid-toggle'),
    btnPeek: $('btn-peek'),
    peekCount: $('peek-count'),
    btnLangPlay: $('btn-toggle-lang-play'),
    btnSoundPlay: $('btn-toggle-sound-play'),
    btnSubmitEarly: $('btn-submit-early'),

    referencePanel: $('reference-panel'),
    referenceFrame: $('reference-frame'),
    btnViewOriginal: $('btn-view-original'),
    btnToggleRefSize: $('btn-toggle-ref-size'),
    refCanvas: $('ref-canvas'),
    refGridOverlay: $('ref-grid-overlay'),
    refBrushCursor: $('ref-brush-cursor'),
    eyedropPip: $('eyedrop-pip'),
    refPlaque: $('ref-plaque'),
    refPlaqueTitle: $('ref-plaque-title'),
    refPlaqueMeta: $('ref-plaque-meta'),
    refPlaqueDesc: $('ref-plaque-desc'),
    playerFrame: $('player-frame'),
    drawCanvas: $('draw-canvas'),
    peekCanvas: $('peek-canvas'),
    drawGridOverlay: $('draw-grid-overlay'),
    brushCursor: $('brush-cursor'),
    strokeDelta: $('stroke-delta'),

    readyOverlay: $('ready-overlay'),
    readyTitle: $('ready-title'),
    readyMeta: $('ready-meta'),
    readyTimeGroup: $('ready-time-group'),
    btnStartRound: $('btn-start-round'),

    dockPaletteLabel: $('dock-palette-label'),
    paletteContainer: $('palette-container'),
    brushSizes: $('brush-sizes'),

    // Result
    resultTitle: $('result-painting-title'),
    resultCritic: $('result-critic-quote'),
    resultRankStamp: $('result-rank-stamp'),
    resultAccuracy: $('result-accuracy'),
    resultNewBest: $('result-new-best'),
    resultTimeUsed: $('result-time-used'),
    compareModeGroup: $('compare-mode-group'),
    diffOptions: $('diff-options'),
    chkHideMissed: $('chk-hide-missed'),

    resOrigCanvas: $('res-orig-canvas'),
    resUserCanvas: $('res-user-canvas'),
    resSliderOrig: $('res-slider-orig'),
    resSliderUser: $('res-slider-user'),
    sliderWrapper: $('compare-slider-wrapper'),
    sliderClip: $('slider-clip'),
    sliderHandle: $('slider-handle'),
    sliderInput: $('compare-slider-input'),
    resDiffCanvas: $('res-diff-canvas'),
    resOvUser: $('res-ov-user'),
    resOvOrig: $('res-ov-orig'),
    overlayOpacitySlider: $('overlay-opacity-slider'),

    colorBreakdownList: $('color-breakdown-list'),
    playerNameInput: $('player-name-input'),
    btnSubmitLeaderboard: $('btn-submit-leaderboard'),
    btnGhIssueSubmit: $('btn-gh-issue-submit'),
    lbSubmitStatus: $('leaderboard-submit-status'),
    btnResultOpenLeaderboard: $('btn-result-open-leaderboard'),
    btnRetry: $('btn-retry-painting'),
    btnNext: $('btn-next-painting'),
    btnResultViewOriginal: $('btn-result-view-original'),
    btnDownload: $('btn-download-postcard'),
    btnResultGallery: $('btn-result-gallery'),

    // Modals & Global Leaderboard
    modalRecords: $('modal-records'),
    btnCloseRecords: $('btn-close-records'),
    btnCloseRecordsBottom: $('btn-close-records-bottom'),
    btnClearRecords: $('btn-clear-records'),
    recordsTabGlobal: $('records-tab-global'),
    recordsTabBest: $('records-tab-best'),
    recordsTabHistory: $('records-tab-history'),
    globalLbFilter: $('global-lb-filter'),
    btnRefreshGlobalLb: $('btn-refresh-global-lb'),
    btnToggleGhConfig: $('btn-toggle-gh-config'),
    ghConfigBox: $('gh-config-box'),
    ghTokenInput: $('gh-token-input'),
    btnSaveGhToken: $('btn-save-gh-token'),
    btnCopySyncLink: $('btn-copy-sync-link'),
    ghConfigStatus: $('gh-config-status'),
    globalLbStatus: $('global-lb-status'),
    globalLbList: $('global-lb-list'),

    modalOriginal: $('modal-original'),
    origModalTitle: $('orig-modal-title'),
    origModalSubtitle: $('orig-modal-subtitle'),
    origModalImg: $('orig-modal-img'),
    origModalDesc: $('orig-modal-desc'),
    btnCloseOriginal: $('btn-close-original'),
    btnCloseOriginalBottom: $('btn-close-original-bottom')
  };

  const drawCtx = dom.drawCanvas.getContext('2d');

  // ==================== STORAGE ====================
  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          state.records.bestById = parsed.bestById || {};
          state.records.history = Array.isArray(parsed.history) ? parsed.history : [];
        }
      }
    } catch (e) {
      console.warn('Failed to load records:', e);
    }
  }

  function saveRecords() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
    } catch (e) {
      // If localStorage quota is tight because of thumbnails, trim oldest history entries
      if (state.records.history.length > 20) {
        state.records.history = state.records.history.slice(0, 20);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
        } catch (_) {}
      }
    }
  }

  // ==================== LANGUAGE & I18N ====================
  function isEn() {
    return state.lang === 'en';
  }

  function pTitle(p) {
    if (!p) return '';
    return isEn() ? p.enTitle || p.title : p.title;
  }

  function pArtist(p) {
    if (!p) return '';
    if (isEn() && window.ARTIST_EN_MAP && window.ARTIST_EN_MAP[p.artist]) {
      return window.ARTIST_EN_MAP[p.artist];
    }
    return p.artist;
  }

  function pIntro(p) {
    if (!p) return '';
    if (isEn() && window.PAINTING_INTROS_EN && window.PAINTING_INTROS_EN[p.id]) {
      return window.PAINTING_INTROS_EN[p.id];
    }
    return (window.PAINTING_INTROS && window.PAINTING_INTROS[p.id]) || '';
  }

  function catLabel(cat) {
    if (isEn() && window.CATEGORY_LABELS_EN && window.CATEGORY_LABELS_EN[cat]) {
      return window.CATEGORY_LABELS_EN[cat];
    }
    return (window.CATEGORY_LABELS && window.CATEGORY_LABELS[cat]) || '';
  }

  function applyLanguageUI() {
    const en = isEn();
    document.documentElement.lang = en ? 'en' : 'zh-Hant';

    const langBtnLabel = en ? '🌐 中文' : '🌐 EN';
    if (dom.btnLangHome) dom.btnLangHome.textContent = langBtnLabel;
    if (dom.btnLangPlay) dom.btnLangPlay.textContent = langBtnLabel;

    // Gallery Header
    const brandDesc = document.querySelector('.brand-desc');
    if (brandDesc) {
      brandDesc.textContent = en
        ? 'No Undo. No Paint Bucket. 30 iconic Western classical-to-Impressionist portraits & Van Gogh masterpieces rendered as uncropped 16-color geometric vector facets. Recreate them in 3 minutes!'
        : '沒有復原鍵、沒有油漆桶。精選 30 幅歐美古典至印象派人物名畫與梵谷代表作，保留原畫比例不裁切並轉化為 16 色幾何切面向量插畫，限時 3 分鐘極速臨摹！';
    }
    const modeSpans = document.querySelectorAll('.fixed-mode-badge span');
    if (modeSpans.length >= 3) {
      modeSpans[0].textContent = en ? '⏱ 3-Min Limit' : '⏱ 限時 3 分鐘';
      modeSpans[2].textContent = en ? '🎨 16-Color Facets' : '🎨 16 色平塗';
    }
    const lblOpenRec = $('lbl-open-records');
    if (lblOpenRec) lblOpenRec.textContent = en ? 'Leaderboard & Records' : '全球排行與紀錄';

    // Stats Ribbon
    const statLabels = document.querySelectorAll('.stats-ribbon .stat-label');
    if (statLabels.length >= 3) {
      statLabels[0].textContent = en ? 'Masterpieces Played' : '已挑戰名畫';
      statLabels[1].textContent = en ? 'Average Best Accuracy' : '平均最佳完成度';
      statLabels[2].textContent = en ? 'Total Attempts' : '總臨摹次數';
    }
    if (dom.btnRandom) dom.btnRandom.textContent = en ? '🎲 Random Masterpiece' : '🎲 隨機抽一幅名畫';

    // Category Tabs
    if (dom.categoryTabs) {
      dom.categoryTabs.querySelectorAll('.cat-tab').forEach((btn) => {
        const c = btn.dataset.cat;
        if (c === 'all') {
          const cnt = dom.catCountAll ? dom.catCountAll.textContent : '30';
          btn.innerHTML = `${en ? 'All' : '全部'} <span class="cat-count" id="cat-count-all">${cnt}</span>`;
          dom.catCountAll = $('cat-count-all');
        } else if (c === 'unplayed') {
          btn.textContent = en ? 'Unplayed' : '未挑戰';
        } else {
          btn.textContent = catLabel(c);
        }
      });
    }
    if (dom.gallerySearch) {
      dom.gallerySearch.placeholder = en
        ? 'Search painting or artist (e.g. Van Gogh, Mona Lisa, Vermeer)...'
        : '搜尋畫作或畫家（如：梵谷、星夜、莫內）...';
    }
    const galFooter = document.querySelector('.gallery-footer span');
    if (galFooter) {
      galFooter.textContent = en
        ? '💡 Tip: Every pixel counts equally — block in large background & clothing areas with the Large brush first, then refine facial details!'
        : '💡 小提示：每個像素權重相同——先用大筆刷快速鋪滿背景與大色塊，再修細節最容易拿高分！';
    }

    // Studio HUD & Workspace
    if (dom.btnBackGallery) dom.btnBackGallery.textContent = en ? '← Gallery' : '← 畫廊';
    const accLabel = document.querySelector('.accuracy-label');
    if (accLabel) accLabel.textContent = en ? 'Accuracy' : '完成度';
    const lblGrid = $('lbl-grid-btn');
    if (lblGrid) lblGrid.textContent = en ? 'Grid' : '格線';
    const lblPeek = $('lbl-peek-btn');
    if (lblPeek) lblPeek.textContent = en ? 'Peek' : '透視';
    if (dom.btnSubmitEarly) dom.btnSubmitEarly.textContent = en ? 'Done ✓' : '交畫 ✓';

    const refPanelTag = document.querySelector('#reference-panel .panel-tag');
    if (refPanelTag) {
      refPanelTag.innerHTML = en
        ? 'Reference <small class="no-undo-hint">(💧 Click to pick color)</small>'
        : '原畫參考 <small class="no-undo-hint">（💧 點擊畫面可吸取顏色）</small>';
    }
    if (dom.btnViewOriginal) dom.btnViewOriginal.textContent = en ? '🖼 View Original' : '🖼 查看原畫';
    if (dom.btnToggleRefSize) dom.btnToggleRefSize.textContent = en ? 'Expand / Collapse' : '展開 / 縮小';

    const playerPanelTag = document.querySelector('.player-tag');
    if (playerPanelTag) {
      playerPanelTag.innerHTML = en
        ? 'Your Canvas <small class="no-undo-hint">(No Undo · Paint Over)</small>'
        : '你的畫布 <small class="no-undo-hint">（無復原鍵 · 直接覆蓋重畫）</small>';
    }

    const readyEyebrow = document.querySelector('.ready-eyebrow');
    if (readyEyebrow) readyEyebrow.textContent = en ? 'READY TO PAINT' : '準備臨摹';
    const readyRules = document.querySelector('.ready-rules');
    if (readyRules) {
      readyRules.innerHTML = en
        ? '<span>🚫 No Undo</span><span>🚫 No Bucket</span><span>💧 Click Reference to Pick Color</span><span>👁 3 Peeks</span>'
        : '<span>🚫 無復原鍵</span><span>🚫 無油漆桶</span><span>💧 點擊原畫吸色</span><span>👁 3 次透視機會</span>';
    }
    if (dom.btnStartRound) dom.btnStartRound.textContent = en ? 'Pick Up Brush & Start!' : '拿起畫筆開始！';

    // Bottom Dock
    if (dom.dockPaletteLabel) {
      dom.dockPaletteLabel.innerHTML = en
        ? 'Palette <small>(1-9,0)</small>'
        : '調色盤 <small>(1-9,0)</small>';
    }
    const dockLabels = document.querySelectorAll('.tool-dock .dock-label');
    if (dockLabels.length >= 2) {
      dockLabels[1].innerHTML = en
        ? 'Brush Size <small>(Q/W/E/R)</small>'
        : '筆刷大小 <small>(Q/W/E/R)</small>';
    }
    const brushLabels = document.querySelectorAll('#brush-sizes .brush-label');
    const enSizes = ['XS', 'S', 'M', 'L'];
    const zhSizes = ['細', '小', '中', '大'];
    brushLabels.forEach((el, idx) => {
      el.textContent = en ? enSizes[idx] || el.textContent : zhSizes[idx] || el.textContent;
    });

    // Result Screen
    const resEyebrow = document.querySelector('.result-eyebrow');
    if (resEyebrow) resEyebrow.textContent = en ? 'APPRAISAL REPORT' : '畫作鑑定報告';
    if (dom.resultNewBest) dom.resultNewBest.textContent = en ? '★ NEW BEST!' : '★ 新紀錄！';
    if (dom.compareModeGroup) {
      const modeMap = en
        ? { side: 'Side by Side', slider: 'Split Slider', diff: 'Error Heatmap', overlay: 'Overlay' }
        : { side: '並列對比', slider: '拉桿對比', diff: '誤差熱圖', overlay: '原畫疊加' };
      dom.compareModeGroup.querySelectorAll('.pill-btn').forEach((b) => {
        if (modeMap[b.dataset.mode]) b.textContent = modeMap[b.dataset.mode];
      });
    }
    const compareLabels = document.querySelectorAll('#view-side .compare-card-label');
    if (compareLabels.length >= 2) {
      compareLabels[0].textContent = en ? 'Masterpiece Reference' : '原作真跡';
      compareLabels[1].textContent = en ? 'Your Replica' : '你的臨摹作品';
    }
    const tagLeft = document.querySelector('.slider-tag.tag-left');
    const tagRight = document.querySelector('.slider-tag.tag-right');
    if (tagLeft) tagLeft.textContent = en ? 'Reference' : '原作';
    if (tagRight) tagRight.textContent = en ? 'Yours' : '你的作品';

    const breakdownTitle = document.querySelector('.breakdown-title');
    if (breakdownTitle) breakdownTitle.textContent = en ? 'Per-Color Accuracy Breakdown' : '各色塊完成度分析';

    const lbSubmitTitle = document.querySelector('.lb-submit-title');
    if (lbSubmitTitle) lbSubmitTitle.textContent = en ? '🌍 Submit to Global Leaderboard' : '🌍 登錄全球排行榜';
    const lbSubmitDesc = document.querySelector('.lb-submit-desc');
    if (lbSubmitDesc) {
      lbSubmitDesc.textContent = en
        ? 'Enter your artist nickname to record this score on the online global leaderboard'
        : '輸入畫家署名即可將本次臨摹成績登錄至全球排行榜';
    }
    if (dom.btnResultOpenLeaderboard) {
      dom.btnResultOpenLeaderboard.textContent = en ? '🏆 View Leaderboard' : '🏆 查看完整排行榜';
    }
    if (dom.playerNameInput) {
      dom.playerNameInput.placeholder = en
        ? 'Enter artist nickname (e.g. Studio Arles)...'
        : '輸入畫家署名（例如：阿爾勒畫徒）...';
    }
    if (dom.btnSubmitLeaderboard) {
      dom.btnSubmitLeaderboard.textContent = en ? '🏆 Submit Score' : '🏆 登錄成績';
    }

    if (dom.btnRetry) dom.btnRetry.textContent = en ? '↻ Try Again' : '↻ 再挑戰一次';
    if (dom.btnNext) dom.btnNext.textContent = en ? 'Next Masterpiece →' : '下一幅名畫 →';
    if (dom.btnResultViewOriginal) dom.btnResultViewOriginal.textContent = en ? '🖼 View Original' : '🖼 查看原畫';
    if (dom.btnDownload) dom.btnDownload.textContent = en ? '⬇ Download Postcard' : '⬇ 下載對比明信片';
    if (dom.btnResultGallery) dom.btnResultGallery.textContent = en ? 'Back to Gallery' : '回到畫廊';

    // Leaderboard & Records Modal
    const recModalTitle = $('records-modal-title');
    if (recModalTitle) recModalTitle.textContent = en ? '🏆 Global Leaderboard & Personal Records' : '🏆 全球排行榜與個人紀錄';
    document.querySelectorAll('#modal-records .modal-tab').forEach((t) => {
      if (t.dataset.tab === 'global') t.textContent = en ? '🌍 Global Leaderboard' : '🌍 全球排行榜';
      if (t.dataset.tab === 'best') t.textContent = en ? 'Personal Best' : '各名畫個人最佳';
      if (t.dataset.tab === 'history') t.textContent = en ? 'Recent History' : '本機挑戰歷史';
    });
    const filterLbl = document.querySelector('.global-lb-label');
    if (filterLbl) filterLbl.textContent = en ? 'Filter Painting:' : '篩選名畫：';
    if (dom.btnRefreshGlobalLb) dom.btnRefreshGlobalLb.textContent = en ? '🔄 Refresh' : '🔄 重新整理';
    if (dom.btnClearRecords) dom.btnClearRecords.textContent = en ? 'Clear Local Records' : '清除本機紀錄';
    if (dom.btnCloseRecordsBottom) dom.btnCloseRecordsBottom.textContent = en ? 'Close' : '關閉';
    if (dom.btnCloseOriginalBottom) dom.btnCloseOriginalBottom.textContent = en ? 'Back to Studio' : '回到畫室';
    const origNote = document.querySelector('.orig-modal-note');
    if (origNote) origNote.textContent = en ? 'Public domain museum scan (original un-vectorized painting)' : '公有領域名畫典藏原圖（非分色版本）';

    // Refresh filter dropdown & active views
    if (dom.globalLbFilter) {
      const curVal = dom.globalLbFilter.value || 'all';
      dom.globalLbFilter.innerHTML = `<option value="all">${en ? '🔥 Global Top 50' : '🔥 全站總榜 Top 50'}</option>`;
      window.PAINTINGS.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${pTitle(p)} (${pArtist(p)})`;
        dom.globalLbFilter.appendChild(opt);
      });
      dom.globalLbFilter.value = curVal;
    }

    renderGallery();

    // If currently in Studio, refresh HUD & plaque text in active language
    if (state.currentPainting) {
      const p = state.currentPainting;
      const starStr = starsText(p.difficulty);
      const facetUnit = en ? 'facets' : '色塊';
      const facetText = p.facets ? (en ? ` (${p.facets} ${facetUnit})` : `（${p.facets} ${facetUnit}）`) : '';
      const diffWord = en ? 'Difficulty' : '難度';
      dom.playTitle.textContent = pTitle(p);
      dom.playColorBadge.textContent = `${diffWord} ${starStr}`;
      dom.playArtist.textContent = `${pArtist(p)} (${p.year})`;
      dom.refPlaqueTitle.textContent = en ? `${p.enTitle} (${p.title})` : `${p.title} (${p.enTitle})`;
      dom.refPlaqueMeta.textContent = `${pArtist(p)} · ${p.year} · ${diffWord} ${starStr}${facetText}`;
      dom.refPlaqueDesc.textContent = pIntro(p);
      dom.readyTitle.textContent = pTitle(p);
      const palLen = (state.activePalette || p.palette).length;
      dom.readyMeta.textContent = en
        ? `${diffWord} ${starStr}${facetText} · ${palLen}-Color Vector · 3-Min Limit`
        : `${diffWord} ${starStr}${facetText} · ${palLen} 色向量插畫 · 限時 3 分鐘`;
    }
  }

  function toggleLanguage() {
    state.lang = state.lang === 'en' ? 'zh' : 'en';
    try {
      localStorage.setItem('hasty_replicas_lang_v1', state.lang);
    } catch (e) {}
    window.SoundFX.click();
    applyLanguageUI();
    if (!dom.modalRecords.classList.contains('hidden')) {
      renderRecordsModal();
      renderGlobalLeaderboardTab();
    }
  }

  // ==================== RANKING & CRITIC QUOTES ====================
  function getRankInfo(acc) {
    const en = isEn();
    if (acc >= 90)
      return {
        label: 'S+',
        cls: 'rank-Splus',
        quote: en
          ? '"Louvre security is on high alert! This replica could fool an infrared scanner!"'
          : '「羅浮宮保全已緊急出動！這幅贗品幾乎能騙過紅外線鑑定！」'
      };
    if (acc >= 80)
      return {
        label: 'S',
        cls: 'rank-S',
        quote: en
          ? '"Breathtaking composition and spirit! Christie’s almost hammered it sold."'
          : '「驚人的神韻與構圖！佳士得拍賣行差點直接落槌成交。」'
      };
    if (acc >= 70)
      return {
        label: 'A',
        cls: 'rank-A',
        quote: en
          ? '"From afar a timeless masterpiece; up close, bold and expressive speed-painting!"'
          : '「遠看是傳世名作，近看充滿奔放的極速筆觸，非常出色！」'
      };
    if (acc >= 58)
      return {
        label: 'B',
        cls: 'rank-B',
        quote: en
          ? '"Quite a solid likeness — dim the gallery lights a bit and nobody will notice."'
          : '「神似度相當不錯，只要展廳燈光調暗一點就沒人發現了。」'
      };
    if (acc >= 45)
      return {
        label: 'C',
        cls: 'rank-C',
        quote: en
          ? '"A soulful interpretation full of personal flair, though the original master might raise an eyebrow."'
          : '「這是一種充滿個人情感的靈魂臨摹，原作畫家可能會微微皺眉。」'
      };
    if (acc >= 30)
      return {
        label: 'D',
        cls: 'rank-D',
        quote: en
          ? '"Wildly expressive color placement — let’s call it an Abstract Homage to the Master."'
          : '「色彩分布很有野性美，建議改稱『向大師致敬的抽象再創作』。」'
      };
    return {
      label: 'F',
      cls: 'rank-F',
      quote: en
        ? '"Transcends replication entirely — you have founded Post-Modern Hasty Expressionism!"'
        : '「這已經完全超越了臨摹，開創了全新的後現代草率主義流派！」'
    };
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  function starsText(n) {
    const s = Math.max(1, Math.min(5, Number(n) || 1));
    return '★'.repeat(s) + '☆'.repeat(5 - s);
  }

  // ==================== SCREEN SWITCHING ====================
  function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => {
      el.classList.toggle('active', k === name);
    });
    window.scrollTo(0, 0);
  }

  function updateSoundIcons() {
    const icon = window.SoundFX.isMuted() ? '🔇' : '🔊';
    dom.btnSoundHome.textContent = icon;
    dom.btnSoundPlay.textContent = icon;
  }

  // ==================== GALLERY RENDERING ====================
  let thumbObserver = null;
  if ('IntersectionObserver' in window) {
    thumbObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        thumbObserver.unobserve(img);
        const pid = img.dataset.pid;
        if (!pid) return;
        if (state.thumbCache[pid]) {
          img.src = state.thumbCache[pid];
          return;
        }
        const p = window.PAINTINGS.find((item) => item.id === pid);
        if (!p) return;
        const tmp = document.createElement('canvas');
        tmp.width = 240;
        tmp.height = 180;
        window.ArtHelpers.renderMasterpieceAsync(p, tmp, 240).then(() => {
          const url = tmp.toDataURL('image/png');
          state.thumbCache[pid] = url;
          img.src = url;
        });
      });
    }, { rootMargin: '160px' });
  }

  function getThumbDataUrl(painting) {
    if (state.thumbCache[painting.id]) return state.thumbCache[painting.id];
    const tmp = document.createElement('canvas');
    tmp.width = 240;
    tmp.height = 180;
    window.ArtHelpers.renderMasterpiece(painting, tmp);
    return tmp.toDataURL('image/png');
  }

  function updateGalleryStats() {
    const total = window.PAINTINGS.length;
    const bestEntries = Object.values(state.records.bestById);
    const playedCount = bestEntries.length;
    const avgBest = playedCount
      ? bestEntries.reduce((sum, r) => sum + r.bestAccuracy, 0) / playedCount
      : 0;
    const totalPlays = state.records.history.length;

    dom.statMasterpieces.textContent = `${playedCount} / ${total}`;
    dom.statAvgBest.textContent = `${avgBest.toFixed(1)}%`;
    dom.statTotalPlays.textContent = String(totalPlays);
    dom.recordsCountBadge.textContent = String(totalPlays);
    dom.catCountAll.textContent = String(total);
  }

  function renderGallery() {
    updateGalleryStats();
    const q = state.searchQuery.trim().toLowerCase();
    const cat = state.activeCategory;

    const filtered = window.PAINTINGS.filter((p) => {
      if (cat === 'unplayed') {
        if (state.records.bestById[p.id]) return false;
      } else if (cat !== 'all' && p.category !== cat) {
        return false;
      }

      if (q) {
        const hay = `${p.title} ${p.enTitle} ${p.artist} ${p.year}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    dom.galleryGrid.innerHTML = '';

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'gallery-empty';
      empty.textContent = isEn()
        ? 'No matching masterpieces found. Try another category or keyword!'
        : '找不到符合條件的名畫，試試其他分類或關鍵字！';
      dom.galleryGrid.appendChild(empty);
      return;
    }

    const en = isEn();
    const frag = document.createDocumentFragment();
    filtered.forEach((p) => {
      const best = state.records.bestById[p.id];
      const card = document.createElement('article');
      card.className = 'painting-card';
      card.tabIndex = 0;

      const bestBadgeHtml = best
        ? `<div class="card-best-badge"><span class="rank-pill ${getRankInfo(best.bestAccuracy).cls}">${best.bestRank}</span> ${best.bestAccuracy.toFixed(1)}%</div>`
        : '';

      const dotsHtml = p.palette
        .slice(0, 6)
        .map((hex) => `<span class="card-palette-dot" style="background:${hex}"></span>`)
        .join('');

      const initialThumb = state.thumbCache[p.id] || window.ArtHelpers.getOriginalImageUrl(p);
      const starStr = starsText(p.difficulty);
      const facetHint = p.facets
        ? en
          ? `Difficulty ${p.difficulty}/5 (~${p.facets} facets)`
          : `難度 ${p.difficulty} 星（約 ${p.facets} 個幾何色塊）`
        : en
        ? `Difficulty ${p.difficulty}/5`
        : `難度 ${p.difficulty} 星`;
      const facetUnit = en ? 'facets' : '色塊';
      const ctaText = best ? (en ? 'Play Again →' : '再次挑戰 →') : en ? 'Start Painting →' : '開始臨摹 →';
      card.innerHTML = `
        <div class="card-preview-wrap">
          <img class="card-preview-canvas" data-pid="${p.id}" alt="${pTitle(p)}" loading="lazy" src="${initialThumb}" />
          ${bestBadgeHtml}
          <span class="card-category-pill">${catLabel(p.category)}</span>
        </div>
        <div class="card-body">
          <div class="card-title-row">
            <h3 class="card-title">${pTitle(p)}</h3>
            <span class="card-stars" title="${facetHint}">${starStr}</span>
          </div>
          <p class="card-subtitle">${pArtist(p)} · ${p.year}${p.facets ? ` · ${p.facets} ${facetUnit}` : ''}</p>
          <div class="card-footer-row">
            <div class="card-palette-dots" title="${en ? '16 curated palette colors' : '16 種精選色塊'}">${dotsHtml}</div>
            <span class="card-play-cta">${ctaText}</span>
          </div>
        </div>
      `;

      const previewImg = card.querySelector('.card-preview-canvas');
      if (thumbObserver && !state.thumbCache[p.id]) {
        thumbObserver.observe(previewImg);
      }
      previewImg.addEventListener('error', () => {
        if (!previewImg.dataset.fallback) {
          previewImg.dataset.fallback = '1';
          previewImg.src = getThumbDataUrl(p);
        }
      });

      const openHandler = () => {
        window.SoundFX.click();
        openPaintingStudio(p);
      };
      card.addEventListener('click', openHandler);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openHandler();
        }
      });
      frag.appendChild(card);
    });

    dom.galleryGrid.appendChild(frag);
  }

  // ==================== STUDIO SETUP ====================
  function updateResponsiveFrameVars(w, h) {
    const ratio = w / h;
    const root = document.documentElement;
    root.style.setProperty('--painting-aspect', `${w} / ${h}`);
    root.style.setProperty('--painting-ratio-num', ratio.toFixed(4));

    const desktopMaxH = Math.max(260, window.innerHeight - 325);
    const mobilePlayerMaxH = Math.max(200, window.innerHeight - 415);
    root.style.setProperty('--max-frame-w', `${Math.round(desktopMaxH * ratio)}px`);
    root.style.setProperty('--mobile-ref-w', `${Math.round(135 * ratio)}px`);
    root.style.setProperty('--mobile-ref-exp-w', `${Math.round(235 * ratio)}px`);
    root.style.setProperty('--mobile-player-w', `${Math.round(mobilePlayerMaxH * ratio)}px`);
  }

  function applyCanvasAspect(w, h) {
    state.canvasW = w;
    state.canvasH = h;
    state.evalW = Math.max(24, Math.round(w / 4));
    state.evalH = Math.max(24, Math.round(h / 4));

    updateResponsiveFrameVars(w, h);

    const studioCanvases = [
      dom.drawCanvas,
      dom.peekCanvas,
      state.strokeCanvas,
      dom.resOrigCanvas,
      dom.resUserCanvas,
      dom.resSliderOrig,
      dom.resSliderUser,
      dom.resDiffCanvas,
      dom.resOvUser,
      dom.resOvOrig
    ];
    studioCanvases.forEach((c) => {
      if (c && (c.width !== w || c.height !== h)) {
        c.width = w;
        c.height = h;
      }
    });

    state.refEvalCanvas.width = state.evalW;
    state.refEvalCanvas.height = state.evalH;
    state.userEvalCanvas.width = state.evalW;
    state.userEvalCanvas.height = state.evalH;

    drawCtx.fillStyle = '#FFFFFF';
    drawCtx.fillRect(0, 0, w, h);
    strokeCtx.clearRect(0, 0, w, h);
  }

  function openPaintingStudio(painting) {
    stopTimer();
    clearPeek();
    state.currentPainting = painting;
    state.timeLimit = 180;
    state.roundActive = false;
    state.roundStarted = false;
    state.timeLeft = 180;
    state.peeksLeft = 3;
    state.liveAccuracy = 0;
    state.lastStrokeAccuracy = 0;

    // HUD labels & Museum Plaque
    const en = isEn();
    const diffWord = en ? 'Difficulty' : '難度';
    const starStr = starsText(painting.difficulty);
    const facetText = painting.facets ? (en ? ` (${painting.facets} facets)` : `（${painting.facets} 色塊）`) : '';
    dom.playTitle.textContent = pTitle(painting);
    dom.playColorBadge.textContent = `${diffWord} ${starStr}`;
    dom.playArtist.textContent = `${pArtist(painting)} (${painting.year})`;
    dom.refPlaqueTitle.textContent = en
      ? `${painting.enTitle} (${painting.title})`
      : `${painting.title} (${painting.enTitle})`;
    dom.refPlaqueMeta.textContent = `${pArtist(painting)} · ${painting.year} · ${diffWord} ${starStr}${facetText}`;
    dom.refPlaqueDesc.textContent = pIntro(painting);
    dom.refPlaque.classList.remove('expanded');
    dom.timerDisplay.textContent = formatTime(state.timeLeft);
    dom.timerBox.classList.remove('warning');
    dom.peekCount.textContent = String(state.peeksLeft);
    dom.btnPeek.disabled = false;
    dom.strokeDelta.textContent = '';
    if (dom.brushCursor) dom.brushCursor.style.display = 'none';
    if (dom.refBrushCursor) dom.refBrushCursor.style.display = 'none';
    updateLiveAccuracyUI(0);

    // Ready overlay
    dom.readyTitle.textContent = pTitle(painting);
    dom.readyMeta.textContent = en
      ? `${diffWord} ${starStr}${facetText} · 16-Color Vector · 3-Min Limit`
      : `${diffWord} ${starStr}${facetText} · 16 色向量插畫 · 限時 3 分鐘`;
    dom.readyOverlay.classList.remove('hidden');

    if (painting.canvasW && painting.canvasH) {
      applyCanvasAspect(painting.canvasW, painting.canvasH);
    }
    const initialPal = window.ArtHelpers.sortHexPaletteBySimilarity(painting.activePalette || painting.palette);
    state.activePalette = initialPal;
    buildPaletteUI(initialPal);
    selectColor(0, false);

    // Sync reference evaluation grid & palette dock
    const syncRefEvaluation = (palette) => {
      const w = dom.refCanvas.width;
      const h = dom.refCanvas.height;
      if (!state.roundStarted) {
        applyCanvasAspect(w, h);
      }

      state.activePalette = palette;
      const peekCtx = dom.peekCanvas.getContext('2d');
      peekCtx.clearRect(0, 0, w, h);
      peekCtx.drawImage(dom.refCanvas, 0, 0);

      const ew = state.evalW;
      const eh = state.evalH;
      refEvalCtx.imageSmoothingEnabled = false;
      refEvalCtx.clearRect(0, 0, ew, eh);
      refEvalCtx.drawImage(dom.refCanvas, 0, 0, ew, eh);
      state.refEvalData = refEvalCtx.getImageData(0, 0, ew, eh).data;

      const palRgb = palette.map(window.ArtHelpers.hexToRgb);
      const totalPx = ew * eh;
      state.refPaletteIndices = new Uint8Array(totalPx);
      for (let i = 0; i < totalPx; i++) {
        const off = i * 4;
        const r = state.refEvalData[off];
        const g = state.refEvalData[off + 1];
        const b = state.refEvalData[off + 2];
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let p = 0; p < palRgb.length; p++) {
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
        state.refPaletteIndices[i] = bestIdx;
      }

      const curEn = isEn();
      const curDiffWord = curEn ? 'Difficulty' : '難度';
      const updatedFacetText = painting.facets
        ? curEn
          ? ` (${painting.facets} facets)`
          : `（${painting.facets} 色塊）`
        : '';
      dom.playColorBadge.textContent = `${curDiffWord} ${starStr}`;
      dom.refPlaqueMeta.textContent = `${pArtist(painting)} · ${painting.year} · ${curDiffWord} ${starStr}${updatedFacetText}`;
      dom.readyMeta.textContent = curEn
        ? `${curDiffWord} ${starStr}${updatedFacetText} · ${palette.length}-Color Vector · 3-Min Limit`
        : `${curDiffWord} ${starStr}${updatedFacetText} · ${palette.length} 色向量插畫 · 限時 3 分鐘`;
      buildPaletteUI(palette);
      selectColor(0, false);
    };

    // Render 16-Color Geometric Faceted Vector illustration preserving 100% original aspect ratio (no cropping!)
    const expectedId = painting.id;
    window.ArtHelpers.renderMasterpieceAsync(painting, dom.refCanvas, 480).then((activePal) => {
      if (state.currentPainting && state.currentPainting.id === expectedId) {
        syncRefEvaluation(activePal);
      }
    });

    // Collapse mobile reference by default
    dom.referencePanel.classList.remove('expanded');

    showScreen('play');
  }

  function buildPaletteUI(palette) {
    dom.paletteContainer.innerHTML = '';
    const count = palette.length;
    const en = isEn();
    dom.paletteContainer.className =
      'palette-swatches ' + (count > 10 ? 'swatches-16' : count > 6 ? 'swatches-10' : 'swatches-6');

    if (dom.dockPaletteLabel) {
      dom.dockPaletteLabel.innerHTML =
        count <= 6
          ? `${en ? 'Palette' : '調色盤'} <small>(1-${count})</small>`
          : `${en ? 'Palette' : '調色盤'} <small>(1-9,0)</small>`;
    }

    palette.forEach((hex, idx) => {
      const btn = document.createElement('button');
      btn.className = 'swatch-btn';
      btn.style.backgroundColor = hex;
      const keyLabel = idx < 9 ? String(idx + 1) : idx === 9 ? '0' : String(idx + 1);
      const shortcutHint = idx < 10 ? (en ? ` (Key ${keyLabel})` : ` (快捷鍵 ${keyLabel})`) : '';
      btn.title = `${en ? 'Color' : '顏色'} ${idx + 1}${shortcutHint}`;
      btn.setAttribute('aria-label', `${en ? 'Select Color' : '選擇顏色'} ${idx + 1}`);
      btn.innerHTML = `<span class="swatch-key">${keyLabel}</span>`;
      btn.addEventListener('click', () => selectColor(idx, true));
      dom.paletteContainer.appendChild(btn);
    });
  }

  function selectColor(idx, playSound = true) {
    const pal = state.activePalette || (state.currentPainting && state.currentPainting.palette);
    if (!pal || idx < 0 || idx >= pal.length) return;
    state.selectedColorIdx = idx;
    state.selectedColor = pal[idx];

    const buttons = dom.paletteContainer.querySelectorAll('.swatch-btn');
    buttons.forEach((b, i) => b.classList.toggle('active', i === idx));
    if (playSound) window.SoundFX.click();
  }

  let eyedropHideTimer = null;
  function pickColorFromReference(e) {
    const pal = state.activePalette || (state.currentPainting && state.currentPainting.palette);
    if (!pal || !pal.length || !dom.refCanvas) return;

    const rect = dom.refCanvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const px = Math.max(0, Math.min(dom.refCanvas.width - 1, Math.floor(relX * dom.refCanvas.width)));
    const py = Math.max(0, Math.min(dom.refCanvas.height - 1, Math.floor(relY * dom.refCanvas.height)));

    const refCtx = dom.refCanvas.getContext('2d', { willReadFrequently: true });
    const data = refCtx.getImageData(px, py, 1, 1).data;
    const r = data[0];
    const g = data[1];
    const b = data[2];

    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < pal.length; i++) {
      const rgb = window.ArtHelpers.hexToRgb(pal[i]);
      const dr = r - rgb[0];
      const dg = g - rgb[1];
      const db = b - rgb[2];
      const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
        if (d === 0) break;
      }
    }

    selectColor(bestIdx, true);

    if (dom.eyedropPip && dom.referenceFrame) {
      const frameRect = dom.referenceFrame.getBoundingClientRect();
      const pipX = e.clientX - frameRect.left;
      const pipY = e.clientY - frameRect.top;
      dom.eyedropPip.style.left = `${pipX}px`;
      dom.eyedropPip.style.top = `${pipY}px`;
      dom.eyedropPip.style.backgroundColor = pal[bestIdx];
      const keyLabel = bestIdx < 9 ? String(bestIdx + 1) : bestIdx === 9 ? '0' : String(bestIdx + 1);
      dom.eyedropPip.textContent = keyLabel;
      dom.eyedropPip.classList.add('visible');

      if (eyedropHideTimer) clearTimeout(eyedropHideTimer);
      eyedropHideTimer = setTimeout(() => {
        dom.eyedropPip.classList.remove('visible');
      }, 750);
    }
  }

  function selectBrushSize(size, playSound = true) {
    state.brushSize = size;
    dom.brushSizes.querySelectorAll('.brush-btn').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.size) === size);
    });
    if (playSound) window.SoundFX.brushSelect();
  }

  // ==================== TIMER & ROUND LIFECYCLE ====================
  function startRound() {
    if (state.roundActive) return;
    state.roundActive = true;
    state.roundStarted = true;
    dom.readyOverlay.classList.add('hidden');
    window.SoundFX.startRound();

    state.timerId = setInterval(() => {
      state.timeLeft -= 1;
      dom.timerDisplay.textContent = formatTime(state.timeLeft);

      if (state.timeLeft <= 10 && state.timeLeft > 0) {
        dom.timerBox.classList.add('warning');
        window.SoundFX.tick(state.timeLeft <= 5);
      }

      if (state.timeLeft <= 0) {
        finishRound();
      }
    }, 1000);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function triggerPeek() {
    if (!state.roundActive || state.peeksLeft <= 0) return;
    state.peeksLeft -= 1;
    dom.peekCount.textContent = String(state.peeksLeft);
    if (state.peeksLeft <= 0) dom.btnPeek.disabled = true;

    window.SoundFX.peek();
    dom.peekCanvas.classList.add('visible');
    clearTimeout(state.peekTimerId);
    state.peekTimerId = setTimeout(() => {
      dom.peekCanvas.classList.remove('visible');
    }, 2500);
  }

  function clearPeek() {
    clearTimeout(state.peekTimerId);
    dom.peekCanvas.classList.remove('visible');
  }

  // ==================== DRAWING ENGINE (POINTER EVENTS) ====================
  function getCanvasCoords(e) {
    const rect = dom.drawCanvas.getBoundingClientRect();
    const scaleX = state.canvasW / rect.width;
    const scaleY = state.canvasH / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function paintDab(x, y) {
    const r = state.brushSize / 2;
    drawCtx.fillStyle = state.selectedColor;
    drawCtx.beginPath();
    drawCtx.arc(x, y, r, 0, Math.PI * 2);
    drawCtx.fill();

    strokeCtx.fillStyle = state.selectedColor;
    strokeCtx.beginPath();
    strokeCtx.arc(x, y, r, 0, Math.PI * 2);
    strokeCtx.fill();
  }

  function paintSegment(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(2, state.brushSize * 0.22);
    if (dist <= step) {
      paintDab(p2.x, p2.y);
      return;
    }
    const steps = Math.ceil(dist / step);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      paintDab(p1.x + dx * t, p1.y + dy * t);
    }
  }

  function updateBrushCursor(e) {
    const canvasRect = dom.drawCanvas.getBoundingClientRect();
    if (canvasRect.width <= 0 || canvasRect.height <= 0) return;

    const normX = Math.max(0, Math.min(1, (e.clientX - canvasRect.left) / canvasRect.width));
    const normY = Math.max(0, Math.min(1, (e.clientY - canvasRect.top) / canvasRect.height));

    // 1. Player canvas brush cursor (for mouse/pen)
    if (e.pointerType === 'mouse' || e.pointerType === 'pen' || !e.pointerType) {
      const frameRect = dom.playerFrame.getBoundingClientRect();
      const scale = canvasRect.width / state.canvasW;
      const displayDiameter = Math.max(6, state.brushSize * scale);

      dom.brushCursor.style.display = 'block';
      dom.brushCursor.style.width = `${displayDiameter}px`;
      dom.brushCursor.style.height = `${displayDiameter}px`;
      dom.brushCursor.style.left = `${e.clientX - frameRect.left}px`;
      dom.brushCursor.style.top = `${e.clientY - frameRect.top}px`;
    } else {
      dom.brushCursor.style.display = 'none';
    }

    // 2. Synchronized Reference Painting brush position cursor (for mouse, pen & touch!)
    if (dom.refBrushCursor && dom.refCanvas && dom.referenceFrame) {
      const refFrameRect = dom.referenceFrame.getBoundingClientRect();
      const refCanvasRect = dom.refCanvas.getBoundingClientRect();
      if (refCanvasRect.width > 0 && refCanvasRect.height > 0) {
        const refScale = refCanvasRect.width / state.canvasW;
        const refDiameter = Math.max(6, state.brushSize * refScale);
        const refLeft = refCanvasRect.left - refFrameRect.left + normX * refCanvasRect.width;
        const refTop = refCanvasRect.top - refFrameRect.top + normY * refCanvasRect.height;

        dom.refBrushCursor.style.display = 'block';
        dom.refBrushCursor.style.width = `${refDiameter}px`;
        dom.refBrushCursor.style.height = `${refDiameter}px`;
        dom.refBrushCursor.style.left = `${refLeft}px`;
        dom.refBrushCursor.style.top = `${refTop}px`;
      }
    }
  }

  function handlePointerDown(e) {
    if (!state.roundActive) return;
    e.preventDefault();
    dom.drawCanvas.setPointerCapture(e.pointerId);
    state.isDrawing = true;
    state.lastStrokeAccuracy = state.liveAccuracy;
    updateBrushCursor(e);
    const pt = getCanvasCoords(e);
    state.lastPt = pt;
    paintDab(pt.x, pt.y);
    scheduleLiveEvaluation();
  }

  function handlePointerMove(e) {
    updateBrushCursor(e);
    if (!state.isDrawing || !state.roundActive) return;
    e.preventDefault();
    const pt = getCanvasCoords(e);
    paintSegment(state.lastPt || pt, pt);
    state.lastPt = pt;
    scheduleLiveEvaluation();
  }

  function handlePointerUp(e) {
    if (e && e.pointerType === 'touch' && dom.refBrushCursor) {
      dom.refBrushCursor.style.display = 'none';
    }
    if (!state.isDrawing) return;
    state.isDrawing = false;
    state.lastPt = null;
    const acc = evaluateAccuracy().accuracy;
    const delta = acc - state.lastStrokeAccuracy;
    updateLiveAccuracyUI(acc);
    if (Math.abs(delta) >= 0.15) {
      dom.strokeDelta.textContent = delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`;
      dom.strokeDelta.className = `stroke-delta ${delta > 0 ? 'up' : 'down'}`;
    }
  }

  // ==================== PIXEL-BY-PIXEL ACCURACY ENGINE ====================
  function scheduleLiveEvaluation() {
    if (state.evalThrottleId) return;
    state.evalThrottleId = setTimeout(() => {
      state.evalThrottleId = null;
      if (!state.roundActive) return;
      const res = evaluateAccuracy();
      updateLiveAccuracyUI(res.accuracy);
    }, 220);
  }

  function evaluateAccuracy(detailed = false) {
    const painting = state.currentPainting;
    const activePal = state.activePalette || painting.palette;
    const palRgb = activePal.map(window.ArtHelpers.hexToRgb);
    const palCount = palRgb.length;
    const ew = state.evalW;
    const eh = state.evalH;

    userEvalCtx.imageSmoothingEnabled = false;
    userEvalCtx.clearRect(0, 0, ew, eh);
    userEvalCtx.drawImage(state.strokeCanvas, 0, 0, ew, eh);
    const uData = userEvalCtx.getImageData(0, 0, ew, eh).data;
    const rData = state.refEvalData;
    const rIdx = state.refPaletteIndices;

    const totalPx = ew * eh;
    let matches = 0;

    const perColorTotal = detailed ? new Uint32Array(palCount) : null;
    const perColorMatch = detailed ? new Uint32Array(palCount) : null;
    const matchMask = detailed ? new Uint8Array(totalPx) : null;

    for (let i = 0; i < totalPx; i++) {
      const off = i * 4;
      const pIdx = rIdx[i];
      if (detailed) perColorTotal[pIdx]++;

      // Unpainted pixels (alpha < 128 on stroke layer) never score points
      if (uData[off + 3] < 128) continue;

      // Exact nearest-palette-index match (accurate even for 16 nuanced shades!)
      const ur = uData[off];
      const ug = uData[off + 1];
      const ub = uData[off + 2];
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let p = 0; p < palCount; p++) {
        const dr = ur - palRgb[p][0];
        const dg = ug - palRgb[p][1];
        const db = ub - palRgb[p][2];
        const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = p;
          if (d === 0) break;
        }
      }

      if (bestIdx === pIdx) {
        matches++;
        if (detailed) {
          perColorMatch[pIdx]++;
          matchMask[i] = 1;
        }
      }
    }

    const accuracy = (matches / totalPx) * 100;
    state.liveAccuracy = accuracy;

    if (!detailed) return { accuracy };

    const breakdown = activePal.map((hex, idx) => ({
      hex,
      total: perColorTotal[idx],
      matched: perColorMatch[idx],
      pct: perColorTotal[idx] > 0 ? (perColorMatch[idx] / perColorTotal[idx]) * 100 : 100
    }));

    return { accuracy, breakdown, matchMask };
  }

  function updateLiveAccuracyUI(acc) {
    const rank = getRankInfo(acc);
    dom.liveAccuracyValue.textContent = `${acc.toFixed(1)}%`;
    dom.liveAccuracyFill.style.width = `${Math.min(100, acc).toFixed(1)}%`;
    dom.liveRankBadge.textContent = rank.label;
    dom.liveRankBadge.className = `rank-pill ${rank.cls}`;
  }

  // ==================== FINISH & RESULT COMPARISON ====================
  let lastDetailedResult = null;

  function finishRound() {
    if (!state.roundStarted) return;
    stopTimer();
    clearPeek();
    state.roundActive = false;
    state.isDrawing = false;

    const timeUsed = Math.max(1, state.timeLimit - state.timeLeft);
    const result = evaluateAccuracy(true);
    lastDetailedResult = result;
    const acc = result.accuracy;
    const rank = getRankInfo(acc);
    const p = state.currentPainting;

    window.SoundFX.finish(acc);

    // Generate compact thumbnail of user's painting for records
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 160;
    thumbCanvas.height = 120;
    thumbCanvas.getContext('2d').drawImage(dom.drawCanvas, 0, 0, 160, 120);
    const thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.72);

    // Record best & history
    const prevBest = state.records.bestById[p.id];
    const isNewBest = !prevBest || acc > prevBest.bestAccuracy;
    state.records.bestById[p.id] = {
      id: p.id,
      title: p.title,
      artist: p.artist,
      bestAccuracy: isNewBest ? acc : prevBest.bestAccuracy,
      bestRank: isNewBest ? rank.label : prevBest.bestRank,
      plays: (prevBest ? prevBest.plays : 0) + 1,
      bestTimeUsed: isNewBest ? timeUsed : prevBest.bestTimeUsed,
      bestThumb: isNewBest ? thumbUrl : prevBest.bestThumb,
      updatedAt: Date.now()
    };

    const colorCount = (state.activePalette || p.palette).length;
    const modeLabel = `3 分鐘 · ${colorCount}色`;
    state.records.history.unshift({
      id: p.id,
      title: p.title,
      artist: p.artist,
      accuracy: acc,
      rank: rank.label,
      difficultyLabel: modeLabel,
      timeLimit: state.timeLimit,
      timeUsed,
      thumb: thumbUrl,
      date: new Date().toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    });
    if (state.records.history.length > 60) {
      state.records.history.length = 60;
    }
    saveRecords();

    // Populate Result Header
    const en = isEn();
    dom.resultTitle.textContent = `${pTitle(p)} · ${pArtist(p)}`;
    dom.resultCritic.textContent = rank.quote;
    dom.resultAccuracy.textContent = acc.toFixed(1);
    dom.resultRankStamp.textContent = rank.label;
    dom.resultRankStamp.className = `rank-stamp ${rank.cls}`;
    dom.resultNewBest.classList.toggle('hidden', !isNewBest);
    dom.resultTimeUsed.textContent = en
      ? `3 Min · ${colorCount} Colors · Time ${formatTime(timeUsed)} / ${formatTime(state.timeLimit)}`
      : `${modeLabel} · 用時 ${formatTime(timeUsed)} / ${formatTime(state.timeLimit)}`;

    // Populate Comparison Canvases
    copyCanvas(dom.refCanvas, dom.resOrigCanvas);
    copyCanvas(dom.drawCanvas, dom.resUserCanvas);
    copyCanvas(dom.refCanvas, dom.resSliderOrig);
    copyCanvas(dom.drawCanvas, dom.resSliderUser);
    copyCanvas(dom.drawCanvas, dom.resOvUser);
    copyCanvas(dom.refCanvas, dom.resOvOrig);

    dom.chkHideMissed.checked = false;
    renderDiffCanvas(result.matchMask, false);
    renderColorBreakdown(result.breakdown);

    // Prepare Global Leaderboard submission box
    state.lastRoundSummary = {
      paintingId: p.id,
      paintingTitle: p.title,
      paintingEnTitle: p.enTitle,
      accuracy: acc,
      rank: rank.label,
      timeUsed
    };
    if (window.GitHubLeaderboard && dom.playerNameInput) {
      const savedName = window.GitHubLeaderboard.getPlayerName();
      dom.playerNameInput.value = savedName;
      if (savedName) {
        submitCurrentScoreToLeaderboard(false);
      } else if (dom.lbSubmitStatus) {
        dom.lbSubmitStatus.textContent = en
          ? '💡 Enter your artist nickname and click "Submit Score" to join the online leaderboard!'
          : '💡 輸入畫家署名並點擊「登錄成績」，即可列入全球排行榜！';
      }
    }

    // Reset comparison tab to Side-by-Side
    setCompareMode('side');
    showScreen('result');
    syncSliderGeometry();
  }

  async function submitCurrentScoreToLeaderboard(requireInput = true) {
    if (!window.GitHubLeaderboard || !state.lastRoundSummary) return;
    const en = isEn();
    const rawName = dom.playerNameInput ? dom.playerNameInput.value.trim() : '';
    if (requireInput && !rawName) {
      dom.playerNameInput.focus();
      dom.lbSubmitStatus.textContent = en
        ? '⚠️ Please enter your artist nickname first!'
        : '⚠️ 請先輸入您的畫家署名（暱稱）！';
      return;
    }
    const playerName = rawName || window.GitHubLeaderboard.getPlayerName() || (en ? 'Anonymous Artist' : '匿名畫家');
    if (dom.lbSubmitStatus) {
      dom.lbSubmitStatus.textContent = en
        ? '⏳ Updating online leaderboard…'
        : '⏳ 正在計算名次並更新線上排行榜…';
    }
    const res = await window.GitHubLeaderboard.submitScore({
      player: playerName,
      paintingId: state.lastRoundSummary.paintingId,
      paintingTitle: state.lastRoundSummary.paintingTitle,
      accuracy: state.lastRoundSummary.accuracy,
      rank: state.lastRoundSummary.rank,
      timeUsed: state.lastRoundSummary.timeUsed
    });
    if (dom.lbSubmitStatus && res && res.ok) {
      const displayTitle = en
        ? state.lastRoundSummary.paintingEnTitle || state.lastRoundSummary.paintingTitle
        : state.lastRoundSummary.paintingTitle;
      dom.lbSubmitStatus.textContent = en
        ? `🏅 #${res.paintingRank} on "${displayTitle}" · #${res.overallRank} Overall — ✅ Online Leaderboard Updated!`
        : `🏅 《${displayTitle}》第 ${res.paintingRank} 名 · 全站總榜第 ${res.overallRank} 名 — ✅ 已自動更新線上排行榜！`;
    }
    // Automatically refresh the leaderboard list in the background
    renderGlobalLeaderboardTab();
  }

  function copyCanvas(src, dst) {
    const ctx = dst.getContext('2d');
    ctx.clearRect(0, 0, dst.width, dst.height);
    ctx.drawImage(src, 0, 0, dst.width, dst.height);
  }

  function renderDiffCanvas(matchMask, hideMissed) {
    const ew = state.evalW;
    const eh = state.evalH;
    const tmp = document.createElement('canvas');
    tmp.width = ew;
    tmp.height = eh;
    const tCtx = tmp.getContext('2d');
    const out = tCtx.createImageData(ew, eh);
    const oData = out.data;
    const rData = state.refEvalData;

    for (let i = 0; i < matchMask.length; i++) {
      const off = i * 4;
      if (matchMask[i]) {
        // Correct pixel: show original true color
        oData[off] = rData[off];
        oData[off + 1] = rData[off + 1];
        oData[off + 2] = rData[off + 2];
        oData[off + 3] = 255;
      } else if (hideMissed) {
        // Hide missed pixels: clean neutral checkerboard/cream
        const checker = ((i % ew) + Math.floor(i / ew)) % 2 === 0 ? 242 : 228;
        oData[off] = checker;
        oData[off + 1] = checker;
        oData[off + 2] = checker;
        oData[off + 3] = 255;
      } else {
        // Highlight missed pixels in vivid magenta tint over dimmed original
        oData[off] = Math.min(255, Math.round(rData[off] * 0.35 + 255 * 0.65));
        oData[off + 1] = Math.round(rData[off + 1] * 0.25 + 45 * 0.75);
        oData[off + 2] = Math.round(rData[off + 2] * 0.35 + 120 * 0.65);
        oData[off + 3] = 255;
      }
    }
    tCtx.putImageData(out, 0, 0);

    const dCtx = dom.resDiffCanvas.getContext('2d');
    dCtx.imageSmoothingEnabled = false;
    dCtx.clearRect(0, 0, state.canvasW, state.canvasH);
    dCtx.drawImage(tmp, 0, 0, state.canvasW, state.canvasH);
  }

  function renderColorBreakdown(breakdown) {
    dom.colorBreakdownList.innerHTML = '';
    const en = isEn();
    breakdown.forEach((item, idx) => {
      if (item.total === 0) return;
      const el = document.createElement('div');
      el.className = 'color-stat-item';
      el.innerHTML = `
        <span class="color-stat-swatch" style="background:${item.hex}"></span>
        <div class="color-stat-info">
          <div class="color-stat-top">
            <span>${en ? 'Color' : '色塊'} #${idx + 1}</span>
            <span>${item.pct.toFixed(0)}%</span>
          </div>
          <div class="color-stat-bar">
            <div style="width:${Math.min(100, item.pct).toFixed(1)}%"></div>
          </div>
        </div>
      `;
      dom.colorBreakdownList.appendChild(el);
    });
  }

  function setCompareMode(mode) {
    dom.compareModeGroup.querySelectorAll('.pill-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    ['side', 'slider', 'diff', 'overlay'].forEach((m) => {
      $(`view-${m}`).classList.toggle('active', m === mode);
    });
    dom.diffOptions.classList.toggle('hidden', mode !== 'diff');
    if (mode === 'slider') {
      requestAnimationFrame(syncSliderGeometry);
    }
  }

  function syncSliderGeometry() {
    const innerW = dom.resSliderUser.clientWidth;
    if (innerW > 0) {
      dom.sliderClip.style.setProperty('--slider-full-w', `${innerW}px`);
    }
    const pct = Number(dom.sliderInput.value);
    dom.sliderClip.style.width = `calc(${pct}% - ${pct * 0.2}px)`;
    dom.sliderHandle.style.left = `${pct}%`;
  }

  // ==================== POSTCARD DOWNLOAD ====================
  function downloadPostcard() {
    const p = state.currentPainting;
    if (!p || !lastDetailedResult) return;

    const out = document.createElement('canvas');
    out.width = 1080;
    out.height = 520;
    const ctx = out.getContext('2d');

    // Warm gallery postcard background
    ctx.fillStyle = '#F4EEE4';
    ctx.fillRect(0, 0, out.width, out.height);

    // Header text
    const en = isEn();
    ctx.fillStyle = '#1F1A17';
    ctx.font = 'bold 28px "Noto Sans TC", sans-serif';
    ctx.fillText(
      en ? `Hasty Replicas · ${pTitle(p)} (${pArtist(p)})` : `名畫急就章 · ${p.title} (${p.artist})`,
      40,
      52
    );

    const acc = lastDetailedResult.accuracy;
    const rank = getRankInfo(acc);
    ctx.fillStyle = '#9E7122';
    ctx.font = 'bold 26px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(en ? `Accuracy ${acc.toFixed(1)}%  [${rank.label}]` : `完成度 ${acc.toFixed(1)}%  [${rank.label}]`, 1040, 52);
    ctx.textAlign = 'left';

    // Frames (fit true aspect ratio cleanly inside the two postcard slots)
    const maxW = 472, maxH = 352;
    const ratio = state.canvasW / state.canvasH;
    let dw = maxW, dh = maxW / ratio;
    if (dh > maxH) {
      dh = maxH;
      dw = maxH * ratio;
    }
    const ox1 = 44 + (maxW - dw) / 2;
    const oy1 = 84 + (maxH - dh) / 2;
    const ox2 = 564 + (maxW - dw) / 2;

    ctx.fillStyle = '#25201D';
    ctx.fillRect(ox1 - 8, oy1 - 8, dw + 16, dh + 16);
    ctx.fillRect(ox2 - 8, oy1 - 8, dw + 16, dh + 16);

    ctx.drawImage(dom.refCanvas, ox1, oy1, dw, dh);
    ctx.drawImage(dom.drawCanvas, ox2, oy1, dw, dh);

    ctx.fillStyle = '#5C524B';
    ctx.font = 'bold 18px "Noto Sans TC", sans-serif';
    ctx.fillText(en ? 'Reference (16 Colors · 3 Min)' : '原作參考（16 色 · 3 分鐘）', 44, 474);
    ctx.fillText(en ? 'Your Replica' : '你的臨摹作品', 564, 474);

    ctx.fillStyle = '#8A7F76';
    ctx.font = '15px "Noto Sans TC", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Hasty Replicas · 名畫急就章', 1040, 474);

    const link = document.createElement('a');
    link.download = `hasty-replica-${p.id}-${Math.round(acc)}pct.png`;
    link.href = out.toDataURL('image/png');
    link.click();
  }

  // ==================== ORIGINAL MASTERPIECE MODAL ====================
  function openOriginalModal() {
    const p = state.currentPainting;
    if (!p) return;
    window.SoundFX.click();
    const en = isEn();
    dom.origModalTitle.textContent = en ? `${p.enTitle} (${p.title})` : `${p.title} (${p.enTitle})`;
    dom.origModalSubtitle.textContent = `${pArtist(p)} · ${p.year} · ${catLabel(p.category)}`;
    dom.origModalDesc.textContent = pIntro(p);
    dom.origModalImg.onerror = () => {
      dom.origModalImg.onerror = null;
      dom.origModalImg.src = dom.refCanvas.toDataURL('image/png');
    };
    dom.origModalImg.src = window.ArtHelpers.getOriginalImageUrl(p);
    dom.modalOriginal.classList.remove('hidden');
  }

  function closeOriginalModal() {
    dom.modalOriginal.classList.add('hidden');
  }

  // ==================== RECORDS & GLOBAL LEADERBOARD MODAL ====================
  function populateGlobalFilterOptions() {
    if (!dom.globalLbFilter || dom.globalLbFilter.options.length > 1) return;
    window.PAINTINGS.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${pTitle(p)} (${pArtist(p)})`;
      dom.globalLbFilter.appendChild(opt);
    });
  }

  async function renderGlobalLeaderboardTab() {
    if (!window.GitHubLeaderboard || !dom.globalLbList) return;
    populateGlobalFilterOptions();
    const en = isEn();

    dom.globalLbStatus.textContent = en ? '⏳ Syncing live online leaderboard…' : '⏳ 正在同步最新排行榜…';
    const db = await window.GitHubLeaderboard.fetchLeaderboard();
    const filterId = dom.globalLbFilter ? dom.globalLbFilter.value : 'all';
    const allEntries = Array.isArray(db.entries) ? db.entries : [];
    const filtered =
      filterId === 'all' ? allEntries.slice(0, 50) : allEntries.filter((e) => e.paintingId === filterId).slice(0, 30);

    const syncTime = db.updatedAt ? new Date(db.updatedAt).toLocaleString(en ? 'en-US' : 'zh-TW') : '';
    dom.globalLbStatus.textContent = en
      ? `📊 Live Global Leaderboard${syncTime ? ` · Updated ${syncTime}` : ''}`
      : `📊 全球即時排行榜${syncTime ? ` · 更新於 ${syncTime}` : ''}`;

    dom.globalLbList.innerHTML = '';
    if (!filtered.length) {
      dom.globalLbList.innerHTML = `<div class="empty-records">${
        en ? 'No global records for this masterpiece yet — be the first to claim #1!' : '此畫作目前尚無全球排行紀錄，快來搶下第一名！'
      }</div>`;
      return;
    }

    filtered.forEach((item, idx) => {
      const rankInfo = getRankInfo(item.accuracy);
      const medal = idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`;
      const matchedP = window.PAINTINGS.find((p) => p.id === item.paintingId);
      const pName = matchedP ? pTitle(matchedP) : item.paintingTitle;
      const row = document.createElement('div');
      row.className = `lb-row${idx === 0 ? ' lb-top-1' : ''}`;
      row.innerHTML = `
        <div class="lb-rank-num">${medal}</div>
        <div class="lb-player-name" title="${item.player}">${item.player}</div>
        <div class="lb-painting-info" title="${pName} · ${item.date || ''}">${en ? `"${pName}"` : `《${pName}》`} <small>${item.date || ''}</small></div>
        <div class="lb-score-col">
          <span class="lb-time-val">${formatTime(item.timeUsed || 180)}</span>
          <span class="rank-pill ${rankInfo.cls}">${item.rank || rankInfo.label}</span>
          <span class="lb-acc-val">${Number(item.accuracy).toFixed(1)}%</span>
        </div>
      `;
      dom.globalLbList.appendChild(row);
    });
  }

  function openRecordsModal(defaultFilterId = null) {
    window.SoundFX.click();
    populateGlobalFilterOptions();
    if (defaultFilterId && typeof defaultFilterId === 'string' && dom.globalLbFilter) {
      dom.globalLbFilter.value = defaultFilterId;
    }
    renderRecordsModal();
    renderGlobalLeaderboardTab();
    dom.modalRecords.classList.remove('hidden');
  }

  function closeRecordsModal() {
    dom.modalRecords.classList.add('hidden');
  }

  function renderRecordsModal() {
    const en = isEn();
    // Tab 2: Best per painting
    const bestList = Object.values(state.records.bestById).sort((a, b) => b.bestAccuracy - a.bestAccuracy);
    dom.recordsTabBest.innerHTML = '';
    if (!bestList.length) {
      dom.recordsTabBest.innerHTML = `<div class="empty-records">${
        en ? 'No records yet — pick a masterpiece and start painting!' : '還沒有任何臨摹紀錄，快選一幅名畫開始挑戰吧！'
      }</div>`;
    } else {
      bestList.forEach((item) => {
        const matchedP = window.PAINTINGS.find((p) => p.id === item.id);
        const titleStr = matchedP ? pTitle(matchedP) : item.title;
        const artistStr = matchedP ? pArtist(matchedP) : item.artist;
        const rank = getRankInfo(item.bestAccuracy);
        const row = document.createElement('div');
        row.className = 'record-row';
        row.innerHTML = `
          <img class="record-thumb" src="${item.bestThumb || ''}" alt="${titleStr}" />
          <div class="record-info">
            <div class="record-title">${titleStr}</div>
            <div class="record-meta">${artistStr} · ${
          en ? `${item.plays} plays · Best time ${formatTime(item.bestTimeUsed)}` : `挑戰 ${item.plays} 次 · 最佳用時 ${formatTime(item.bestTimeUsed)}`
        }</div>
          </div>
          <div class="record-score">
            <span class="rank-pill ${rank.cls}">${item.bestRank}</span>
            <span>${item.bestAccuracy.toFixed(1)}%</span>
          </div>
        `;
        dom.recordsTabBest.appendChild(row);
      });
    }

    // Tab 3: Recent history
    dom.recordsTabHistory.innerHTML = '';
    if (!state.records.history.length) {
      dom.recordsTabHistory.innerHTML = `<div class="empty-records">${
        en ? 'No recent play history yet.' : '尚無挑戰歷史紀錄。'
      }</div>`;
    } else {
      state.records.history.forEach((item) => {
        const matchedP = window.PAINTINGS.find((p) => p.id === item.id);
        const titleStr = matchedP ? pTitle(matchedP) : item.title;
        const rank = getRankInfo(item.accuracy);
        const row = document.createElement('div');
        row.className = 'record-row';
        row.innerHTML = `
          <img class="record-thumb" src="${item.thumb || ''}" alt="${titleStr}" />
          <div class="record-info">
            <div class="record-title">${titleStr}</div>
            <div class="record-meta">${item.date} · ${
          en ? `Time ${formatTime(item.timeUsed)}` : `用時 ${formatTime(item.timeUsed)}`
        }</div>
          </div>
          <div class="record-score">
            <span class="rank-pill ${rank.cls}">${item.rank}</span>
            <span>${item.accuracy.toFixed(1)}%</span>
          </div>
        `;
        dom.recordsTabHistory.appendChild(row);
      });
    }
  }

  // ==================== EVENT LISTENERS ====================
  function bindEvents() {
    // Category tabs
    dom.categoryTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.cat-tab');
      if (!tab) return;
      state.activeCategory = tab.dataset.cat;
      dom.categoryTabs.querySelectorAll('.cat-tab').forEach((t) => t.classList.toggle('active', t === tab));
      window.SoundFX.click();
      renderGallery();
    });

    // Gallery search
    dom.gallerySearch.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderGallery();
    });

    // Random masterpiece button
    dom.btnRandom.addEventListener('click', () => {
      window.SoundFX.click();
      const unplayed = window.PAINTINGS.filter((p) => !state.records.bestById[p.id]);
      const pool = unplayed.length ? unplayed : window.PAINTINGS;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      openPaintingStudio(pick);
    });

    // Language & Sound toggles
    if (dom.btnLangHome) dom.btnLangHome.addEventListener('click', toggleLanguage);
    if (dom.btnLangPlay) dom.btnLangPlay.addEventListener('click', toggleLanguage);

    const toggleSound = () => {
      window.SoundFX.toggleMute();
      updateSoundIcons();
    };
    dom.btnSoundHome.addEventListener('click', toggleSound);
    dom.btnSoundPlay.addEventListener('click', toggleSound);

    // Studio controls
    dom.btnStartRound.addEventListener('click', startRound);
    dom.btnBackGallery.addEventListener('click', () => {
      stopTimer();
      clearPeek();
      state.roundActive = false;
      window.SoundFX.click();
      renderGallery();
      showScreen('gallery');
    });

    dom.btnGridToggle.addEventListener('click', () => {
      state.gridVisible = !state.gridVisible;
      dom.refGridOverlay.classList.toggle('visible', state.gridVisible);
      dom.drawGridOverlay.classList.toggle('visible', state.gridVisible);
      dom.btnGridToggle.classList.toggle('active-toggle', state.gridVisible);
      window.SoundFX.click();
    });

    dom.btnPeek.addEventListener('click', triggerPeek);
    dom.btnSubmitEarly.addEventListener('click', () => {
      if (!state.roundStarted) return;
      finishRound();
    });

    dom.btnViewOriginal.addEventListener('click', openOriginalModal);
    dom.btnResultViewOriginal.addEventListener('click', openOriginalModal);
    dom.btnCloseOriginal.addEventListener('click', closeOriginalModal);
    dom.btnCloseOriginalBottom.addEventListener('click', closeOriginalModal);
    dom.modalOriginal.addEventListener('click', (e) => {
      if (e.target === dom.modalOriginal) closeOriginalModal();
    });

    dom.btnToggleRefSize.addEventListener('click', () => {
      dom.referencePanel.classList.toggle('expanded');
    });

    dom.refPlaque.addEventListener('click', () => {
      dom.refPlaque.classList.toggle('expanded');
    });

    // Brush size dock
    dom.brushSizes.addEventListener('click', (e) => {
      const btn = e.target.closest('.brush-btn');
      if (!btn) return;
      selectBrushSize(Number(btn.dataset.size), true);
    });

    // Canvas pointer events & Reference Eyedropper
    dom.refCanvas.addEventListener('pointerdown', pickColorFromReference);
    dom.drawCanvas.addEventListener('pointerdown', handlePointerDown);
    dom.drawCanvas.addEventListener('pointermove', handlePointerMove);
    dom.drawCanvas.addEventListener('pointerup', handlePointerUp);
    dom.drawCanvas.addEventListener('pointercancel', handlePointerUp);
    dom.drawCanvas.addEventListener('pointerleave', () => {
      dom.brushCursor.style.display = 'none';
      if (dom.refBrushCursor) dom.refBrushCursor.style.display = 'none';
    });

    // Result controls
    dom.compareModeGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill-btn');
      if (!btn) return;
      window.SoundFX.click();
      setCompareMode(btn.dataset.mode);
    });

    dom.sliderInput.addEventListener('input', syncSliderGeometry);
    window.addEventListener('resize', () => {
      if (state.canvasW && state.canvasH) {
        updateResponsiveFrameVars(state.canvasW, state.canvasH);
      }
      if (screens.result.classList.contains('active')) {
        syncSliderGeometry();
      }
    });

    dom.chkHideMissed.addEventListener('change', () => {
      if (lastDetailedResult) {
        renderDiffCanvas(lastDetailedResult.matchMask, dom.chkHideMissed.checked);
      }
    });

    dom.overlayOpacitySlider.addEventListener('input', (e) => {
      dom.resOvOrig.style.opacity = String(Number(e.target.value) / 100);
    });

    dom.btnRetry.addEventListener('click', () => {
      window.SoundFX.click();
      openPaintingStudio(state.currentPainting);
    });

    dom.btnNext.addEventListener('click', () => {
      window.SoundFX.click();
      const idx = window.PAINTINGS.findIndex((p) => p.id === state.currentPainting.id);
      const next = window.PAINTINGS[(idx + 1) % window.PAINTINGS.length];
      openPaintingStudio(next);
    });

    dom.btnDownload.addEventListener('click', () => {
      window.SoundFX.click();
      downloadPostcard();
    });

    dom.btnResultGallery.addEventListener('click', () => {
      window.SoundFX.click();
      renderGallery();
      showScreen('gallery');
    });

    // Result Leaderboard Submission & Modal
    if (dom.btnSubmitLeaderboard) {
      dom.btnSubmitLeaderboard.addEventListener('click', () => {
        window.SoundFX.click();
        submitCurrentScoreToLeaderboard(true);
      });
    }
    if (dom.playerNameInput) {
      dom.playerNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitCurrentScoreToLeaderboard(true);
        }
      });
    }
    if (dom.btnResultOpenLeaderboard) {
      dom.btnResultOpenLeaderboard.addEventListener('click', () => {
        const pid = state.currentPainting ? state.currentPainting.id : 'all';
        openRecordsModal(pid);
      });
    }

    // Records & Global Leaderboard Modal
    dom.btnOpenRecords.addEventListener('click', () => openRecordsModal('all'));
    dom.btnCloseRecords.addEventListener('click', closeRecordsModal);
    dom.btnCloseRecordsBottom.addEventListener('click', closeRecordsModal);
    dom.modalRecords.addEventListener('click', (e) => {
      if (e.target === dom.modalRecords) closeRecordsModal();
    });

    if (dom.globalLbFilter) {
      dom.globalLbFilter.addEventListener('change', () => {
        renderGlobalLeaderboardTab();
      });
    }
    if (dom.btnRefreshGlobalLb) {
      dom.btnRefreshGlobalLb.addEventListener('click', () => {
        window.SoundFX.click();
        renderGlobalLeaderboardTab();
      });
    }

    document.querySelectorAll('.modal-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.modal-tab').forEach((t) => t.classList.toggle('active', t === tab));
        if (dom.recordsTabGlobal) dom.recordsTabGlobal.classList.toggle('active', target === 'global');
        dom.recordsTabBest.classList.toggle('active', target === 'best');
        dom.recordsTabHistory.classList.toggle('active', target === 'history');
        if (target === 'global') renderGlobalLeaderboardTab();
      });
    });

    dom.btnClearRecords.addEventListener('click', () => {
      const msg = isEn()
        ? 'Are you sure you want to clear all local personal best records and play history?'
        : '確定要清除所有名畫的最佳紀錄與挑戰歷史嗎？';
      if (!confirm(msg)) return;
      state.records = { bestById: {}, history: [] };
      saveRecords();
      renderRecordsModal();
      renderGallery();
    });

    // Desktop keyboard shortcuts in Studio & Modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeOriginalModal();
        closeRecordsModal();
        return;
      }
      if (!screens.play.classList.contains('active')) return;
      if (!dom.modalOriginal.classList.contains('hidden')) return;
      if (e.target.tagName === 'INPUT') return;

      const key = e.key.toLowerCase();
      if (key >= '1' && key <= '9') {
        selectColor(Number(key) - 1, true);
      } else if (key === '0') {
        selectColor(9, true);
      } else if (key === 'q') {
        selectBrushSize(8, true);
      } else if (key === 'w') {
        selectBrushSize(18, true);
      } else if (key === 'e') {
        selectBrushSize(36, true);
      } else if (key === 'r') {
        selectBrushSize(68, true);
      } else if (key === 'g') {
        dom.btnGridToggle.click();
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (!state.roundStarted) {
          startRound();
        } else {
          triggerPeek();
        }
      }
    });
  }

  // ==================== INIT ====================
  loadRecords();
  updateSoundIcons();
  bindEvents();
  applyLanguageUI();
})();
