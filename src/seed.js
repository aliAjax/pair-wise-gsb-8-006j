export const seed = {
  name: '暮光边境',
  system: 'D&D 5E',
  players: [
    { id: 'p-lin', name: '林默' },
    { id: 'p-an', name: '安然' },
    { id: 'p-zhou', name: '周岳' }
  ],
  characters: [
    { id: 'c-adrian', name: '艾德里安', role: '圣骑士', playerId: 'p-lin', color: '#d8a153' },
    { id: 'c-seline', name: '瑟琳', role: '游侠', playerId: 'p-an', color: '#93b7a6' },
    { id: 'c-moore', name: '莫尔', role: '术士', playerId: 'p-zhou', color: '#b9a6d1' }
  ],
  sessions: [
    {
      id: 1,
      date: '2024-06-08',
      title: '第一章：灰港的钟声',
      summary: '队伍抵达灰港，在失落的钟楼发现了神秘符文。',
      tag: '主线',
      color: '#d8a153',
      attendance: {
        'p-lin': 'present',
        'p-an': 'absent',
        'p-zhou': 'present'
      },
      guests: [{ id: 'g-gm', name: '主持人' }],
      operators: {
        'c-adrian': 'player:p-lin',
        'c-seline': 'guest:g-gm',
        'c-moore': 'player:p-zhou'
      },
      proxyRecords: {
        'c-seline': {
          operatorToken: 'guest:g-gm',
          status: 'pending',
          note: '瑟琳代管：跟随队伍进入钟楼，并建议先保留符文拓片。',
          createdAt: '2024-06-08T22:40:00+08:00'
        }
      },
      note: '灰港钟声在午夜停了一拍，符文拓片暂时由艾德里安保管。',
      archived: false,
      archivedAt: null,
      amendments: [],
      revisions: []
    },
    {
      id: 2,
      date: '2024-06-15',
      title: '第二章：雾中来客',
      summary: '与流浪法师伊琳结盟，追踪海雾中的脚印。',
      tag: '主线',
      color: '#93b7a6',
      attendance: {
        'p-lin': 'present',
        'p-an': 'present',
        'p-zhou': 'present'
      },
      guests: [],
      operators: {
        'c-adrian': 'player:p-lin',
        'c-seline': 'player:p-an',
        'c-moore': 'player:p-zhou'
      },
      proxyRecords: {},
      note: '伊琳只愿意同行到北岸，海雾里的脚印带有水草气味。',
      archived: true,
      archivedAt: '2024-06-15T23:20:00+08:00',
      amendments: [],
      revisions: []
    },
    {
      id: 3,
      date: '2024-06-22',
      title: '支线：深林采药',
      summary: '帮助村民寻找月光草，获得一枚古老铜币。',
      tag: '支线',
      color: '#b9a6d1',
      attendance: {
        'p-lin': 'present',
        'p-an': 'present',
        'p-zhou': 'absent'
      },
      guests: [{ id: 'g-standin', name: '候补：阿澄' }],
      operators: {
        'c-adrian': 'player:p-lin',
        'c-seline': 'player:p-an',
        'c-moore': 'guest:g-standin'
      },
      proxyRecords: {
        'c-moore': {
          operatorToken: 'guest:g-standin',
          status: 'confirmed',
          note: '莫尔代管：辨认月光草的药性，同意收下古老铜币作为报酬。',
          createdAt: '2024-06-22T21:10:00+08:00',
          decidedAt: '2024-06-29T20:05:00+08:00'
        }
      },
      note: '月光草生长在旧祭坛北侧，古老铜币背面刻着船帆纹样。',
      archived: false,
      archivedAt: null,
      amendments: [],
      revisions: []
    }
  ]
};
