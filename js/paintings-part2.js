/* ==========================================================================
   Western Classical Masterpieces — Part 2 (16 to 30 of 30)
   Difficulty (1 to 5 stars) calibrated by geometric color-block fragmentation!
   Neoclassical, Romantic & Realist Portraits (6) + Impressionism & Van Gogh (9)
   ========================================================================== */

(function () {
  const P = window.PAINTINGS;

  // --- 新古典、浪漫與寫實 (6) ---
  P.push(
    {
      id: 'vigee-straw-hat',
      title: '戴草帽的自畫像',
      enTitle: 'Self-Portrait in a Straw Hat',
      artist: '伊莉莎白·薇姬·勒布倫',
      year: '1782',
      category: 'romanticism',
      difficulty: 1,
      facets: 34,
      palette: ['#1E1B1A', '#4F6E8C', '#A84248', '#D9A85C', '#EBC8B2', '#F7F4EC']
    },
    {
      id: 'death-of-marat',
      title: '馬拉之死',
      enTitle: 'The Death of Marat',
      artist: '雅克-路易·大衛',
      year: '1793',
      category: 'romanticism',
      difficulty: 1,
      facets: 27,
      palette: ['#1C1A16', '#3E3A2C', '#4E6B4A', '#9E7B52', '#D9B896', '#EFECE2']
    },
    {
      id: 'napoleon-alps',
      title: '跨越阿爾卑斯山的拿破崙',
      enTitle: 'Napoleon Crossing the Alps',
      artist: '雅克-路易·大衛',
      year: '1801',
      category: 'romanticism',
      difficulty: 5,
      facets: 87,
      palette: ['#23304A', '#5C4636', '#7C8FA6', '#B82E28', '#E6B948', '#D9DDE0']
    },
    {
      id: 'princesse-broglie',
      title: '布羅伊公主肖像',
      enTitle: 'The Princesse de Broglie',
      artist: '尚-奧古斯特-多米尼克·安格爾',
      year: '1853',
      category: 'romanticism',
      difficulty: 1,
      facets: 34,
      palette: ['#1E2229', '#2B5B8C', '#6EA4D4', '#C99E54', '#EBC8B0', '#F7F5F0']
    },
    {
      id: 'whistlers-mother',
      title: '惠斯勒的母親',
      enTitle: "Whistler's Mother",
      artist: '詹姆斯·惠斯勒',
      year: '1871',
      category: 'romanticism',
      difficulty: 2,
      facets: 48,
      palette: ['#18191B', '#3E4246', '#737675', '#A6A49B', '#D6C8B4', '#EFECE4']
    },
    {
      id: 'madame-x',
      title: 'X 夫人肖像',
      enTitle: 'Portrait of Madame X',
      artist: '約翰·辛格·薩金特',
      year: '1884',
      category: 'romanticism',
      difficulty: 1,
      facets: 28,
      palette: ['#141416', '#4A362B', '#7A5B47', '#A6836B', '#E0C5B0', '#F5EAE0']
    }
  );

  // --- 印象派與梵谷 (9) ---
  P.push(
    {
      id: 'the-fifer',
      title: '吹笛子的男孩',
      enTitle: 'The Fifer',
      artist: '愛德華·馬內',
      year: '1866',
      category: 'impressionism',
      difficulty: 1,
      facets: 25,
      palette: ['#1C1B1A', '#C9322B', '#C7C0B2', '#D9A73E', '#E8C29B', '#F5EFE2']
    },
    {
      id: 'berthe-morisot',
      title: '貝絲·莫里索與紫羅蘭',
      enTitle: 'Berthe Morisot with a Bouquet of Violets',
      artist: '愛德華·馬內',
      year: '1872',
      category: 'impressionism',
      difficulty: 2,
      facets: 46,
      palette: ['#151515', '#3A3530', '#7D7265', '#C2A88B', '#E5D5BE', '#F4EFE4']
    },
    {
      id: 'van-gogh-beardless',
      title: '無鬍子自畫像',
      enTitle: 'Self-Portrait without Beard',
      artist: '文森·梵谷',
      year: '1889',
      category: 'impressionism',
      difficulty: 4,
      facets: 68,
      palette: ['#3B2820', '#5B6284', '#8A987E', '#B8783A', '#D9B274', '#E5E2C8']
    },
    {
      id: 'irene-renoir',
      title: '伊蓮·卡恩·達維勒小姐肖像',
      enTitle: "Portrait of Irène Cahen d'Anvers",
      artist: '皮耶-奧古斯特·雷諾瓦',
      year: '1880',
      category: 'impressionism',
      difficulty: 4,
      facets: 63,
      palette: ['#1A2E22', '#3B5C48', '#5A82B4', '#C96E38', '#EBC8B0', '#F5F2EC']
    },
    {
      id: 'van-gogh-self',
      title: '梵谷自畫像',
      enTitle: 'Self-Portrait (1889)',
      artist: '文森·梵谷',
      year: '1889',
      category: 'impressionism',
      difficulty: 5,
      facets: 78,
      palette: ['#234466', '#4E7D9E', '#8AB5C9', '#B8622E', '#D9A76A', '#DCE6EB']
    },
    {
      id: 'van-gogh-bandaged',
      title: '包紮耳朵的自畫像',
      enTitle: 'Self-Portrait with Bandaged Ear',
      artist: '文森·梵谷',
      year: '1889',
      category: 'impressionism',
      difficulty: 4,
      facets: 62,
      palette: ['#213830', '#4A6E5C', '#B85432', '#D9A758', '#E3C59E', '#F5F3EC']
    },
    {
      id: 'postman-roulin',
      title: '郵差魯林肖像',
      enTitle: 'Portrait of Joseph Roulin',
      artist: '文森·梵谷',
      year: '1889',
      category: 'impressionism',
      difficulty: 3,
      facets: 60,
      palette: ['#1D3557', '#3E6B52', '#7C5232', '#D9A738', '#E3C09E', '#F2E5C4']
    },
    {
      id: 'dr-gachet',
      title: '嘉舍醫師的肖像',
      enTitle: 'Portrait of Dr. Gachet',
      artist: '文森·梵谷',
      year: '1890',
      category: 'impressionism',
      difficulty: 5,
      facets: 87,
      palette: ['#1B3258', '#3B689E', '#8C382B', '#C99A4E', '#E3BE9A', '#F2EDE2']
    },
    {
      id: 'starry-night',
      title: '星夜',
      enTitle: 'The Starry Night',
      artist: '文森·梵谷',
      year: '1889',
      category: 'impressionism',
      difficulty: 5,
      facets: 90,
      palette: ['#132447', '#16241B', '#2B5B9E', '#7AA7D9', '#F2C94C', '#FFF3C4']
    }
  );
})();
