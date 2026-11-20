/* ==========================================================================
   Western Classical Masterpieces — Part 1 (1 to 15 of 30)
   Difficulty (1 to 5 stars) calibrated by geometric color-block fragmentation!
   Renaissance (8) + Baroque & Rococo Close-Up Portraits (7)
   ========================================================================== */

(function () {
  const P = window.PAINTINGS;

  // --- 文藝復興 (8) ---
  P.push(
    {
      id: 'mona-lisa',
      title: '蒙娜麗莎',
      enTitle: 'Mona Lisa',
      artist: '李奧納多·達文西',
      year: '1503',
      category: 'renaissance',
      difficulty: 2,
      facets: 42,
      palette: ['#14110F', '#2E2118', '#586B59', '#7C4F2B', '#8DA08E', '#D6A87C']
    },
    {
      id: 'lady-ermine',
      title: '抱銀貂的女子',
      enTitle: 'Lady with an Ermine',
      artist: '李奧納多·達文西',
      year: '1490',
      category: 'renaissance',
      difficulty: 2,
      facets: 37,
      palette: ['#141315', '#3A2822', '#8C3E2B', '#2C4968', '#D9A782', '#F2EDE2']
    },
    {
      id: 'ginevra-benci',
      title: '吉內薇拉·班琪肖像',
      enTitle: "Ginevra de' Benci",
      artist: '李奧納多·達文西',
      year: '1474',
      category: 'renaissance',
      difficulty: 5,
      facets: 82,
      palette: ['#1B241E', '#3A4A38', '#7A4E2D', '#5A788C', '#D9B28C', '#F2DEC0']
    },
    {
      id: 'la-belle-ferronniere',
      title: '美麗的費隆妮葉夫人',
      enTitle: 'La Belle Ferronnière',
      artist: '李奧納多·達文西',
      year: '1490',
      category: 'renaissance',
      difficulty: 2,
      facets: 38,
      palette: ['#141210', '#4A2B1E', '#9E3228', '#C99648', '#DFA982', '#F5DEC2']
    },
    {
      id: 'man-red-turban',
      title: '紅頭巾男子肖像',
      enTitle: 'Portrait of a Man in a Red Turban',
      artist: '揚·范·艾克',
      year: '1433',
      category: 'renaissance',
      difficulty: 4,
      facets: 64,
      palette: ['#120E0D', '#3B1E18', '#7C1E1B', '#B82B24', '#C9986E', '#EAD0B3']
    },
    {
      id: 'young-woman-botticelli',
      title: '年輕女子肖像（西蒙內塔）',
      enTitle: 'Portrait of a Young Woman',
      artist: '桑德羅·波提切利',
      year: '1480',
      category: 'renaissance',
      difficulty: 3,
      facets: 59,
      palette: ['#24221F', '#5C4430', '#A8583B', '#D99B52', '#E8C6A4', '#F7EFE2']
    },
    {
      id: 'baldassare-castiglione',
      title: '卡斯蒂廖內肖像',
      enTitle: 'Portrait of Baldassare Castiglione',
      artist: '拉斐爾',
      year: '1515',
      category: 'renaissance',
      difficulty: 4,
      facets: 61,
      palette: ['#181615', '#3D352E', '#7A6C5D', '#A68E74', '#D9B492', '#F2EFE8']
    },
    {
      id: 'duke-urbino',
      title: '烏爾比諾公爵肖像',
      enTitle: 'Portrait of Federico da Montefeltro',
      artist: '皮耶羅·德拉·法蘭契斯卡',
      year: '1472',
      category: 'renaissance',
      difficulty: 1,
      facets: 31,
      palette: ['#28221D', '#526856', '#B82B24', '#8AB4CC', '#D6A47C', '#E8DEC8']
    }
  );

  // --- 巴洛克與洛可可 (7) ---
  P.push(
    {
      id: 'pearl-earring',
      title: '戴珍珠耳環的少女',
      enTitle: 'Girl with a Pearl Earring',
      artist: '約翰尼斯·維梅爾',
      year: '1665',
      category: 'baroque',
      difficulty: 4,
      facets: 63,
      palette: ['#151412', '#205387', '#7A5438', '#D6A33A', '#EAC096', '#F7F3E8']
    },
    {
      id: 'milkmaid',
      title: '倒牛奶的女僕',
      enTitle: 'The Milkmaid',
      artist: '約翰尼斯·維梅爾',
      year: '1658',
      category: 'baroque',
      difficulty: 2,
      facets: 44,
      palette: ['#3B2C22', '#214A7A', '#A85532', '#8C816E', '#E3B436', '#D9D2C0']
    },
    {
      id: 'rembrandt-self',
      title: '林布蘭自畫像',
      enTitle: 'Self-Portrait with Two Circles',
      artist: '林布蘭',
      year: '1665',
      category: 'baroque',
      difficulty: 2,
      facets: 39,
      palette: ['#1A1512', '#4A3121', '#8C5432', '#B88454', '#D9B694', '#EFE6D5']
    },
    {
      id: 'laughing-cavalier',
      title: '微笑的騎士',
      enTitle: 'The Laughing Cavalier',
      artist: '法蘭斯·哈爾斯',
      year: '1624',
      category: 'baroque',
      difficulty: 3,
      facets: 60,
      palette: ['#181615', '#3E484D', '#8C5E38', '#C99A4E', '#E0B492', '#F5F2EA']
    },
    {
      id: 'bacchus',
      title: '酒神巴克斯',
      enTitle: 'Bacchus',
      artist: '卡拉瓦喬',
      year: '1595',
      category: 'baroque',
      difficulty: 3,
      facets: 61,
      palette: ['#1A1714', '#3D4F2E', '#8C322B', '#A8825C', '#E3BE9A', '#F5EFE4']
    },
    {
      id: 'pope-innocent-x',
      title: '教宗英諾森十世肖像',
      enTitle: 'Portrait of Innocent X',
      artist: '迪亞哥·委拉斯開茲',
      year: '1650',
      category: 'baroque',
      difficulty: 3,
      facets: 54,
      palette: ['#2B1816', '#781E1E', '#B82E2E', '#C99E48', '#DFA888', '#F5F2EC']
    },
    {
      id: 'blue-boy',
      title: '藍衣少年',
      enTitle: 'The Blue Boy',
      artist: '湯瑪斯·庚斯博羅',
      year: '1770',
      category: 'baroque',
      difficulty: 3,
      facets: 52,
      palette: ['#241F1A', '#1E466E', '#4E82B4', '#8C6E4A', '#E3C2A4', '#F5F2EB']
    }
  );
})();
