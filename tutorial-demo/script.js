'use strict';
// All times are milliseconds. Scene beats below are normalized to their scene duration.
const DEBUG = false;
const GAME_CONFIG = {
  rooms: ['Room A','Room B'], totalExchanges: 3,
  effects: { enabled: true, dustCount: 16 },
  introMotion: { zoomDuration: 1200, stagger: 180, startScale: .4, endScale: 1.1, textDelay: 1850, textDuration: 650 },
  narration: {
    enabled: true, asset: 'assets/tutorial-narration.m4a?v=voiceover-1310-sync-1', volume: 1
  },
  roleIntroMotion: {
    settleDuration: 180, drawStart: 1950, drawStep: 960, drawDuration: 640,
    flipOffset: 230, flipDuration: 330, lift: 60,
    stackGapX: 5, stackGapY: 3, stackAngle: 3,
    layout: { sceneWidth: 1720, inset: 20, gap: 24, cardHeight: 440,
      rowTop: 220, deckX: 860, deckY: 440 }
  },
  terawangPreparation: {
    // Preparation precedes the recorded Gambler explanation.
    duration: 6980, transitionDuration: 320,
    sitStart: 4400, sitStagger: 60, sitDuration: 600, seatDrop: 40, previewTime: 450,
    activeRoles: ['Gambler']
  },
  terawang: {
    targetPlayer: { faction: 2, label: 'Pemain 2' }, targetRole: 'Pretender',
    gamblerDuel: {
      bestOf: 3,
      // A predetermined 2–1 example, never a live random duel.
      rounds: [
        { gambler: 'rock', target: 'scissors' },
        { gambler: 'rock', target: 'paper' },
        { gambler: 'paper', target: 'rock' }
      ],
      roundStart: 15080 / 38580, roundStagger: 1850 / 38580, handDuration: 450 / 38580, resultOffset: 650 / 38580,
      cardRevealStart: 30380 / 38580, cardRevealDuration: 1100 / 38580,
      tieNoteStart: 21920 / 38580, lossStart: 34260 / 38580,
      scopeStart: 7420 / 38580, acceptanceStart: 11820 / 38580
    }
  },
  cardPickupMotion: {
    stackSize: 7, pickupsPerFaction: 2,
    settleStart: .02, settleStagger: .025, settleDuration: .055,
    pickupStart: .16, pickupStagger: .0635, pickupDuration: .06,
    approachEnd: .36, gripStart: .32, gripEnd: .52, fadeStart: .86,
    layout: { firstX: 115, gap: 350, cardY: 112, stackOffsetX: 3, stackOffsetY: 5, handReach: 330, carryDistance: 360 },
    cardAngles: [-3, 2, -2, 3]
  },
  roomDistribution: {
    faction: 'azure-dragon', memberCount: 10,
    revealStart: .005, revealStagger: .0025, revealDuration: .026,
    splitStart: .08, splitDuration: .10,
    roomRevealStart: .18, roomRevealDuration: .055,
    entryStart: .23, entryStagger: .02, entryDuration: .026,
    gamblerStart: 4300 / 12000,
    layout: {
      tokenSize: 84, initialCenterX: 860, initialY: 320, initialGap: 110, initialRowGap: 105,
      roomCenters: [420, 1300], roomTop: 175, roomWidth: 620, roomHeight: 340,
      queueY: 638, queueGap: 90, gateY: 512, insideFirstY: 330, insideRowGap: 95, insideGap: 130
    }
  },
  leaderSetup: {
    revealStart: .01, revealDuration: .055,
    // Decorative member indicators do not prescribe the game's player count.
    memberIndicatorsPerRoom: 3, memberRevealDuration: .045,
    selectionStart: 780 / 7040, selectionDuration: 750 / 7040,
    moveStart: 2760 / 7040, moveDuration: 1650 / 7040, roomRevealDuration: .07,
    warningStart: 5700 / 7040, warningStagger: 560 / 7040, warningDuration: 200 / 7040,
    layout: { teamX: 20, teamWidth: 390, teamGap: 40, teamTokenY: 220,
      pairOffset: 74, roomXs: [20, 900], roomWidth: 800,
      roomTokenXs: [110, 303, 497, 690], roomTokenY: 220, arcHeight: 32 }
  },
  leaderProtection: { blockedStart: 0, blockedDuration: .17, memberStart: .4, memberDuration: .15, movementRuleStart: 1920 / 4520 },
  ribbonDemo: { color: '#88bddd', revealStart: .02, revealStagger: .035, revealDuration: .055,
    headbandStart: 4900 / 9920, wristbandStart: 8400 / 9920, fitDuration: 650 / 9920 },
  factionSpots: {
    // Small member tokens illustrate movement, not a prescribed player count.
    membersPerFaction: 3, roomRevealStart: .01, roomRevealDuration: .07, roomStagger: .025,
    moveStart: .04, moveDuration: .30, confirmStart: .37, confirmDuration: .07,
    tapeStart: 5380 / 14440, tapeDuration: .07,
    colorNames: ['Biru','Merah','Putih','Hitam / hijau gelap'],
    layout: { roomXs: [30,910], roomWidth: 780, roomHeight: 520,
      zoneXs: [28,404], zoneYs: [85,307], zoneWidth: 348, zoneHeight: 191,
      tokenSize: 44, startSpacing: 52, startY: 291, targetGap: 16, targetY: 126 }
  },
  leaderSelection: {
    // Five members of each faction in each room; counts are illustrative.
    memberCounts: [5, 5, 5, 5],
    selectedMembers: [[1, 1, 1, 1], [1, 1, 1, 1]],
    gamblerMembers: [[4, 4, 4, 4], [4, 4, 4, 4]],
    roomRevealStart: .01, roomRevealStagger: .025, roomRevealDuration: .05,
    revealStart: .025, factionStagger: .013, tokenStagger: .01, revealDuration: .055,
    selectionStarts: [.24, .41], selectionStagger: .024, selectionDuration: .045,
    reminderStart: .56, reminderDuration: .055,
    layout: {
      roomWidth: 740, roomHeight: 620, roomGap: 100, roomsTop: 124,
      groupWidth: 300, groupXs: [38, 402], groupYs: [98, 350],
      // [column, row]: Azure / Vermilion / White Tiger / Black Tortoise.
      factionCorners: [[0, 0], [1, 1], [1, 0], [0, 1]],
      tokenSize: 64, tokenGap: 20, rowGap: 46,
      firstRowCount: 3, rowCapacity: 2, tokensTop: 72
    }
  },
  leaderRules: { arcHeight: 64 },
  exchangeTutorial: {
    questionEnd: 3800 / 39360, rollStart: 3800 / 39360, rollStop: 8000 / 39360, rollCycles: 12,
    roomsStart: 19650 / 39360, roomRevealDuration: 450 / 39360,
    targetMarkStart: 20000 / 39360, targetMarkDuration: 800 / 39360,
    selectionStart: 23200 / 39360, selectionDuration: 700 / 39360,
    protectionStart: 25850 / 39360, finalChoiceStart: 36400 / 39360, arcHeight: 90,
    sourceFaction: 0, movingMembers: [2, 0],
    layout: { slotTop: 188, slotWidth: 350, slotGap: 32, reelHeight: 300,
      roomsTop: 164, roomScale: .81 }
  },
  exchangeCompletion: { gmDuration: 7940, movementStart: 14540 / 24520, movementDuration: 3400 / 24520,
    verification: { checkStart: 2740 / 7940, checkDuration: 1350 / 7940, scoreStart: 5540 / 7940, scoreDuration: 1250 / 7940 } },
  gmSelection: {
    sourceFaction: 0, roomIndex: 0, selectedIndex: 2,
    deadlineStart: 100 / 12400, deadlineDuration: 3940 / 12400,
    rollStart: 7140 / 12400, rollStop: 11240 / 12400, rollCycles: 10
  },
  gamblerExchange: { factionIndex: 0, scoreDelta: 0, movementStart: 13520 / 23520, movementDuration: 2400 / 23520, continueStart: 18700 / 23520, arcHeight: 86 },
  gmCues: { actionTimes: [6500, 7050, 7600], soundStart: 8600 },
  cardSafety: { forbiddenStart: 3460, allowedStart: 7220 },
  roomCommunication: { carryStart: 4580 },
  gameFlow: {
    phases: ['Terawang', 'Diskusi', 'Exchange'],
    highlightTimes: [2460, 3320, 4380],
    repeatStart: 5340 / 9000, transitionDuration: .025, exchangeRange: '1–2 menit'
  },
  exchangeScoring: {
    roleOrder: ['VIP', 'Pretender', 'Warden', 'Civilian'],
    roleValues: { VIP: 3, Pretender: -3, Civilian: -1, Warden: 1 },
    revealStart: .025, revealStagger: .022, revealDuration: .055,
    highlightTimes: [5460, 10280, 15300, 20280],
    overviewDuration: 28540, gamblerNoteStart: 23740,
    example: {
      sourceFaction: 0, role: 'VIP', initialScore: 0,
      checkStart: 1000 / 12520, checkDuration: 1700 / 12520,
      scoreStart: 2960 / 12520, scoreDuration: 1600 / 12520,
      previewTime: 5000,
      layout: { roomXs: [50, 1100], roomWidth: 570, roomTop: 240, roomHeight: 458,
        playerXs: [190, 1240], playerY: 442,
        partnerXs: [1480, 205], partnerY: 600 }
    }
  },
  factions: [
    {id:'azure-dragon',name:'Azure Dragon',short:'AD',color:'#88bddd',symbol:'dragon',destination:0,
      cardPalette:{top:'#2165a3',base:'#10345e',edge:'#8bbbe8',ink:'#d6e4ef'}},
    {id:'vermilion-bird',name:'Vermilion Bird',short:'VB',color:'#d99186',symbol:'bird',destination:1,
      cardPalette:{top:'#a13d43',base:'#581d29',edge:'#d7998c',ink:'#f1d2b9'}},
    {id:'white-tiger',name:'White Tiger',short:'WT',color:'#dedbd3',symbol:'tiger',destination:1,
      cardPalette:{top:'#f5f4ed',base:'#d7dadb',edge:'#eae0c8',ink:'#5c6873'}},
    {id:'black-tortoise',name:'Black Tortoise',short:'BT',color:'#88bca5',symbol:'tortoise',destination:0,
      cardPalette:{top:'#193f32',base:'#071912',edge:'#658b76',ink:'#adbd9f'}}
  ],
  roles:['Gambler','Warden','Civilian','VIP','Pretender'],
  roleAssets:{VIP:'crown',Pretender:'pretender',Gambler:'gambler',Warden:'warden',Civilian:'civilian'},
  // Source faction index -> target faction index. Must be a derangement.
  exchangePairing:[2,3,0,1],
  rollExamples:[[1,0,3,2],[3,2,1,0],[2,3,0,1]],
  closingMotion: { fadeStart: .88, fadeDuration: .12 }
};
const SCENES = [
  {
    "id": "intro",
    "duration": 9240,
    "title": "Empat faksi, dua ruangan",
    "previewTime": 0,
    "voiceOverText": "Empat faksi. Dua ruangan. Satu tujuan: kumpulkan poin sebanyak-banyaknya. Selamat datang di station Pindahkan Aku Plsss!"
  },
  {
    "id": "leaders",
    "duration": 7040,
    "title": "Pilih dua Leader",
    "previewTime": 6700,
    "voiceOverText": "Setiap faksi memilih dua Leader. Satu berada di Room A dan satu lagi di Room B. Leader tidak mendapatkan kartu role."
  },
  {
    "id": "leader-protection",
    "duration": 4520,
    "title": "Leader dilindungi",
    "previewTime": 3200,
    "voiceOverText": "Tidak dapat diterawang dan tidak dapat dipindahkan selama permainan."
  },
  {
    "id": "ribbons",
    "duration": 9920,
    "title": "Pita kepala dan pergelangan tangan",
    "previewTime": 9400,
    "voiceOverText": "Leader dapat dibedakan dari pemain lainnya melalui posisi pita. Leader menggunakan pita di kepala sebagai headband, sedangkan pemain lainnya memakai pita di pergelangan tangan."
  },
  {
    "id": "roles",
    "duration": 7480,
    "title": "Kenali lima role",
    "previewTime": 200,
    "voiceOverText": "Ada lima role dalam permainan ini. VIP, Gambler, Warden, Civilian, dan Pretender."
  },
  {
    "id": "card-pickup",
    "duration": 7600,
    "title": "Pilih dan rahasiakan kartu",
    "previewTime": 5000,
    "voiceOverText": "Setiap pemain selain Leader memilih satu kartu role yang tersedia. Simpan kartu tersebut dan rahasiakan role kalian dari pemain lain."
  },
  {
    "id": "rooms",
    "duration": 12000,
    "title": "Bagi anggota dan Gambler secara rata",
    "previewTime": 9500,
    "voiceOverText": "Bagilah anggota faksi secara merata ke Room A dan Room B. Pastikan jumlah Gambler dari setiap faksi sama di kedua ruangan. Sehingga setiap Gambler memiliki pasangan dari faksi yang sama ketika pertukaran khusus dilakukan."
  },
  {
    "id": "faction-spots",
    "duration": 14440,
    "title": "Empat sudut dan batas tape",
    "previewTime": 10500,
    "voiceOverText": "Di setiap ruangan, empat faksi menempati sudut sesuai warna dan lokasi yang telah ditentukan. Tape di lantai menjadi batas area masing-masing faksi. Pemain harus tetap berada di areanya dan tidak boleh melewati tape kecuali mendapat aba-aba dari GM."
  },
  {
    "id": "gm-cues",
    "duration": 12900,
    "title": "Peluit, sound cue, dan timer GM",
    "previewTime": 11000,
    "voiceOverText": "Selama permainan, perhatikan aba-aba dari GM. Saat peluit dibunyikan, semua pemain harus berhenti, duduk, dan diam. Setelah itu, dengarkan sound cue dan perhatikan timer untuk mengetahui fase berikutnya."
  },
  {
    "id": "loop",
    "duration": 9000,
    "title": "Terawang, Diskusi, dan Exchange",
    "previewTime": 4200,
    "voiceOverText": "Permainan terdiri dari 3 fase utama, Terawang, Diskusi, dan Exchange. Urutan fase ini akan berulang hingga 3 kali Exchange."
  },
  {
    "id": "inspection",
    "duration": 45560,
    "title": "Terawang dan suit best of three",
    "previewTime": 13000,
    "voiceOverText": "Saat fase Terawang dimulai, hanya pemain dengan role Gambler yang boleh berdiri. Pemain lainnya harus tetap duduk dan tunduk. Setiap Gambler hanya boleh melakukan satu tantangan suit dalam satu fase Terawang. Baik tantangan tersebut berakhir menang maupun kalah. Gambler dapat menantang pemain selain Leader dari faksi lain yang berada di ruangan yang sama. Pemain yang ditantang wajib menerima tantangan tersebut. suit menggunakan sistem best of three. Pemain yang lebih dulu mendapatkan dua kemenangan akan memenangkan tantangan. Jika satu ronde berakhir seri, ronde tersebut tidak dihitung dan harus diulang. Jika Gambler menang, pemain yang ditantang wajib memperlihatkan kartu role aslinya secara privat kepada Gambler. Jika Gambler kalah, kartu role pemain tersebut tidak diperlihatkan."
  },
  {
    "id": "discussion",
    "duration": 17100,
    "title": "Bagikan informasi saat Diskusi",
    "previewTime": 8000,
    "voiceOverText": "Setelah fase Terawang selesai, permainan masuk ke fase Diskusi. Gunakan waktu ini untuk membagikan informasi yang kalian dapatkan kepada anggota faksi kalian. Informasi tersebut dapat digunakan untuk membantu Leader menentukan pemain yang sebaiknya dipilih saat Exchange."
  },
  {
    "id": "exchange",
    "duration": 39360,
    "title": "Target Exchange dan pilihan Leader",
    "previewTime": 37300,
    "voiceOverText": "Selanjutnya adalah fase Exchange. Pada setiap Exchange, target masing-masing faksi akan diacak dan ditampilkan di layar. Hasil target berlaku sama di Room A dan Room B. Dalam satu pengacakan, setiap faksi akan menjadi target tepat satu kali, dan tidak ada faksi yang dapat menargetkan dirinya sendiri. Di setiap ruangan, Leader memilih satu pemain dari faksi target yang berada di ruangannya sendiri. Leader dan Gambler tidak dapat dipilih pada Exchange biasa. Saat Leader menentukan pilihan, pemain lainnya harus tetap duduk. Setelah Leader memilih seorang pemain, keputusan tersebut bersifat final dan tidak dapat diganti."
  },
  {
    "id": "gm-selection",
    "duration": 12400,
    "title": "Jika Leader belum memilih",
    "previewTime": 11800,
    "voiceOverText": "Leader harus menentukan pilihan sebelum waktu yang diberikan GM habis. Jika Leader belum memilih saat waktu habis, GM akan memilih secara acak satu pemain yang memenuhi syarat dari faksi target di ruangan tersebut."
  },
  {
    "id": "exchange-completion",
    "duration": 24520,
    "title": "GM cek kartu, lalu pindah serentak",
    "previewTime": 17500,
    "voiceOverText": "Sebelum pemain terpilih berpindah ruangan, GM akan memeriksa kartu role asli pemain tersebut dan mencatat poin untuk faksi yang memilihnya. Setelah seluruh pilihan selesai di periksa, pemain terpilih akan berdiri dan berpindah secara bersamaan atas aba-aba GM. Pemain dari Room A berpindah ke Room B, sedangkan pemain dari Room B berpindah ke Room A. Walaupun berpindah ruangan, pemain tetap menjadi anggota faksi yang sama."
  },
  {
    "id": "gambler-exchange",
    "duration": 23520,
    "title": "Exchange kedua: Gambler satu faksi",
    "previewTime": 10000,
    "voiceOverText": "Husus pada Exchange kedua, terdapat pertukaran Gambler. Sebelum pemain Exchange lainnya berpindah, Gambler dari Room A akan bertukar dengan Gambler dari faksi yang sama di Room B. Semua pertukaran Gambler dilakukan secara bersamaan atas aba-aba GM. Pertukaran Gambler tidak menghasilkan ataupun mengurangi poin. Setelah pertukaran Gambler selesai, proses Exchange biasa dilanjutkan."
  },
  {
    "id": "final",
    "duration": 41060,
    "title": "Poin dan penentuan pemenang",
    "previewTime": 21400,
    "voiceOverText": "Point Exchange ditentukan berdasarkan role asli pemain yang dipilih. Jika pemain tersebut adalah VIP, faksi yang memilih mendapatkan 3 poin. Jika pemain tersebut adalah Pretender, faksi yang memilih kehilangan 3 poin. Jika pemain tersebut adalah Warden, faksi yang memilih mendapatkan 1 poin. Jika pemain tersebut adalah Civilian, faksi yang memilih kehilangan 1 poin. Gambler tidak memiliki nilai poin karena tidak dapat dipilih dalam Exchange biasa. Seluruh poin akan dicatat dan diperiksa oleh GM. Kalian tidak perlu menghitung skor sendiri. Point akan terus dikumpulkan selama permainan. Setelah seluruh Exchange selesai, faksi dengan total poin tertinggi menjadi pemenang."
  },
  {
    "id": "card-safety",
    "duration": 13080,
    "title": "Rahasiakan kartu role",
    "previewTime": 11000,
    "voiceOverText": "Selama permainan, kartu role harus tetap dirahasiakan. Jangan menunjukkan, menukar, atau memfoto kartu kalian. Kartu hanya boleh diperlihatkan kepada Gambler yang berhasil memenangkan Terawang dan kepada GM saat diperlukan."
  },
  {
    "id": "room-communication",
    "duration": 9600,
    "title": "Informasi antar ruangan",
    "previewTime": 6800,
    "voiceOverText": "Pemain di Room A dan Room B juga tidak diperbolehkan berkomunikasi antar ruangan. Informasi dari ruangan lain hanya dapat dibawa oleh pemain yang berpindah melalui Exchange."
  },
  {
    "id": "end",
    "duration": 9700,
    "title": "Siap bermain?",
    "previewTime": 7500,
    "voiceOverText": "Jadi, kenali role kalian, cari informasi sebanyak mungkin, bagikan informasi kepada faksi kalian, dan bantu Leader memilih pemain yang tepat. Siap bermain?"
  }
];

const TEXT = {
 cardDistribution:'Pemain selain Leader mendapatkan satu kartu',
 cardFacilitator:'yang dibagikan ke facilitator.',
 cardRoleChoice:'Pemain bisa memilih role-nya di tim masing-masing.',
 roomAllFactions:'Setiap faction membagi anggotanya ke kedua ruangan.',
 leaderSelection:'Pilih 1 Leader per faction, per ruangan',
 leaderNoCard:'Leader tidak mendapat kartu role',
 leaderNoInspection:'Leader tidak bisa diterawang',
 leaderExchangeLock:'Leader tidak boleh dipindahkan saat Exchange',
 leaderMovement:'Anggota berpindah atas arahan Leader',
 leaderOtherLock:'LEADER TIM LAIN TIDAK BISA DIPINDAHKAN',
 roleReadCards:'Baca deskripsi pada kartu kalian.',
 terawangPreparationTitle:'Pemain selain Gambler<br>harus tunduk',
 terawangActiveLabel:'GAMBLER',
 terawangOtherPlayersLabel:'PEMAIN LAIN',
 gamblerForcedReveal:'Gambler menang → lawan wajib membuka kartu.',
 gamblerPrivate:'Role asli diperlihatkan kepada Gambler pemenang.',
 exchangeQuestion:'Leader memilih pemain<br>dari faction mana?',
 exchangeRandomTitle:'Target faction diacak',
 exchangeRandomRule:'1 target per faction · tanpa target sendiri.',
 exchangeResultRule:'Contoh hasil · setiap faction ditargetkan tepat 1×.',
 exchangeSameRooms:'Target sama untuk Room A dan Room B.',
 exchangeChooseMember:'Leader memilih 1 pemain biasa di ruangannya.',
 exchangeMoveTogether:'Atas aba-aba GM, keduanya berpindah bersamaan.',
 exchangeAfterMove:'Leader tetap di tempat · faction pemain tetap.',
 exchangeQuickMove:'Pilih pemain biasa → pindah serentak.',
 exchangeReroll:'Target diacak kembali · target sebelumnya boleh terulang.',
 flowTitle:'Alur permainan',
 flowReturn:'Setelah Exchange, kembali ke Terawang.',
 flowRepeatTitle:'Ulangi sampai Exchange',
 flowTimer:'GM mengatur timer.',
 flowExchangeLabel:'Setiap Exchange',
 closingEyebrow:'KENALI PERANMU · CARI INFORMASI · TENTUKAN PERPINDAHAN',
 closingTitle:'Siap bermain?',
 closingSubtitle:'Empat tim. Dua ruangan. Satu kemenangan.',
 secret:'RAHASIAKAN ROLE KALIAN', leaderLock:'LEADER TIDAK DAPAT DIPINDAHKAN',
 target:'SETIAP FACTION MENDAPAT 1 TARGET', select:'PILIH 1 PEMAIN DARI FACTION TARGET',
 same:'TARGET SAMA DI KEDUA RUANGAN', repeat:'TARGET DIACAK KEMBALI', win:'POIN TERTINGGI MENANG'
};
const F=GAME_CONFIG.factions;
const total=SCENES.reduce((s,x)=>s+x.duration,0);
const starts=SCENES.map((_,i)=>SCENES.slice(0,i).reduce((s,x)=>s+x.duration,0));
function validPair(p){return p.length===F.length&&new Set(p).size===F.length&&p.every((t,i)=>Number.isInteger(t)&&t>=0&&t<F.length&&t!==i)}
if(![GAME_CONFIG.exchangePairing,...GAME_CONFIG.rollExamples].every(validPair))throw Error('Exchange pairing must target every faction once, with no self-target.');
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
const smoother=x=>{x=clamp(x);return x*x*x*(x*(6*x-15)+10)};
const $=s=>document.querySelector(s);
const icons={dragon:'M25 79Q8 55 30 41L49 44 42 30 64 15 87 25 73 36 85 45 67 51Q44 52 53 69T82 81L69 94 43 88M61 20 57 8M77 21 84 11M72 29h1M25 53 14 48M38 79 29 92',bird:'M55 88V46M55 61Q31 60 14 23L41 39 48 20 55 37 62 20 69 39 96 23Q79 61 55 61M55 70 33 94 55 84 77 94M51 43 55 37 59 43',tiger:'M26 35 18 16 39 23Q55 17 71 23L92 16 84 35 85 65 73 83 55 94 37 83 25 65ZM41 47l7 5M69 47l-7 5M48 67l7 7 7-7M55 74v10M45 24l10 12 10-12M27 40l10 5M83 40l-10 5M27 60l12 4M83 60l-12 4',tortoise:'M31 33Q55 13 79 33L88 59 74 82H36L22 59ZM43 40h24l10 19-12 14H45L33 59ZM55 22V40M22 59h11M77 59h11M45 73 36 82M65 73l9 9M46 21 48 10h14l2 11M28 34 17 28M82 34l11-6M33 79 22 92M77 79l11 13'};
// One preload per image. Playback never depends on a network service.
const loadedArtwork = new Set();
const artworkNames = [...F.map(f=>f.id), ...Object.values(GAME_CONFIG.roleAssets)];
artworkNames.forEach(name => {
 const img = new Image();
 img.onload = () => { loadedArtwork.add(name); if (!playing) draw(); };
 img.src = `assets/${name}.png`;
});
function art(name, className='', fallback='◇') {
 return loadedArtwork.has(name)
  ? `<img class="${className}" src="assets/${name}.png" alt="" draggable="false">`
  : `<span class="${className} art-fallback" aria-hidden="true">${fallback}</span>`;
}
function emblem(f){return `<div class="emblem">${loadedArtwork.has(f.id)?art(f.id):`<svg viewBox="0 0 110 110" aria-hidden="true"><path d="${icons[f.symbol]}"/></svg>`}</div>`}
function roleCard(role, detail='', active=false, style='') {
 return `<div class="role-card ${active?'active':''}" style="${style}"><div class="card-corner top-left"></div><div class="card-corner bottom-right"></div><div class="role-art">${art(GAME_CONFIG.roleAssets[role]||'civilian')}</div><h3>${role}</h3>${detail?`<small>${detail}</small>`:''}</div>`;
}
function faction(f){return `<div class="faction" style="--fc:${f.color}">${emblem(f)}<div class="faction-name">${f.name}</div></div>`}
function heading(k,title,sub=''){return `<div class="heading"><div class="eyebrow">${k}</div><h2>${title}</h2>${sub?`<p class="subtitle">${sub}</p>`:''}</div>`}
function token(f,leader=false,selected=false,style='',showInitials=true){
 return `<span class="token ${leader?'leader':''} ${selected?'selected':''}" style="--fc:${f.color};${style}" aria-label="${f.name}${leader?' Leader':''}">${art(f.id,'token-art',f.short)}${showInitials?`<span class="token-initials">${f.short}</span>`:''}${leader?art('crown','leader-crown','L'):''}</span>`;
}
function rooms({leaders=false,initial=false,split=1,selection=false,move=0}={}){
 const target=GAME_CONFIG.exchangePairing[0];
 const boards=GAME_CONFIG.rooms.map((room,r)=>`<section class="room"><h3>${room}</h3>${F.map((f,i)=>{
  const present=!initial||(r===0?i<2:i>=2);
  return `<div class="room-row" style="--fc:${f.color};opacity:${present?1:split};transform:translateX(${present?0:(r===0?850:-850)*(1-split)}px)"><span class="room-label">${f.name}</span>${[0,1,2].map(n=>{
   const selected=selection&&i===target&&n===2;
   return token(f,leaders&&n===0,false,`${selected?'visibility:hidden;':''}${selection&&i===0&&n===0?'box-shadow:0 0 32px #88bddd80;':''}`);
  }).join('')}</div>`;
 }).join('')}</section>`).join('');
 // Movers live above BOTH boards: their images never disappear behind the destination.
 const travelers=selection?[0,1].map(r=>{
  const dx=(r===0?850:-850)*move;
  const dy=(r===0?-62:62)*Math.sin(Math.PI*move);
  return `<div class="exchange-traveler" style="left:${455+r*850}px;top:${101+79*target}px;transform:translate(${dx}px,${dy}px)">${token(F[target],false,true)}<span class="origin-label">DARI ${GAME_CONFIG.rooms[r].toUpperCase()}</span></div>`;
 }).join(''):'';
 const trails=selection&&move>0?`<svg class="exchange-trails" viewBox="0 0 1540 455" aria-hidden="true">${[0,1].map(r=>{
  const points=Array.from({length:41},(_,i)=>{const t=i/40;return `${486+r*850+(r===0?850:-850)*t},${132+79*target+(r===0?-62:62)*Math.sin(Math.PI*t)}`}).join(' ');
  return `<polyline points="${points}" pathLength="1" style="stroke-dashoffset:${1-move};opacity:${.65*(1-ease((move-.88)/.12))}"/>`;
 }).join('')}</svg>`:'';
 return `<div class="rooms">${boards}${trails}<div class="room-bridge">${selection?'<span>→</span><span>←</span>':'／'}</div>${travelers}</div>`;
}
function steps(p){return `<div class="steps">${Array.from({length:GAME_CONFIG.totalExchanges},(_,i)=>`<div class="step ${i<=p?'lit':''}">${i+1}</div>${i<GAME_CONFIG.totalExchanges-1?'<span class="arrow" style="align-self:center">→</span>':''}`).join('')}</div>`}
// All five roles share one overview before the preparation cue.
const ROLE_OVERVIEW = [
 {name:'VIP'}, {name:'Gambler'}, {name:'Warden'}, {name:'Civilian'}, {name:'Pretender'}
];
function cardBack(style='') {
 return `<div class="role-card secret-card" style="${style}"><div class="card-back-art"><svg class="covered-card-seal" viewBox="0 0 130 170" aria-hidden="true"><path d="m65 12 48 73-48 73L17 85ZM65 39 96 85l-31 46-31-46ZM65 52v66M43 85h44"/></svg></div><h3>ROLE RAHASIA</h3><small>Identitas masih tersembunyi</small></div>`;
}
function scoreText(value) {
 return (value>=0?'+':'−')+Math.abs(value);
}
function exchangeScoreState(p) {
 const motion=GAME_CONFIG.exchangeScoring;
 const time=p*motion.overviewDuration;
 const active=motion.highlightTimes.reduce((last,start,index)=>time>=start?index:last,-1);
 const rows=motion.roleOrder.map((role,index)=>({
  role,points:motion.roleValues[role],active:index===active,
  reveal:smoother((p-motion.revealStart-index*motion.revealStagger)/motion.revealDuration)
 }));
 return {rows,winner:false,active};
}
function exchangePointsScene(p) {
 const state=exchangeScoreState(p);
 const focused=state.rows[Math.max(0,state.active)];
 const caption=state.active<0?'Poin berdasarkan role asli pemain yang dipindahkan.':`${focused.role} dipindahkan → ${scoreText(focused.points)} poin.`;
 return `<div class="exchange-scoring-scene">
  ${heading('POIN EXCHANGE','Poin setiap perpindahan','Nilai sesuai role asli pemain yang dipindahkan.')}
  <div class="exchange-scoring-grid">${state.rows.map(row=>`<article class="exchange-score-card${row.active?' is-highlighted':''}" data-role="${row.role}" data-score="${row.points}" style="opacity:${row.reveal};transform:translateY(${18*(1-row.reveal)}px);--score-color:${row.points>0?'#a9c8b7':'#d6a09c'}">
   ${roleCard(row.role)}
   <strong class="exchange-score-value">${scoreText(row.points)}</strong><span class="exchange-score-unit">POIN PER PEMAIN</span>
  </article>`).join('')}</div>
  <p class="exchange-score-caption${state.winner?' is-winner':''}">${caption}</p>
  <p class="exchange-score-note">${p*GAME_CONFIG.exchangeScoring.overviewDuration>=GAME_CONFIG.exchangeScoring.gamblerNoteStart?'Gambler tidak dipilih pada Exchange biasa · tanpa poin.':'Poin dijumlahkan selama permainan.'}</p>
 </div>`;
}
function exchangeScoreExampleState(p,verification=false) {
 const motion=GAME_CONFIG.exchangeScoring.example;
 const timing=verification?GAME_CONFIG.exchangeCompletion.verification:motion;
 const source=motion.sourceFaction,target=GAME_CONFIG.exchangePairing[source];
 const points=GAME_CONFIG.exchangeScoring.roleValues[motion.role];
 const check=smoother((p-timing.checkStart)/timing.checkDuration);
 const score=check===1?smoother((p-timing.scoreStart)/timing.scoreDuration):0;
 // This chapter demonstrates GM scoring only; the transfer is shown once in the Exchange chapter.
 const move=0,cardOpacity=1;
 const step=score===1?'recorded':score>0?'scoring':check===1?'checked':check>0?'checking':'selected';
 return {source,target,role:motion.role,points,check,score,move,step,cardOpacity,
  initialScore:motion.initialScore,total:Math.round(motion.initialScore+points*score)};
}
function exchangeScoreExampleScene(p,showPoints=true) {
 const state=exchangeScoreExampleState(p,!showPoints),layout=GAME_CONFIG.exchangeScoring.example.layout;
 const source=F[state.source],target=F[state.target];
 const x=layout.playerXs[0],y=layout.playerY;
 const partnerX=layout.partnerXs[0],partnerY=layout.partnerY;
 const captions={
  selected:'Pemain terpilih masih berada di dalam ruangan.',
  checking:'GM memeriksa kartu role sebelum pemain keluar.',
  checked:showPoints?`Role asli: ${state.role} → ${scoreText(state.points)} poin.`:'GM sudah memeriksa kartu role asli.',
  scoring:showPoints?`GM menambahkan ${scoreText(state.points)} poin ke ${source.name}.`:`GM mencatat poin untuk faksi pemilih: ${source.name}.`,
  recorded:showPoints?(p>=.9?`${source.name} mendapat ${scoreText(state.points)} poin dari satu ${state.role}.`:'Skor sudah diperbarui. Pemain menunggu aba-aba GM.'):'Pilihan sudah diperiksa. Pemain menunggu aba-aba GM.'
 };
 return `<div class="gm-exchange-scene" data-gm-step="${state.step}" data-role-checked="${state.check===1}" data-score-updated="${state.score===1}" data-move-progress="${state.move}" style="--source-color:${source.color};--target-color:${target.color}">
  ${heading(showPoints?'CONTOH POIN UNTUK 1 PEMAIN':'SEBELUM PERPINDAHAN','GM cek role dan memperbarui skor','Sebelum pemain keluar ruangan.')}
  <div class="gm-example-target">${art(source.id,'gm-example-faction-art',source.short)}<span>${source.name} memilih</span><b>→</b>${art(target.id,'gm-example-faction-art',target.short)}<span>${target.name}</span></div>
  ${GAME_CONFIG.rooms.map((room,index)=>`<section class="gm-example-room" style="left:${layout.roomXs[index]}px;top:${layout.roomTop}px;width:${layout.roomWidth}px;height:${layout.roomHeight}px"><h3>${room}</h3>${index===0?`<div class="gm-example-official${state.check===1?' is-checked':''}"><span>GM</span><small>${state.score===1?'Poin tercatat':state.check===1?'VIP terverifikasi':'Cek role'}</small></div>`:'<p class="gm-example-other-room">Pemain pasangan juga dicek<br>oleh GM Room B.</p>'}</section>`).join('')}
  <div class="gm-example-role" style="opacity:${state.cardOpacity}"><span>ROLE ASLI · DICEK GM</span><div class="role-intro-flip ${state.check>=.5?'is-face-up':'is-face-down'}" style="transform:rotateY(${state.check*180}deg)">${roleIntroBack()}<div class="role-intro-front">${roleCard(state.role,showPoints?`${scoreText(state.points)} poin`:'Diperiksa GM')}</div></div></div>
  <aside class="gm-example-score${showPoints?'':' gm-example-record'}" data-score-recipient="${source.id}" data-recorded="${state.score===1}" ${showPoints?`data-initial-score="${state.initialScore}" data-score="${state.total}" data-delta="${state.points}"`:''}><span>SKOR FACTION PEMILIH</span><div class="gm-example-score-owner">${art(source.id,'gm-example-faction-art',source.short)}<h3>${source.name}</h3></div><div class="gm-example-score-numbers"><strong>${showPoints?state.total:state.score===1?'TERCATAT':state.score>0?'CATAT POIN':'CEK ROLE'}</strong>${showPoints?`<b style="opacity:${state.check===1?1:0};transform:translateY(${12*(1-state.score)}px)">${scoreText(state.points)}</b>`:''}</div><p>${state.score===1?'Diperbarui oleh GM':state.score>0?'GM mencatat poin…':showPoints?'Contoh skor awal: '+state.initialScore:'Poin untuk faksi yang memilih'}</p></aside>
  <div class="gm-example-player" data-faction="${target.id}" data-room="Room A" style="left:${x}px;top:${y}px">${token(target,false,false,'',false)}<p>${state.check===1?state.role:'Pemain terpilih'}</p></div>
  <div class="gm-example-partner" data-faction="${target.id}" data-room="Room B" style="left:${partnerX}px;top:${partnerY}px">${token(target,false,false,'',false)}<p>Pemain pasangan</p></div>
  <p class="gm-example-caption">${captions[state.step]}</p><p class="gm-example-note">${showPoints&&p>=.90?TEXT.win:'GM cek role → update skor faction pemilih → pemain keluar.'}</p>
 </div>`;
}
function finalPhaseScene(p) {
 const duration=SCENES.find(scene=>scene.id==='final').duration;
 const time=p*duration,overview=GAME_CONFIG.exchangeScoring.overviewDuration;
 return time<overview?exchangePointsScene(time/overview):exchangeScoreExampleScene(clamp((time-overview)/(duration-overview)));
}
const SUIT = {
 rock: { label: 'BATU', beats: 'scissors', path: 'M22 67V39q0-12 12-12h8l7-7h18l13 13v32L65 82H38ZM35 30v23m14-29v27m16-25v27M25 62h49' },
 scissors: { label: 'GUNTING', beats: 'paper', path: 'M34 78 23 62q-7-10 2-16l13 9-12-32q-4-11 5-14 8-3 12 8l11 28 5-31q2-11 11-9 9 2 7 12l-5 36q14 3 10 17L65 86H45Z' },
 paper: { label: 'KERTAS', beats: 'rock', path: 'M32 82 16 52q-4-9 3-13 7-4 12 5l5 9V21q0-10 8-10t8 10v28-35q0-10 8-10t8 10v35-26q0-10 8-10t8 10v43q0 16-13 24H45ZM52 24v31m16-27v27M36 49v15' }
};
function suitIcon(kind){return `<svg class="suit-icon" viewBox="0 0 100 100" aria-hidden="true"><path d="${SUIT[kind].path}"/></svg>`;}
// The opening keeps only the four logos and the requested objective line.
function openingIntro(p) {
 const time=p*SCENES.find(scene=>scene.id==='intro').duration;
 const motion=GAME_CONFIG.introMotion;
 const titleEntry=ease((time-motion.textDelay)/motion.textDuration);
 return `<div class="opening-intro">
  <div class="opening-act opening-factions"><div class="opening-crest-grid">${F.map((f,i)=>{
   const progress=clamp((time-i*motion.stagger)/motion.zoomDuration);
   const zoom=ease(progress);
   const scale=motion.startScale+(motion.endScale-motion.startScale)*zoom;
   const reveal=ease(progress/.35);
   return `<div class="opening-crest" aria-label="${f.name}" style="--fc:${f.color};opacity:${reveal};transform:scale(${scale})"><div class="crest-ornament" aria-hidden="true"><span></span><i></i><b></b></div>${emblem(f)}</div>`;
  }).join('')}</div><h1 class="opening-title" style="opacity:${titleEntry};transform:translateY(${(1-titleEntry)*18}px)"><span>4 FACTIONS</span><i aria-hidden="true">·</i><span>2 ROOMS</span><i aria-hidden="true">·</i><span>1 OBJECTIVES</span></h1></div>
 </div>`;
}
// Card backs keep role identities hidden during pickup.
function tableCardBack(faction=null,showLabel=true) {
 const palette=faction?.cardPalette;
 const colors=palette?`--card-top:${palette.top};--card-base:${palette.base};--card-edge:${palette.edge};--card-ink:${palette.ink};`:'';
 const artwork=faction?`<div class="table-card-faction">${loadedArtwork.has(faction.id)?art(faction.id):`<svg viewBox="0 0 110 110" aria-hidden="true"><path d="${icons[faction.symbol]}"/></svg>`}</div>`:'';
 return `<div class="table-card-back ${faction?'faction-card-back':''}" style="${colors}"><div class="table-card-inlay"></div><svg class="table-card-seal" viewBox="0 0 120 160" aria-hidden="true"><path d="M60 10 108 58v44l-48 48-48-48V58ZM60 30l30 30v40l-30 30-30-30V60Z"/><circle cx="60" cy="80" r="17"/><path d="M60 48v15m0 34v15M28 80h15m34 0h15M49 69l22 22m0-22L49 91"/></svg>${artwork}${showLabel?'<span>ROLE</span>':''}<svg class="table-card-corner" viewBox="0 0 240 330" aria-hidden="true"><path d="M24 63V24h39M177 24h39v39M216 267v39h-39M63 306H24v-39"/></svg></div>`;
}
// Illustrated hands curl their fingers before carrying the card off the table.
function pickupHand(index,grip) {
 const id=`pickup-skin-${index}`;
 const indexTip=51+43*grip,middleTip=27+57*grip,ringTip=49+43*grip,littleTip=83+26*grip;
 return `<svg class="pickup-hand-art" viewBox="0 0 240 380" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d5bea0"/><stop offset=".65" stop-color="#a48d76"/><stop offset="1" stop-color="#77685d"/></linearGradient></defs><path class="pickup-sleeve" d="M72 232 164 232 194 380H43Z"/><path class="pickup-hand-outline" fill="url(#${id})" d="M76 247 69 191Q50 172 44 141L39 104Q36 91 48 86 60 83 65 96L81 126 80 ${indexTip+19}Q80 ${indexTip} 94 ${indexTip} 107 ${indexTip} 108 ${indexTip+19}L109 121 111 ${middleTip+17}Q111 ${middleTip} 124 ${middleTip} 139 ${middleTip+1} 138 ${middleTip+17}L137 120 143 ${ringTip+12}Q144 ${ringTip-2} 157 ${ringTip} 170 ${ringTip+2} 167 ${ringTip+17}L158 134 172 ${littleTip+8}Q177 ${littleTip-5} 189 ${littleTip} 199 ${littleTip+5} 194 ${littleTip+17}L179 151Q173 167 162 182L158 246Z"/><g class="pickup-hand-lines"><path d="M81 126q9 10 13 28m15-33v31m28-32-4 33m25-19-9 28M73 186q36-21 71 4M92 203q20 7 45 2M82 232h66"/><path d="M88 ${indexTip+16}q8-4 13 0M118 ${middleTip+15}q9-4 13 0M149 ${ringTip+14}q6-3 11 1M178 ${littleTip+11}l8 3"/></g><path class="pickup-cuff" d="M71 228h94l4 30H67Z"/><path class="pickup-cuff-line" d="M75 241h84"/></svg>`;
}
function cardPickupState(p,index) {
 const motion=GAME_CONFIG.cardPickupMotion,layout=motion.layout;
 // Finish the left and right draws of one faction before moving to the next pile.
 const factionIndex=Math.floor(index/motion.pickupsPerFaction),drawIndex=index%motion.pickupsPerFaction;
 const settled=ease((p-motion.settleStart-factionIndex*motion.settleStagger)/motion.settleDuration);
 const progress=clamp((p-motion.pickupStart-index*motion.pickupStagger)/motion.pickupDuration);
 const approach=ease(progress/motion.approachEnd);
 const grip=ease((progress-motion.gripStart)/(motion.gripEnd-motion.gripStart));
 const carry=ease((progress-motion.gripEnd)/(1-motion.gripEnd));
 const fade=1-ease((progress-motion.fadeStart)/(1-motion.fadeStart));
 const direction=drawIndex%2===0?-1:1;
 const slotX=layout.firstX+factionIndex*layout.gap+drawIndex*layout.stackOffsetX;
 const slotY=layout.cardY+drawIndex*layout.stackOffsetY;
 const lift=12*Math.sin(Math.PI*carry);
 const x=slotX+direction*70*carry;
 const y=slotY-45*(1-settled)+layout.carryDistance*carry-lift;
 const angle=motion.cardAngles[factionIndex]+direction*8*carry;
 const status=progress===1?'taken':progress>=motion.gripEnd?'carrying':progress>motion.gripStart?'gripping':progress>0?'reaching':settled===1?'waiting':'settling';
 return {factionIndex,drawIndex,direction,settled,progress,approach,grip,carry,fade,x,y,angle,status,
  handX:slotX+direction*90*(1-approach)+direction*70*carry,
  handY:slotY+225+layout.handReach*(1-approach)+layout.carryDistance*carry-lift,
  received:ease((progress-.9)/.1)};
}
function takeCards(p) {
 const motion=GAME_CONFIG.cardPickupMotion,layout=motion.layout;
 const states=Array.from({length:F.length*motion.pickupsPerFaction},(_,i)=>cardPickupState(p,i));
 const piles=F.map((f,factionIndex)=>{
  const settled=states[factionIndex*motion.pickupsPerFaction].settled;
  const x=layout.firstX+factionIndex*layout.gap;
  // The top cards are the traveling nodes below, so the pile never duplicates a draw.
  const cards=Array.from({length:motion.stackSize-motion.pickupsPerFaction},(_,layer)=>{
   const depth=motion.stackSize-1-layer;
   return `<div class="pickup-stack-card" data-layer="${layer}" style="transform:translate(${depth*layout.stackOffsetX}px,${depth*layout.stackOffsetY}px) rotate(${motion.cardAngles[factionIndex]}deg)">${tableCardBack(f)}</div>`;
  }).join('');
  return `<div class="pickup-pile-label" style="--fc:${f.color};left:${x-30}px;opacity:${settled}">${f.name}</div><div class="pickup-pile" data-faction="${f.id}" aria-label="Tumpukan kartu ${f.name}" style="left:${x}px;top:${layout.cardY}px;opacity:${settled};transform:translateY(${-45*(1-settled)}px)">${cards}</div>`;
 }).join('');
 const players=states.map((s,i)=>{
  const f=F[s.factionIndex],visible=ease(s.settled/.2)*s.fade;
  const recipientX=layout.firstX+s.factionIndex*layout.gap+30+s.drawIndex*110;
  return `<div class="pickup-card" data-player="${i+1}" data-state="${s.status}" data-faction="${f.id}" data-draw="${s.drawIndex+1}" data-layer="${motion.stackSize-1-s.drawIndex}" aria-label="Kartu tertutup untuk pemain ${i+1}, ${f.name}" style="z-index:${12+motion.pickupsPerFaction-s.drawIndex};opacity:${visible};transform:translate(${s.x}px,${s.y}px) rotate(${s.angle}deg) scale(${1+.025*Math.sin(Math.PI*s.carry)})">${tableCardBack(f)}</div><div class="pickup-hand" data-player="${i+1}" data-state="${s.status}" style="--fc:${f.color};opacity:${ease(s.progress/.09)*s.fade};transform:translate(${s.handX}px,${s.handY}px) rotate(${s.direction*(9*(1-s.approach)+8*s.carry)}deg)"><div style="transform:scaleX(${s.direction<0?1:-1})">${pickupHand(i,s.grip)}</div></div><div class="pickup-recipient" data-player="${i+1}" data-faction="${f.id}" aria-label="${f.name}, pemain ${s.drawIndex+1}" style="--fc:${f.color};left:${recipientX}px;opacity:${.5+.5*s.received};--received:${s.received}">${token(f,false,false,'',false)}<svg class="pickup-receipt" viewBox="0 0 36 36" aria-hidden="true" style="opacity:${s.received};transform:scale(${.7+.3*s.received})"><circle cx="18" cy="18" r="16"/><path d="m10 18 5 5 11-11"/></svg></div>`;
 }).join('');
 return `<div class="card-table-scene"><div class="pickup-heading"><h2>1 pemain · 1 kartu</h2><p>Rahasiakan role-mu.</p></div><div class="pickup-table"><div class="pickup-table-surface" aria-hidden="true"><div class="table-center-ornament"></div></div>${piles}${players}</div><p class="pickup-description">${TEXT.cardRoleChoice}</p></div>`;
}
function quadraticPoint(start,control,end,t) {
 const u=1-t;
 return {x:u*u*start.x+2*u*t*control.x+t*t*end.x,y:u*u*start.y+2*u*t*control.y+t*t*end.y};
}
// One stable token per player follows the whole gather -> split -> enter sequence.
function roomMemberState(p,index) {
 const motion=GAME_CONFIG.roomDistribution,layout=motion.layout;
 const perRoom=motion.memberCount/GAME_CONFIG.rooms.length;
 const roomIndex=Math.floor(index/perRoom),place=index%perRoom;
 const initial={x:layout.initialCenterX+(place-(perRoom-1)/2)*layout.initialGap,y:layout.initialY+roomIndex*layout.initialRowGap};
 const queue={x:layout.roomCenters[roomIndex]+(place-(perRoom-1)/2)*layout.queueGap,y:layout.queueY};
 const columns=Math.ceil(perRoom/2),row=Math.floor(place/columns);
 const rowCount=Math.min(columns,perRoom-row*columns);
 const destination={x:layout.roomCenters[roomIndex]+(place%columns-(rowCount-1)/2)*layout.insideGap,y:layout.insideFirstY+row*layout.insideRowGap};
 const gate={x:layout.roomCenters[roomIndex],y:layout.gateY};
 const split=ease((p-motion.splitStart)/motion.splitDuration);
 const entryIndex=place*GAME_CONFIG.rooms.length+roomIndex;
 const travel=clamp((p-motion.entryStart-entryIndex*motion.entryStagger)/motion.entryDuration);
 const progress=ease(travel);
 let point={x:initial.x+(queue.x-initial.x)*split,y:initial.y+(queue.y-initial.y)*split};
 if(travel>0)point=progress<.5
  ?quadraticPoint(queue,{x:gate.x,y:queue.y},gate,progress*2)
  :quadraticPoint(gate,{x:gate.x,y:gate.y-100},destination,(progress-.5)*2);
 const phase=travel===1?'inside':travel>0?'entering':split===1?'queued':split>0?'splitting':'gathered';
 return {index,roomIndex,place,entryIndex,split,travel,phase,...point,queue,gate,destination,
  visible:ease((p-motion.revealStart-index*motion.revealStagger)/motion.revealDuration)};
}
function roomOverview(p) {
 const motion=GAME_CONFIG.roomDistribution,layout=motion.layout;
 const f=F.find(faction=>faction.id===motion.faction);
 const states=Array.from({length:motion.memberCount},(_,i)=>roomMemberState(p,i));
 const perRoom=motion.memberCount/GAME_CONFIG.rooms.length;
 const roomReveal=ease((p-motion.roomRevealStart)/motion.roomRevealDuration);
 const groupLabel=ease((p-.25)/.045)*(1-ease((p-motion.entryStart)/.035));
 const active=states.find(member=>member.phase==='entering');
 const boards=GAME_CONFIG.rooms.map((room,r)=>{
  const arrived=states.filter(member=>member.roomIndex===r&&member.phase==='inside').length;
  return `<section class="distribution-room-board" data-room="${room}" data-arrived="${arrived}" style="left:${layout.roomCenters[r]-layout.roomWidth/2}px;top:${layout.roomTop}px;width:${layout.roomWidth}px;height:${layout.roomHeight}px;opacity:${roomReveal};transform:translateY(${(1-roomReveal)*18}px)"><div class="distribution-room-header"><h3>${room}</h3><span class="distribution-room-count"><strong>${arrived}</strong> pemain</span></div><div class="distribution-room-floor" aria-hidden="true"></div><div class="distribution-room-door ${active?.roomIndex===r?'entry-active':''}" aria-hidden="true"></div></section><p class="room-queue-label" style="left:${layout.roomCenters[r]-220}px;top:${layout.queueY-93}px;opacity:${groupLabel}">${perRoom} pemain → ${room}</p>`;
 }).join('');
 const route=`<svg class="room-entry-route" viewBox="0 0 1720 825" aria-hidden="true">${active?`<path d="M${active.queue.x} ${active.queue.y} Q${active.gate.x} ${active.queue.y} ${active.gate.x} ${active.gate.y} Q${active.gate.x} ${active.gate.y-100} ${active.destination.x} ${active.destination.y}" pathLength="1" style="stroke-dashoffset:${1-ease(active.travel)}"/>`:''}</svg>`;
 const gambler=ease((p-motion.gamblerStart)/.04);
 const members=states.map(member=>`<div class="distribution-member ${member.phase==='entering'?'in-transit':''}" data-player="${member.index+1}" data-destination="${GAME_CONFIG.rooms[member.roomIndex]}" data-phase="${member.phase}" ${member.place===0?'data-role="Gambler"':''} aria-label="${f.name}, pemain ${member.index+1}" style="width:${layout.tokenSize}px;height:${layout.tokenSize}px;opacity:${member.visible};transform:translate(${member.x-layout.tokenSize/2}px,${member.y-layout.tokenSize/2}px)">${token(f,false,false,'',false)}${member.place===0?`<span class="distribution-gambler" style="opacity:${gambler}">${art('gambler','distribution-gambler-art','G')}GAMBLER</span>`:''}</div>`).join('');
 return `<div class="room-distribution-scene" style="--fc:${f.color};--member-size:${layout.tokenSize}px"><div class="room-distribution-heading"><div class="eyebrow">CONTOH · ${f.name.toUpperCase()}</div><h2>${motion.memberCount} anggota <span>→</span> ${perRoom} + ${perRoom}</h2></div>${boards}${route}${members}<p class="room-distribution-note">${gambler>0?'Jumlah Gambler tiap faksi sama di Room A dan Room B.':TEXT.roomAllFactions}</p></div>`;
}
function factionSpotMemberState(p,roomIndex,factionIndex,memberIndex) {
 const motion=GAME_CONFIG.factionSpots,layout=motion.layout;
 const [column,row]=GAME_CONFIG.leaderSelection.layout.factionCorners[factionIndex];
 const index=factionIndex*motion.membersPerFaction+memberIndex;
 const count=F.length*motion.membersPerFaction;
 const fromX=layout.roomWidth/2+(index-(count-1)/2)*layout.startSpacing;
 const toX=layout.zoneXs[column]+layout.zoneWidth/2+(memberIndex-(motion.membersPerFaction-1)/2)*(layout.tokenSize+layout.targetGap);
 const toY=layout.zoneYs[row]+layout.targetY;
 const move=smoother((p-motion.moveStart)/motion.moveDuration);
 const arc=row===1?(column===0?-24:24):0;
 return {column,row,move,
  x:fromX+(toX-fromX)*move,
  y:layout.startY+(toY-layout.startY)*move+arc*Math.sin(Math.PI*move),
  state:move===1?'placed':move>0?'moving':'waiting'};
}
function factionSpotsScene(p) {
 const motion=GAME_CONFIG.factionSpots,layout=motion.layout;
 const confirm=ease((p-motion.confirmStart)/motion.confirmDuration);
 // Introduce the boundary after setup, so the demonstration never crosses a visible tape line.
 const tape=smoother((p-motion.tapeStart)/motion.tapeDuration);
 const dividerX=(layout.zoneXs[0]+layout.zoneWidth+layout.zoneXs[1])/2;
 const dividerY=(layout.zoneYs[0]+layout.zoneHeight+layout.zoneYs[1])/2;
 const tapePath=`M${dividerX} ${layout.zoneYs[0]}V${layout.zoneYs[1]+layout.zoneHeight}M${layout.zoneXs[0]} ${dividerY}H${layout.zoneXs[1]+layout.zoneWidth}`;
 const boards=GAME_CONFIG.rooms.map((room,roomIndex)=>{
  const reveal=ease((p-motion.roomRevealStart-roomIndex*motion.roomStagger)/motion.roomRevealDuration);
  const zones=F.map((f,factionIndex)=>{
   const [column,row]=GAME_CONFIG.leaderSelection.layout.factionCorners[factionIndex];
   return `<section class="faction-spot" data-faction="${f.id}" data-corner="${column}-${row}" style="--fc:${f.color};--spot-color:${f.cardPalette.top};--spot-base:${f.cardPalette.base};--spot-edge:${f.cardPalette.edge};left:${layout.zoneXs[column]}px;top:${layout.zoneYs[row]}px;width:${layout.zoneWidth}px;height:${layout.zoneHeight}px"><div class="faction-spot-heading">${art(f.id,'faction-spot-logo',f.short)}<div><h4>${f.name}</h4><p>${motion.colorNames[factionIndex]}</p></div></div><span class="faction-spot-check" style="opacity:${confirm}" aria-hidden="true">✓</span></section>`;
  }).join('');
  const members=F.flatMap((f,factionIndex)=>Array.from({length:motion.membersPerFaction},(_,memberIndex)=>{
   const person=factionSpotMemberState(p,roomIndex,factionIndex,memberIndex);
   return `<div class="faction-spot-member" data-member-id="${room}:${f.id}:${memberIndex+1}" data-faction="${f.id}" data-corner="${person.column}-${person.row}" data-state="${person.state}" style="--fc:${f.color};transform:translate(${person.x-layout.tokenSize/2}px,${person.y-layout.tokenSize/2}px)" aria-hidden="true">${token(f,false,false,'',false)}</div>`;
  })).join('');
  const boundary=`<svg class="faction-floor-tape" viewBox="0 0 ${layout.roomWidth} ${layout.roomHeight}" role="img" aria-label="Garis tape di lantai memisahkan empat area faction" style="opacity:${tape}"><path class="floor-tape-shadow" d="${tapePath}"/><path class="floor-tape-strip" d="${tapePath}"/><path class="floor-tape-edge" d="${tapePath}"/></svg>`;
  return `<section class="faction-spots-room" data-room="${room}" style="left:${layout.roomXs[roomIndex]}px;width:${layout.roomWidth}px;height:${layout.roomHeight}px;opacity:${reveal}"><div class="faction-spots-room-heading"><h3>${room}</h3><p>4 SUDUT FACTION</p></div>${zones}${boundary}${members}</section>`;
 }).join('');
 const rule=p>=motion.tapeStart;
 return `<div class="faction-spots-scene"><div class="faction-spots-heading"><p class="eyebrow">POSISI DALAM KELAS</p><h2>4 sudut · 4 faction</h2><p>${rule?'Tape di lantai memisahkan keempat area faction.':'Menuju sudut sesuai warna dan logo faction-mu.'}</p></div><div class="faction-spots-board">${boards}</div><p class="faction-spots-note${rule?' is-boundary-rule':''}">${rule?'Jangan melewati garis tape tanpa aba-aba GM.':'Ikuti warna dan logo faction di sudut ruangan.'}${rule?'<span>Tetap di area faction-mu.</span>':''}</p></div>`;
}
function leaderMemberState(p,roomIndex,factionIndex,index) {
 const motion=GAME_CONFIG.leaderSelection,layout=motion.layout;
 const count=motion.memberCounts[factionIndex];
 const afterFront=index-layout.firstRowCount;
 const row=afterFront<0?0:1+Math.floor(afterFront/layout.rowCapacity);
 const place=afterFront<0?index:afterFront%layout.rowCapacity;
 const rowCount=Math.min(row===0?layout.firstRowCount:layout.rowCapacity,
  row===0?count:count-layout.firstRowCount-(row-1)*layout.rowCapacity);
 const rowWidth=rowCount*layout.tokenSize+(rowCount-1)*layout.tokenGap;
 return {
  x:(layout.groupWidth-rowWidth)/2+place*(layout.tokenSize+layout.tokenGap),
  y:row*(layout.tokenSize+layout.rowGap),
  visible:ease((p-motion.revealStart-roomIndex*motion.roomRevealStagger-factionIndex*motion.factionStagger-index*motion.tokenStagger)/motion.revealDuration),
  chosen:index===motion.selectedMembers[roomIndex][factionIndex]
   ?ease((p-motion.selectionStarts[roomIndex]-factionIndex*motion.selectionStagger)/motion.selectionDuration):0
 };
}
function leaderRoomStyle() {
 const layout=GAME_CONFIG.leaderSelection.layout;
 return `--leader-room-width:${layout.roomWidth}px;--leader-room-height:${layout.roomHeight}px;--leader-room-gap:${layout.roomGap}px;--leader-rooms-top:${layout.roomsTop}px;--leader-group-width:${layout.groupWidth}px;--leader-member-size:${layout.tokenSize}px;--leader-tokens-top:${layout.tokensTop}px`;
}
function leaderPosition(roomIndex,factionIndex,memberIndex) {
 const layout=GAME_CONFIG.leaderSelection.layout;
 const [column,row]=layout.factionCorners[factionIndex];
 const state=leaderMemberState(1,roomIndex,factionIndex,memberIndex);
 const firstRoomX=(1720-GAME_CONFIG.rooms.length*layout.roomWidth-(GAME_CONFIG.rooms.length-1)*layout.roomGap)/2;
 return {
  x:firstRoomX+roomIndex*(layout.roomWidth+layout.roomGap)+layout.groupXs[column]+state.x,
  y:layout.groupYs[row]+layout.tokensTop+state.y
 };
}
function leaderLockIcon() {
 return '<svg viewBox="0 0 32 36" aria-hidden="true"><path d="M8 15V10a8 8 0 0 1 16 0v5M5 15h22v18H5ZM16 22v5"/></svg>';
}
function leaderSetupState(p,factionIndex,roomIndex) {
 const motion=GAME_CONFIG.leaderSetup,layout=motion.layout;
 const chosen=ease((p-motion.selectionStart)/motion.selectionDuration);
 const move=smoother((p-motion.moveStart)/motion.moveDuration);
 const fromX=layout.teamX+factionIndex*(layout.teamWidth+layout.teamGap)+layout.teamWidth/2+(roomIndex===0?-layout.pairOffset:layout.pairOffset);
 const toX=layout.roomXs[roomIndex]+layout.roomTokenXs[factionIndex];
 const toY=layout.roomTokenY;
 return {chosen,move,
  x:fromX+(toX-fromX)*move,
  y:layout.teamTokenY+(toY-layout.teamTokenY)*move+(roomIndex===0?-1:1)*layout.arcHeight*Math.sin(Math.PI*move),
  state:move===1?'assigned':move>0?'moving':chosen===1?'selected':'choosing'};
}
function leaderSetupMembers(f,count) {
 return `<div class="leader-setup-members" aria-hidden="true">${Array.from({length:count},()=>token(f,false,false,'',false)).join('')}</div>`;
}
function leaderSetupScene(p) {
 const motion=GAME_CONFIG.leaderSetup,layout=motion.layout;
 const reveal=ease((p-motion.revealStart)/motion.revealDuration);
 const roomReveal=ease((p-motion.moveStart)/motion.roomRevealDuration);
 const state=leaderSetupState(p,0,0),count=state.move===1?F.length:0;
 const memberReveal=ease((p-motion.moveStart-motion.moveDuration)/motion.memberRevealDuration);
 const teams=F.map((f,index)=>`<section class="leader-setup-team" data-faction="${f.id}" style="--fc:${f.color};left:${layout.teamX+index*(layout.teamWidth+layout.teamGap)}px;width:${layout.teamWidth}px;opacity:${reveal*(1-roomReveal)}"><h3>${f.name}</h3><p>2 Leader per faction</p>${leaderSetupMembers(f,motion.memberIndicatorsPerRoom*GAME_CONFIG.rooms.length)}</section>`).join('');
 const boards=GAME_CONFIG.rooms.map((room,index)=>`<section class="leader-setup-room" data-room="${room}" data-leaders="${count}" style="left:${layout.roomXs[index]}px;width:${layout.roomWidth}px;opacity:${roomReveal}"><h3>${room}</h3><p><strong>${count} / ${F.length}</strong> Leader</p><span>1 Leader dari setiap faction</span>${F.map((f,factionIndex)=>`<div class="leader-setup-room-members" data-faction="${f.id}" style="left:${layout.roomTokenXs[factionIndex]-80}px;opacity:${memberReveal}">${leaderSetupMembers(f,motion.memberIndicatorsPerRoom)}</div>`).join('')}</section>`).join('');
 const people=F.flatMap((f,factionIndex)=>GAME_CONFIG.rooms.map((room,roomIndex)=>{
  const person=leaderSetupState(p,factionIndex,roomIndex);
  const name=person.move===1?f.name:`Leader ${roomIndex+1}`;
  return `<div class="leader-setup-person" data-leader-id="${f.id}:${roomIndex+1}" data-faction="${f.id}" data-destination="${room}" data-state="${person.state}" data-selected="${person.chosen===1}" aria-label="${f.name}, Leader ${roomIndex+1}, ${room}" style="--fc:${f.color};--leader-reveal:${person.chosen};opacity:${reveal};transform:translate(${person.x-80}px,${person.y-64}px)">${token(f,person.chosen>0,false,'',false)}<span class="leader-setup-person-label">${name}</span><small>${person.move===1?'LEADER':room}</small></div>`;
 })).join('');
 const cardIcon='<svg viewBox="0 0 36 36" aria-hidden="true"><rect x="7" y="3" width="22" height="30" rx="3"/><path d="M11 10h14M11 26h14M3 3l30 30"/></svg>';
 const warnings=[{text:TEXT.leaderNoCard,icon:cardIcon},{text:TEXT.leaderExchangeLock,icon:leaderLockIcon()}].map((warning,index)=>{
  const shown=ease((p-motion.warningStart-index*motion.warningStagger)/motion.warningDuration);
  return `<div class="leader-setup-warning" data-warning="${index+1}" style="opacity:${shown};transform:translateY(${12*(1-shown)}px)">${warning.icon}<div><small>PERINGATAN ${index+1}</small><p>${warning.text}</p></div></div>`;
 }).join('');
 return `<div class="leader-setup-scene"><div class="leader-setup-heading"><p class="eyebrow">PERSIAPAN TIM</p><h2>Pilih 2 Leader di setiap faction</h2><p class="subtitle">${state.move>0?'Satu ke Room A · satu ke Room B':'Empat faction · dua Leader per faction'}</p></div><div class="leader-setup-board">${teams}${boards}${people}</div><div class="leader-setup-summary" style="opacity:${ease((p-motion.moveStart-motion.moveDuration)/.04)}">4 Leader per ruangan <span>·</span> 8 Leader total</div><div class="leader-setup-warnings">${warnings}</div></div>`;
}
function leaderProtectionScene(p) {
 const motion=GAME_CONFIG.leaderProtection;
 const blocked=ease((p-motion.blockedStart)/motion.blockedDuration);
 const eligible=ease((p-motion.memberStart)/motion.memberDuration);
 const cross='<svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="24"/><path d="m19 19 18 18m0-18L19 37"/></svg>';
 const check='<svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="24"/><path d="m16 28 8 8 17-18"/></svg>';
 return `<div class="leader-protection-scene">${heading('ATURAN LEADER',TEXT.leaderNoInspection)}<div class="leader-protection-board"><section class="leader-protection-option is-protected" style="--status-reveal:${blocked}"><p class="eyebrow">LEADER</p><div class="leader-protection-status" style="opacity:${blocked};transform:scale(${.85+.15*blocked})">${cross}</div><div class="leader-protection-art">${token(F[0],true,false,'',false)}</div><p class="leader-protection-caption">Bukan target Terawang</p></section><section class="leader-protection-option is-eligible" style="--status-reveal:${eligible}"><p class="eyebrow">ROLE LAIN</p><div class="leader-protection-status" style="opacity:${eligible};transform:scale(${.85+.15*eligible})">${check}</div><div class="leader-protection-art leader-protection-members">${F.map(f=>token(f,false,false,'',false)).join('')}</div><p class="leader-protection-caption">Role lain bisa diterawang</p></section></div><p class="leader-protection-note">${p>=GAME_CONFIG.leaderProtection.movementRuleStart?TEXT.leaderExchangeLock:"Berlaku saat fase Terawang."}</p></div>`;
}
function ribbonHeadFigure(fit) {
 return `<svg class="ribbon-figure" viewBox="0 0 440 420" role="img" aria-label="Leader memakai pita di kepala sebagai headband"><defs><linearGradient id="ribbon-head-skin" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#dec6a8"/><stop offset="1" stop-color="#bea286"/></linearGradient></defs><path class="ribbon-uniform" d="M60 415v-45q0-66 88-86l29-14h86l29 14q88 20 88 86v45"/><path class="ribbon-uniform-detail" d="m177 272 43 39 43-39M220 311v104M143 290l-13 115m167-115 13 115"/><rect x="191" y="244" width="58" height="59" rx="18" fill="url(#ribbon-head-skin)"/><ellipse cx="140" cy="172" rx="13" ry="23" fill="url(#ribbon-head-skin)"/><ellipse cx="300" cy="172" rx="13" ry="23" fill="url(#ribbon-head-skin)"/><ellipse cx="220" cy="165" rx="80" ry="100" fill="url(#ribbon-head-skin)"/><path class="ribbon-hair" d="M140 163v-47q0-83 80-83t80 83v47q-18-37-43-62-39 31-103 15-5 24-14 47Z"/><path class="ribbon-hair-detail" d="M162 99q47-54 101-26m-100 48q53 7 92-25"/><path class="ribbon-face-detail" d="M172 165q14-7 29-1m38 0q16-6 29 1M179 181h11m60 0h11M220 178v31l-8 4m-11 21q19 12 38 0"/><g class="ribbon-on-head" data-placement="headband" data-fitted="${fit===1}" opacity="${fit}" transform="translate(0 ${-56*(1-fit)})"><path class="ribbon-cloth" d="M138 121q82-18 164 0v23q-82-17-164 0Z"/><path class="ribbon-stitch" d="M145 128q75-14 150 0m-150 9q75-14 150 0"/><path class="ribbon-cloth ribbon-tail" d="m298 134 35 13-10 25-9-5-16-28m4-6 19 44-13 9-12-45"/><circle class="ribbon-knot" cx="302" cy="133" r="8"/></g></svg>`;
}
function ribbonWristFigure(fit) {
 return `<svg class="ribbon-figure" viewBox="0 0 440 420" role="img" aria-label="Anggota biasa memakai pita di pergelangan tangan"><defs><linearGradient id="ribbon-hand-skin" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#dec6a8"/><stop offset="1" stop-color="#bea286"/></linearGradient></defs><path class="ribbon-hand" fill="url(#ribbon-hand-skin)" d="M171 415V313q-25-27-31-64l-36-35q-17-18-4-32t30 4l23 17V85q0-18 16-18t16 18v82V59q0-19 17-19t17 19v108V76q0-18 16-18t16 18v91v-61q0-17 15-17t15 17v104q0 67-33 99v106Z"/><path class="ribbon-hand-detail" d="M153 203q28 20 25 54m10-10q29-14 59-7M185 167v33m34-33v32m32-32v33M178 298q34 10 61 0"/><g class="ribbon-on-wrist" data-placement="wristband" data-fitted="${fit===1}" opacity="${fit}" transform="translate(${52*(1-fit)} 0)"><path class="ribbon-cloth" d="M162 317q46 10 94 0v30q-48 10-94 0Z"/><path class="ribbon-stitch" d="M169 325q39 8 80 0m-80 15q39 8 80 0"/><path class="ribbon-cloth ribbon-tail" d="m254 331 34 10-10 23-9-3-16-25m3-3 18 42-14 7-9-44"/><circle class="ribbon-knot" cx="257" cy="333" r="9"/></g></svg>`;
}
function ribbonScene(p) {
 const motion=GAME_CONFIG.ribbonDemo;
 const head=ease((p-motion.headbandStart)/motion.fitDuration);
 const wrist=ease((p-motion.wristbandStart)/motion.fitDuration);
 const panels=[{kind:'leader',title:'LEADER',label:'Pita di kepala',detail:'Dipakai seperti headband',fit:head,art:ribbonHeadFigure(head)},{kind:'member',title:'ANGGOTA BIASA',label:'Pita di pergelangan tangan',detail:'Diikat pada pergelangan tangan',fit:wrist,art:ribbonWristFigure(wrist)}].map((panel,index)=>{
  const reveal=ease((p-motion.revealStart-index*motion.revealStagger)/motion.revealDuration);
  return `<section class="ribbon-demo-panel" data-kind="${panel.kind}" style="opacity:${reveal};transform:translateY(${12*(1-reveal)}px)"><p class="eyebrow">${panel.title}</p><div class="ribbon-demo-art">${panel.art}</div><h3>${panel.label}</h3><p class="ribbon-demo-detail">${panel.detail}</p><span class="ribbon-fit-mark" style="opacity:${panel.fit}">✓</span></section>`;
 }).join('');
 return `<div class="ribbon-demo-scene" style="--ribbon-color:${motion.color}">${heading('PENANDA PEMAIN','Kenali pemain dari letak pita')}<div class="ribbon-demo-board">${panels}</div></div>`;
}
function leaderRooms(p,example=null) {
 const motion=GAME_CONFIG.leaderSelection,layout=motion.layout;
 const roomPopulation=motion.memberCounts.reduce((sum,count)=>sum+count,0);
 const selectionEnd=roomIndex=>motion.selectionStarts[roomIndex]+(F.length-1)*motion.selectionStagger+motion.selectionDuration;
 const activeRoom=motion.selectionStarts.findIndex((start,roomIndex)=>p>=start&&p<selectionEnd(roomIndex));
 const crownFallback='<svg viewBox="0 0 60 42" aria-hidden="true"><path d="m6 9 13 10L30 4l11 15 13-10-5 26H11ZM11 35h38"/></svg>';
 const boards=GAME_CONFIG.rooms.map((room,roomIndex)=>{
  const roomExample=example?.cases.find(item=>item.focusRoom===roomIndex);
  const reveal=ease((p-motion.roomRevealStart-roomIndex*motion.roomRevealStagger)/motion.roomRevealDuration);
  const leaderCount=F.filter((_,factionIndex)=>leaderMemberState(p,roomIndex,factionIndex,motion.selectedMembers[roomIndex][factionIndex]).chosen===1).length;
  const groups=F.map((f,factionIndex)=>{
   const [column,row]=layout.factionCorners[factionIndex];
   const members=Array.from({length:motion.memberCounts[factionIndex]},(_,index)=>{
    const state=leaderMemberState(p,roomIndex,factionIndex,index),candidate=index===motion.selectedMembers[roomIndex][factionIndex];
    const isGambler=index===motion.gamblerMembers[roomIndex][factionIndex];
    const moving=roomExample&&factionIndex===roomExample.target&&index===example.members[roomIndex];
    const choosing=Boolean(roomExample&&candidate&&factionIndex===roomExample.source&&example.selection>0);
    const eligible=example?.mode==='exchange'&&roomExample&&factionIndex===roomExample.target&&!candidate&&!isGambler;
    return `<div class="leader-member${state.chosen>0?' is-leader':''}${eligible?' exchange-candidate':''}" data-room="${room}" data-faction="${f.id}" data-player="${index+1}" data-choosing="${choosing}" data-role="${candidate?'Leader':isGambler?'Gambler':'ordinary'}" aria-label="${room}, ${f.name}, pemain ${index+1}${state.chosen>0?', Leader':''}" style="--chosen:${state.chosen};${example&&example.mode!=='exchange'?`--choosing:${choosing?example.selection:0};`:''}${eligible?`--candidate:${example.targetReveal*(1-example.selection)};`:''}opacity:${moving?0:state.visible};transform:translate(${state.x}px,${state.y}px) scale(${1+.12*state.chosen})">${token(f,false,false,'',false)}${candidate?`<span class="leader-member-crown" aria-hidden="true">${art('crown','leader-choice-crown-art',crownFallback)}</span><span class="leader-member-badge" aria-hidden="true">LEADER</span>${example?`<span class="leader-fixed-lock" style="opacity:${example.lock}">${leaderLockIcon()}</span>`:''}`:''}${isGambler&&example?`<span class="exchange-gambler-badge" style="opacity:${example.protection}">G</span>`:''}</div>`;
   }).join('');
   return `<section class="leader-corner-group" data-faction="${f.id}" data-corner="${column}-${row}" style="--fc:${f.color};left:${layout.groupXs[column]}px;top:${layout.groupYs[row]}px"><h4>${f.name} <span>· ${motion.memberCounts[factionIndex]}</span></h4><div class="leader-member-field">${members}</div></section>`;
  }).join('');
  const selecting=example?Boolean(roomExample):roomIndex===activeRoom;
  const caseLabel=roomExample?`<p class="leader-room-case">Contoh ${roomExample.number} · ${F[roomExample.source].name} → ${F[roomExample.target].name}</p>`:'';
  return `<section class="leader-room${selecting?' is-selecting':''}" data-room="${room}" data-population="${roomPopulation}" data-leaders="${leaderCount}" style="opacity:${reveal};transform:translateY(${12*(1-reveal)}px)"><div class="leader-room-heading"><h3>${room}</h3><p><strong>${leaderCount} / ${F.length} Leader</strong></p></div>${caseLabel}<div class="leader-room-floor" aria-hidden="true"></div>${groups}</section>`;
 }).join('');
 const paths=example?`<svg class="leader-choice-paths" viewBox="0 0 1720 ${layout.roomHeight}" aria-hidden="true"><defs><marker id="leader-choice-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1 7 4 1 7"/></marker></defs>${GAME_CONFIG.rooms.map((_,roomIndex)=>{
  const roomExample=example.cases.find(item=>item.focusRoom===roomIndex);
  const source=leaderPosition(roomIndex,roomExample.source,motion.selectedMembers[roomIndex][roomExample.source]);
  const target=leaderPosition(roomIndex,roomExample.target,example.members[roomIndex]);
  const half=layout.tokenSize/2,cue=example.selection*(1-ease(example.move/.15));
  return `<path class="leader-choice-line" data-room="${GAME_CONFIG.rooms[roomIndex]}" data-source-faction="${F[roomExample.source].id}" d="M${source.x+half} ${source.y+half} Q${(source.x+target.x)/2+half} ${source.y+half} ${target.x+half} ${target.y+half}" pathLength="1" marker-end="url(#leader-choice-arrow)" style="opacity:${cue};stroke-dashoffset:${1-example.selection}"/>`;
 }).join('')}${example.mode==='exchange'?GAME_CONFIG.rooms.map((room,roomIndex)=>{
  const current=example.cases.find(item=>item.focusRoom===roomIndex),other=example.cases.find(item=>item.focusRoom===1-roomIndex);
  const from=leaderPosition(roomIndex,current.target,example.members[roomIndex]),to=leaderPosition(1-roomIndex,other.target,example.members[1-roomIndex]);
  const half=layout.tokenSize/2;
  const points=Array.from({length:41},(_,step)=>{const t=step/40;return `${from.x+half+(to.x-from.x)*t},${from.y+half+(to.y-from.y)*t+(roomIndex===0?-1:1)*example.arcHeight*Math.sin(Math.PI*t)}`}).join(' ');
  return `<polyline class="exchange-motion-trace" data-origin="${room}" points="${points}" pathLength="1" style="stroke-dashoffset:${1-example.move};opacity:${example.selection*(1-ease((example.move-.9)/.1))}"/>`;
 }).join(''):''}</svg>`:'';
 const travelers=example?GAME_CONFIG.rooms.map((room,roomIndex)=>{
  const roomExample=example.cases.find(item=>item.focusRoom===roomIndex);
  const otherExample=example.cases.find(item=>item.focusRoom===1-roomIndex);
  const from=leaderPosition(roomIndex,roomExample.target,example.members[roomIndex]);
  const to=leaderPosition(1-roomIndex,otherExample.target,example.members[1-roomIndex]);
  const x=from.x+(to.x-from.x)*example.move;
  const y=from.y+(to.y-from.y)*example.move+(roomIndex===0?-1:1)*(example.arcHeight??GAME_CONFIG.leaderRules.arcHeight)*Math.sin(Math.PI*example.move);
  return `<div class="leader-rule-traveler${example.mode==='exchange'?' exchange-picked-player':''}" data-origin="${room}" data-destination="${GAME_CONFIG.rooms[1-roomIndex]}" data-faction="${F[roomExample.target].id}" data-player="${example.members[roomIndex]+1}" style="--selected:${example.mode==='exchange'?Math.max(example.selection,example.targetReveal):example.selection};transform:translate(${x}px,${y}px)">${token(F[roomExample.target],false,false,'',false)}<span class="leader-traveler-origin" style="opacity:${Math.sin(Math.PI*example.move)}">${room} → ${GAME_CONFIG.rooms[1-roomIndex]}</span></div>`;
 }).join('')+`<div class="leader-transfer-arrows" aria-hidden="true" style="opacity:${example.selection}"><span>→</span><span>←</span></div>`:'';
 return `<div class="leader-rooms-grid">${boards}${paths}${travelers}</div>`;
}
function exchangeSeatedReminder(reveal=1) {
 return `<div class="exchange-rules-seated" style="opacity:${reveal}"><div class="exchange-seated-players" aria-hidden="true">${F.map(f=>`<span class="exchange-seated-person" style="--fc:${f.color}"><span class="preparation-person-figure">${preparationPerson(f.id,1,f.short)}</span></span>`).join('')}</div><div class="exchange-seated-copy"><p>Pemain lain tetap duduk selama Exchange.</p><span>Supaya suasana tetap tertib dan kondusif.</span></div></div>`;
}
function eligibleOrdinaryMembers(roomIndex,factionIndex) {
 const motion=GAME_CONFIG.leaderSelection;
 const protectedPlayers=[motion.selectedMembers[roomIndex][factionIndex],motion.gamblerMembers[roomIndex][factionIndex]];
 return Array.from({length:motion.memberCounts[factionIndex]},(_,index)=>index).filter(index=>!protectedPlayers.includes(index));
}
function gmSelectionState(p) {
 const motion=GAME_CONFIG.gmSelection,source=motion.sourceFaction,target=GAME_CONFIG.exchangePairing[source];
 const players=eligibleOrdinaryMembers(motion.roomIndex,target);
 const deadline=smoother((p-motion.deadlineStart)/motion.deadlineDuration);
 const roll=smoother((p-motion.rollStart)/(motion.rollStop-motion.rollStart));
 const selected=p<motion.rollStart?-1:p>=motion.rollStop?motion.selectedIndex%players.length:Math.floor(roll*motion.rollCycles)%players.length;
 return {source,target,players,deadline,selected,locked:p>=motion.rollStop};
}
function gmSelectionScene(p) {
 const state=gmSelectionState(p),source=F[state.source],target=F[state.target];
 const caption=state.locked?`GM memilih Pemain ${state.players[state.selected]+1} dari ${target.name}.`:state.deadline===1?'Waktu memilih habis → GM memilih pemain secara acak.':'Leader belum menentukan pemain.';
 return `<div class="gm-selection-scene" data-selection-state="${state.locked?'chosen':state.deadline===1?'randomizing':'waiting'}">
  ${heading('EXCHANGE · PILIHAN GM','Leader belum memilih?','Jika waktu memilih habis, GM memilih pemain secara acak.')}
  <div class="exchange-example-pair gm-selection-target">${art(source.id,'exchange-pair-art',source.short)}<span>Leader ${source.name}</span><b>→</b>${art(target.id,'exchange-pair-art',target.short)}<span>${target.name}</span></div>
  <div class="gm-selection-deadline"><span>${state.deadline===1?'GM mengambil alih pilihan':'Waktu memilih'}</span><div><i style="transform:scaleX(${1-state.deadline})"></i></div></div>
  <div class="gm-selection-candidates">${state.players.map((player,index)=>`<article class="gm-selection-candidate${index===state.selected?' is-selected':''}" data-player="${player+1}" data-faction="${target.id}" data-is-leader="false" data-is-gambler="false" style="--fc:${target.color}">${token(target,false,false,'',false)}<h3>Pemain ${player+1}</h3><p>${state.locked&&index===state.selected?'PILIHAN GM':'Pemain yang memenuhi syarat'}</p></article>`).join('')}</div>
  <p class="gm-selection-caption">${caption}</p><p class="gm-selection-note">Faksi target · ruangan yang sama · Leader dan Gambler tidak dipilih.</p>
 </div>`;
}
function gamblerExchangeState(p) {
 const motion=GAME_CONFIG.gamblerExchange,move=smoother((p-motion.movementStart)/motion.movementDuration);
 return GAME_CONFIG.rooms.map((room,index)=>({room,destination:GAME_CONFIG.rooms[1-index],faction:motion.factionIndex,scoreDelta:motion.scoreDelta,move,
  x:(index===0?420:1300)+(index===0?880:-880)*move,
  y:410+(index===0?-1:1)*motion.arcHeight*Math.sin(Math.PI*move)}));
}
function gamblerExchangeScene(p) {
 const people=gamblerExchangeState(p),move=people[0].move;
 const caption=move===1?(p>=GAME_CONFIG.gamblerExchange.continueStart?'3. Setelah Gambler selesai, lanjutkan Exchange pemain lainnya.':'Pertukaran selesai · tanpa poin.') :move>0?'2. Room A ↔ Room B: kedua Gambler berpindah serentak.':'1. Gambler bersiap dan menunggu aba-aba GM.';
 const faction=F[people[0].faction],moving=move>0&&move<1;
 const figure={id:'gambler',name:`Gambler ${faction.name}`,short:'G',color:faction.color};
 return `<div class="gambler-exchange-scene" data-exchange-number="2" data-example="one-pair" data-score-delta="0" style="--gambler-faction-color:${faction.color}">
  ${heading('FASE KHUSUS GAMBLER','Exchange ke-2: Gambler bertukar',`Pasangan dari faksi yang sama · contoh ${faction.name}.`)}
  ${GAME_CONFIG.rooms.map((room,index)=>`<section class="gambler-exchange-room" style="left:${index===0?90:970}px"><h3>${room}</h3></section>`).join('')}
  <div class="gambler-exchange-arrows" aria-hidden="true" style="opacity:${move>0&&move<1?0:1}"><span>→</span><span>←</span></div>
  ${people.map((person,index)=>`<div class="gambler-exchange-player" data-role="Gambler" data-faction="${F[person.faction].id}" data-origin="${person.room}" data-destination="${person.destination}" data-move-progress="${person.move}" style="left:${person.x}px;top:${person.y}px">${token(figure,false,false,'',false)}<p>Gambler ${index+1}<small class="gambler-exchange-faction" style="display:${moving?'none':'block'}">${faction.name}</small><small style="display:${moving?'none':'block'}">${person.room} → ${person.destination}</small></p></div>`).join('')}
  <p class="gambler-exchange-caption">${caption}</p><p class="gambler-exchange-note">Tanpa poin · faksi tetap sama · sebelum perpindahan pemain lainnya.</p>
 </div>`;
}
function roleIntroState(p) {
 const motion=GAME_CONFIG.roleIntroMotion,layout=motion.layout,count=ROLE_OVERVIEW.length;
 const time=p*SCENES.find(scene=>scene.id==='roles').duration;
 const width=(layout.sceneWidth-2*layout.inset-layout.gap*(count-1))/count;
 const settled=smoother(time/motion.settleDuration);
 return {
  width,height:layout.cardHeight,settled,
  cards:ROLE_OVERVIEW.map((role,index)=>{
   const stack=index-(count-1)/2,targetX=layout.inset+width/2+index*(width+layout.gap),targetY=layout.rowTop+layout.cardHeight/2;
   const start=motion.drawStart+index*motion.drawStep;
   const draw=smoother((time-start)/motion.drawDuration),flip=smoother((time-start-motion.flipOffset)/motion.flipDuration);
   const arc=draw>0&&draw<1?Math.sin(Math.PI*draw):0,direction=Math.sign(targetX-layout.deckX);
   return {role:role.name,draw,flip,
    x:(layout.deckX+stack*motion.stackGapX-targetX)*(1-draw),
    y:(layout.deckY+stack*motion.stackGapY-targetY)*(1-draw)-motion.lift*arc,
    rotation:stack*motion.stackAngle*(1-draw)+direction*5*arc,
    scale:1+.015*arc,zIndex:draw>0&&draw<1?20+index:count-index,
    targetX,targetY
   };
  })
 };
}
function roleIntroBack() {
 return `<div class="role-intro-back" aria-hidden="true"><span class="role-deck-corner corner-top"></span><span class="role-deck-corner corner-bottom"></span><svg class="role-deck-seal" viewBox="0 0 130 170"><path d="m65 12 48 73-48 73L17 85ZM65 39 96 85l-31 46-31-46ZM65 52v66M43 85h44"/></svg></div>`;
}
function rolesOverviewScene(p) {
 const state=roleIntroState(p);
 const cards=state.cards.map(card=>`<article class="role-overview-entry" data-role="${card.role}" data-origin="deck" data-draw="${card.draw}" data-flip="${card.flip}" style="z-index:${card.zIndex};opacity:${state.settled};transform:translate3d(${card.x}px,${card.y}px,0) rotate(${card.rotation}deg) scale(${card.scale})"><div class="role-intro-flip ${card.flip>=.5?'is-face-up':'is-face-down'}" style="transform:rotateY(${180*card.flip}deg)">${roleIntroBack()}<div class="role-intro-front" aria-hidden="${card.flip<.5}">${roleCard(card.role)}</div></div></article>`).join('');
 return `<div class="roles-overview-scene">${heading('ROLE PEMAIN','Ada 5 role dalam permainan')}<div class="role-intro-deck-shadow" style="opacity:${state.settled*(1-state.cards.at(-1).draw)}"></div><div class="roles-overview-grid">${cards}</div><p class="roles-overview-note">Penjelasan role menyusul.</p></div>`;
}
function inspectionScene(p) {
 const duration=SCENES.find(scene=>scene.id==='inspection').duration,time=p*duration,preparation=GAME_CONFIG.terawangPreparation;
 if(time<preparation.duration)return terawangPreparationScene(time);
 const local=clamp((time-preparation.duration)/(duration-preparation.duration));
 return local>=GAME_CONFIG.terawang.gamblerDuel.lossStart?terawangLossScene():terawangScene(local);
}
function preparationPerson(artName,sit=0,fallback='') {
 const drop=GAME_CONFIG.terawangPreparation.seatDrop*sit;
 const hipY=148+drop,kneeY=181+7*sit;
 const kneeXs=[54-14*sit,86+14*sit],footXs=[51-11*sit,89+11*sit];
 const legs=kneeXs.map((x,i)=>`M${i===0?53:87} ${hipY}L${x} ${kneeY}L${footXs[i]} 216`).join('');
 const chair=ease((sit-.04)/.3);
 return `<svg viewBox="0 0 140 230" aria-hidden="true"><ellipse class="preparation-person-ground" cx="70" cy="223" rx="45" ry="4"/><g class="preparation-person-chair" style="opacity:${chair}"><rect x="23" y="109" width="94" height="78" rx="10"/><path d="M23 188h94M28 188v31m84-31v31"/></g><path class="preparation-person-leg-outline" d="${legs}"/><path class="preparation-person-leg-fill" d="${legs}"/><path class="preparation-person-feet" d="M${footXs[0]-9} 218h20M${footXs[1]-11} 218h20"/><g class="preparation-person-upper" transform="translate(0 ${drop})"><path class="preparation-person-body" d="M44 143v-40q0-25 26-25t26 25v40q-26 11-52 0ZM61 66v14m18-14v14M48 85q-18 8-17 29l4 30M92 85q18 8 17 29l-4 30"/><g class="preparation-person-head"><circle cx="70" cy="43" r="23"/><path class="preparation-person-face" d="M61 42h2m14 0h2M70 48v8m-6 6q6 4 12 0"/></g></g></svg><span class="preparation-person-emblem" style="transform:translateY(${drop}px)">${art(artName,'preparation-person-emblem-art',fallback)}</span>`;
}
function terawangPreparationScene(time) {
 const motion=GAME_CONFIG.terawangPreparation;
 const reveal=ease(time/motion.transitionDuration);
 const active=motion.activeRoles.map(role=>`<div class="terawang-preparation-active-player" data-role="${role}"><div class="preparation-person-figure" style="--fc:var(--gold)" data-posture="standing" aria-label="${role} tetap berdiri">${preparationPerson(GAME_CONFIG.roleAssets[role],0,role.slice(0,1))}</div><h3>${role}</h3></div>`).join('');
 const players=F.map((f,i)=>{
  const sit=ease((time-motion.sitStart-i*motion.sitStagger)/motion.sitDuration);
  const posture=sit===0?'standing':sit===1?'seated':'sitting-down';
  return `<div class="terawang-preparation-player preparation-person-figure" data-faction="${f.id}" data-seat="${sit}" data-posture="${posture}" style="--fc:${f.color}" aria-label="Pemain ${f.name} berdiri lalu duduk">${preparationPerson(f.id,sit,f.short)}</div>`;
 }).join('');
 return `<div class="terawang-preparation-scene" style="opacity:${reveal};transform:translateY(${12*(1-reveal)}px)">${heading('SAAT FASE TERAWANG',TEXT.terawangPreparationTitle)}<div class="terawang-preparation-board"><section class="terawang-preparation-active"><p>${TEXT.terawangActiveLabel}</p><div>${active}</div></section><section class="terawang-preparation-others"><p>${TEXT.terawangOtherPlayersLabel}</p><div>${players}</div></section></div></div>`;
}
function gamblerDuelState(p) {
 const duel=GAME_CONFIG.terawang.gamblerDuel,needed=Math.floor(duel.bestOf/2)+1;
 const score={gambler:0,target:0};let winner=null,activeRound=-1;
 const rounds=duel.rounds.map((round,index)=>{
  const start=duel.roundStart+index*duel.roundStagger;
  const opened=!winner&&p>=start;
  const finished=opened&&p>=start+duel.resultOffset;
  const handReveal=opened?ease((p-start)/duel.handDuration):0;
  const roundWinner=SUIT[round.gambler].beats===round.target?'gambler':SUIT[round.target].beats===round.gambler?'target':null;
  if(opened)activeRound=index;
  if(finished&&roundWinner){score[roundWinner]++;if(score[roundWinner]>=needed)winner=roundWinner;}
  return {...round,opened,finished,handReveal,winner:roundWinner};
 });
 const reveal=winner==='gambler'?ease((p-duel.cardRevealStart)/duel.cardRevealDuration):0;
 return {rounds,score,winner,activeRound,reveal};
}
function inspectionCardPose(reveal) {
 const progress=clamp(reveal),frontVisible=progress>=.5;
 // Rotate only the currently visible face. A visible face never turns past its edge.
 return {frontVisible,backVisible:!frontVisible,
  backAngle:90*clamp(progress*2),frontAngle:-90+90*clamp((progress-.5)*2)};
}
function gamblerInspection(p) {
 const config=GAME_CONFIG.terawang,state=gamblerDuelState(p),player=config.targetPlayer;
 const current=state.rounds[state.activeRound],won=state.winner==='gambler';
 const card=inspectionCardPose(state.reveal);
 const duel=config.gamblerDuel;
 const rule=p>=duel.tieNoteStart&&p<duel.cardRevealStart?'Seri → ronde diulang · skor tidak bertambah.':p>=duel.cardRevealStart?TEXT.gamblerForcedReveal:p>=duel.acceptanceStart?'Pemain yang ditantang wajib menerima suit.':p>=duel.scopeStart?'Selain Leader · faksi lain · ruangan yang sama.':'1 tantangan per fase · baik menang maupun kalah.';
 const hand=side=>current?`<div class="duel-hand" style="opacity:${current.handReveal};transform:translateY(${12*(1-current.handReveal)}px)">${suitIcon(current[side])}<span>${SUIT[current[side]].label}</span></div>`:'<div class="duel-hand-waiting">?</div>';
 const rounds=state.rounds.map((round,index)=>`<div class="duel-round${round.finished?' is-complete':''}${state.activeRound===index?' is-current':''}"><span>RONDE ${index+1}</span><p>${round.finished?(round.winner==='gambler'?'GAMBLER':player.label.toUpperCase()):round.opened?'SUIT…':'—'}</p></div>`).join('');
 return `<div class="terawang-gambler-scene" style="opacity:${ease(p/.06)}">
  ${heading('TERAWANG · GAMBLER','Menang suit → buka kartu',`SIMULASI PRIVAT · BEST OF ${config.gamblerDuel.bestOf} · 1× per fase`)}
  <div class="gambler-inspection-board">
   <div class="duel-gambler">${art('gambler','node-art')}<h3>Gambler</h3>${hand('gambler')}</div>
   <div class="duel-center"><span class="gm-seal">GM</span><p>SKOR SUIT</p><div class="duel-score" data-gambler-wins="${state.score.gambler}" data-target-wins="${state.score.target}"><strong>${state.score.gambler}</strong><span>:</span><strong>${state.score.target}</strong></div><span class="tag" style="opacity:${won?1:0}">GAMBLER MENANG</span></div>
   <div class="duel-target">${token(F[player.faction],false,false,'',false)}<h3>${player.label}</h3>${hand('target')}</div>
   <div class="duel-card-holder"><p>KARTU ${player.label.toUpperCase()}</p><div class="flip-card" data-role-revealed="${state.reveal===1}" data-visible-face="${card.frontVisible?'front':'back'}"><div class="flip-face flip-back" aria-hidden="${!card.backVisible}" style="visibility:${card.backVisible?'visible':'hidden'};transform:rotateY(${card.backAngle}deg)">${cardBack()}</div><div class="flip-face flip-front" aria-hidden="${!card.frontVisible}" style="visibility:${card.frontVisible?'visible':'hidden'};transform:rotateY(${card.frontAngle}deg)">${roleCard(config.targetRole,`Role asli ${player.label}`)}</div></div><span>${state.reveal===1?`TERNYATA ${config.targetRole.toUpperCase()}`:won?'KARTU WAJIB DIBUKA':'ROLE MASIH TERTUTUP'}</span></div>
   <div class="duel-rounds">${rounds}</div>
  </div>
  <div class="terawang-bottom"><p>${rule}</p><span>${p>=duel.cardRevealStart?TEXT.gamblerPrivate:'Menang dua ronde · hasil seri tidak dihitung.'}</span></div>
 </div>`;
}
function terawangScene(p) {
 return gamblerInspection(p);
}
function exchangeGachaState(p) {
 const motion=GAME_CONFIG.exchangeTutorial;
 const start=motion.rollStart,stop=motion.rollStop;
 const finalPairing=GAME_CONFIG.exchangePairing;
 const progress=clamp((p-start)/(stop-start)),position=motion.rollCycles*smoother(progress);
 const index=Math.min(motion.rollCycles,Math.floor(position));
 const penultimate=GAME_CONFIG.rollExamples.find(pairing=>pairing.every((target,source)=>target!==finalPairing[source]))||GAME_CONFIG.rollExamples[0];
 const orders=Array.from({length:motion.rollCycles+1},(_,step)=>step===motion.rollCycles?finalPairing:step===motion.rollCycles-1?penultimate:GAME_CONFIG.rollExamples[step%GAME_CONFIG.rollExamples.length]);
 const pairingAt=step=>orders[Math.min(step,motion.rollCycles)];
 return {
  rolling:p<stop,pairing:pairingAt(index),nextPairing:pairingAt(index+1),
  orders,position,offset:position*motion.layout.reelHeight,
  locked:ease((p-stop)/.025),reveal:ease((p-start)/.025)
 };
}
function exchangeTargetCard(factionIndex) {
 const f=F[factionIndex];
 return `<div class="gacha-faction-card" data-faction="${f.id}" style="--fc:${f.color}">${art(f.id,'gacha-target-art',f.short)}<h3>${f.name}</h3></div>`;
}
function exchangeGachaScene(p) {
 const layout=GAME_CONFIG.exchangeTutorial.layout,state=exchangeGachaState(p);
 const title=TEXT.exchangeRandomTitle;
 const cue=state.rolling?TEXT.exchangeRandomRule:TEXT.exchangeResultRule;
 const slots=F.map((f,index)=>`<section class="exchange-gacha-slot${state.rolling?' is-rolling':' is-locked'}" data-owner="${f.id}" data-target="${F[state.pairing[index]].id}" data-locked="${!state.rolling}" style="--fc:${f.color};--locked:${state.locked}"><div class="gacha-owner">${art(f.id,'gacha-owner-art',f.short)}<h3>${f.name}</h3></div><svg class="gacha-feed-arrow" viewBox="0 0 24 30" aria-hidden="true"><path d="M12 2v22M5 17l7 7 7-7"/></svg><div class="gacha-reel-window"><div class="gacha-reel-strip" style="transform:translate3d(0,${-state.offset}px,0)">${state.orders.map(pairing=>exchangeTargetCard(pairing[index])).join('')}</div></div><p class="gacha-status">${state.rolling?'MENGACAK…':'TARGET'}</p></section>`).join('');
 return `<div class="exchange-gacha-scene" data-roll="first" style="--slot-top:${layout.slotTop}px;--slot-width:${layout.slotWidth}px;--slot-gap:${layout.slotGap}px;--reel-height:${layout.reelHeight}px;opacity:${state.reveal}"><div class="exchange-scene-heading"><h2>${title}</h2><p>${cue}</p></div><div class="exchange-gacha-grid">${slots}</div><p class="exchange-gacha-note">${state.rolling?'':'Satu hasil untuk kedua ruangan.'}</p></div>`;
}
function exchangeRoomExample(p,completion=false) {
 const motion=GAME_CONFIG.exchangeTutorial,source=motion.sourceFaction,target=GAME_CONFIG.exchangePairing[source];
 const members=GAME_CONFIG.rooms.map((_,roomIndex)=>{
  const available=eligibleOrdinaryMembers(roomIndex,target);
  return available.includes(motion.movingMembers[roomIndex])?motion.movingMembers[roomIndex]:available[0];
 });
 return {
  mode:'exchange',source,target,members,arcHeight:motion.arcHeight,
  cases:GAME_CONFIG.rooms.map((_,roomIndex)=>({source,target,focusRoom:roomIndex,number:roomIndex+1})),
  completion,targetReveal:completion?1:ease((p-motion.targetMarkStart)/motion.targetMarkDuration),
  selection:completion?1:ease((p-motion.selectionStart)/motion.selectionDuration),lock:1,
  protection:completion?1:ease((p-motion.protectionStart)/.02),
  finalChoice:completion||p>=motion.finalChoiceStart,
  move:completion?ease((p-GAME_CONFIG.exchangeCompletion.movementStart)/GAME_CONFIG.exchangeCompletion.movementDuration):0,
  reveal:completion?1:ease((p-motion.roomsStart)/motion.roomRevealDuration)
 };
}
function exchangeRoomsScene(p,completion=false) {
 const layout=GAME_CONFIG.exchangeTutorial.layout,example=exchangeRoomExample(p,completion),source=F[example.source],target=F[example.target];
 const cue=completion?(example.move===0?'Pilihan sudah diperiksa. Tunggu aba-aba GM.':example.move<1?TEXT.exchangeMoveTogether:'Leader tetap di tempat · faksi pemain tetap sama.'):example.finalChoice?'Pilihan Leader final · tidak dapat diganti.':example.protection>0?'Leader dan Gambler tidak dipilih pada Exchange biasa.':TEXT.exchangeChooseMember;
 return `<div class="exchange-room-act" style="${leaderRoomStyle()};--leader-rooms-top:${layout.roomsTop}px;--exchange-room-scale:${layout.roomScale};opacity:${example.reveal}"><div class="exchange-scene-heading"><h2>Cara melakukan Exchange</h2></div><div class="exchange-example-pair" aria-label="${source.name} → ${target.name}">${art(source.id,'exchange-pair-art',source.short)}<span>Leader ${source.name}</span><b>→</b>${art(target.id,'exchange-pair-art',target.short)}<span>${target.name}</span></div>${leaderRooms(1,example)}<p class="exchange-room-cue">${cue}</p>${exchangeSeatedReminder()}</div>`;
}
function exchangeCompletionScene(p) {
 const duration=SCENES.find(scene=>scene.id==='exchange-completion').duration;
 const time=p*duration,gm=GAME_CONFIG.exchangeCompletion.gmDuration;
 return time<gm?exchangeScoreExampleScene(time/gm,false):exchangeRoomsScene(p,true);
}
function exchangeTutorialScene(p) {
 const motion=GAME_CONFIG.exchangeTutorial;
 if(p<motion.questionEnd){
  const exit=1-ease((p-motion.questionEnd+.02)/.02);
  return `<div class="exchange-question-scene" style="opacity:${exit}"><h2>${TEXT.exchangeQuestion}</h2><div class="exchange-question-factions">${F.map(f=>`<div style="--fc:${f.color}">${art(f.id,'exchange-question-art',f.short)}<h3>${f.name}</h3></div>`).join('')}</div></div>`;
 }
 if(p<motion.roomsStart)return exchangeGachaScene(p);
 return exchangeRoomsScene(p);
}
function gameFlowScene(p) {
 const motion=GAME_CONFIG.gameFlow, count=GAME_CONFIG.totalExchanges;
 const repeat=p>=motion.repeatStart;
 const local=clamp(repeat?(p-motion.repeatStart)/(1-motion.repeatStart):p/motion.repeatStart);
 const opacity=repeat
  ? ease((p-motion.repeatStart)/motion.transitionDuration)
  : 1-ease((p-motion.repeatStart+motion.transitionDuration)/motion.transitionDuration);
 const note=`<p class="game-flow-note">${TEXT.flowTimer}</p>`;
 if(!repeat){
  const time=p*SCENES.find(scene=>scene.id==='loop').duration;
  const active=motion.highlightTimes.reduce((last,start,index)=>time>=start?index:last,0);
  const phases=motion.phases.map((label,i)=>`<div class="game-flow-phase${i===active?' is-active':''}" role="listitem"><span class="game-flow-number">${i+1}</span><p>${label}</p></div>${i<motion.phases.length-1?'<svg class="game-flow-next" viewBox="0 0 56 24" aria-hidden="true"><path d="M4 12h44m-8-8 8 8-8 8"/></svg>':''}`).join('');
  return `<div class="game-flow-scene" style="opacity:${opacity}">
   <div class="game-flow-heading"><h2>${TEXT.flowTitle}</h2></div>
   <div class="game-flow-track" role="list" aria-label="Urutan fase permainan">${phases}</div>
   <div class="game-flow-return"><svg viewBox="0 0 1520 132" aria-hidden="true"><path d="M1297 2v66q0 20-20 20H243q-20 0-20-20V8m-9 10 9-10 9 10"/></svg><p>${TEXT.flowReturn}</p></div>
   ${note}
  </div>`;
 }
 const round=Math.min(count-1,Math.floor(local*count));
 const rounds=Array.from({length:count},(_,i)=>`<li class="${i<=round?'is-complete ':''}${i===round?'is-current':''}" aria-label="Exchange ${i+1}"><span>${i+1}</span></li>`).join('');
 return `<div class="game-flow-scene" style="opacity:${opacity}">
  <div class="game-flow-heading"><h2>${TEXT.flowRepeatTitle} ${count}</h2></div>
  <div class="game-flow-totals"><span><strong>${count}</strong> Terawang</span><span><strong>${count}</strong> Exchange</span></div>
  <ol class="game-flow-rounds" aria-label="Urutan Exchange">${rounds}</ol>
  <div class="game-flow-timer"><span>${TEXT.flowExchangeLabel}</span><strong>${motion.exchangeRange}</strong></div>
  ${note}
 </div>`;
}
function ruleIcon(kind) {
 const paths={
  whistle:'M8 24h18l10-10h12v24a16 16 0 0 1-32 0v-4H8ZM39 22h9M52 12l5-5M55 23h7M52 34l5 5',
  stop:'M19 35V15a4 4 0 0 1 8 0v15-21a4 4 0 0 1 8 0v21-17a4 4 0 0 1 8 0v19-12a4 4 0 0 1 8 0v22c0 12-8 18-19 18-9 0-14-5-18-11L7 29a4 4 0 0 1 7-4l5 10Z',
  seat:'M17 10v29h31M15 43h35M18 43v13m29-13v13M28 22h14v13h12M29 35v17M25 15a5 5 0 1 0 10 0 5 5 0 0 0-10 0Z',
  quiet:'M20 26a17 17 0 1 1 24 0M18 29v12a14 14 0 0 0 28 0V29M22 31h2m16 0h2M30 43h4M32 33v23M28 54h8',
  clock:'M32 7a25 25 0 1 1 0 50 25 25 0 0 1 0-50ZM32 16v17l12 7',
  camera:'M7 19h12l5-9h16l5 9h12v35H7ZM32 26a10 10 0 1 1 0 20 10 10 0 0 1 0-20ZM6 6l52 52',
  swap:'M9 20h44l-9-9m9 9-9 9M55 44H11l9 9m-9-9 9-9M6 6l52 52',
  lock:'M20 29V18a12 12 0 0 1 24 0v11M14 29h36v28H14ZM32 40v8',
  chat:'M8 11h48v32H31L17 55V43H8ZM18 22h28M18 31h18',
  check:'M12 33l13 13 28-29',
  info:'M32 7a25 25 0 1 1 0 50 25 25 0 0 1 0-50ZM32 29v17m0-28v3'
 };
 return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="${paths[kind]}"/></svg>`;
}
function gmCuesScene(p) {
 const time=p*SCENES.find(scene=>scene.id==='gm-cues').duration;
 const actions=[['stop','Berhenti'],['seat','Duduk'],['quiet','Diam']].map((action,index)=>[...action,GAME_CONFIG.gmCues.actionTimes[index]]);
 return `<div class="gm-cue-scene">${heading('ABA-ABA GM','Dengar peluit, ikuti arahan','Semua pemain berhenti, duduk, dan diam.')}
 <div class="gm-cue-whistle">${ruleIcon('whistle')}<span>PELUIT GM</span></div>
 <div class="gm-cue-actions">${actions.map(([icon,label,start])=>`<article class="gm-cue-action" data-action="${icon}" data-active="${time>=start}" style="opacity:${.38+.62*ease((time-start)/400)};transform:translateY(${12*(1-ease((time-start)/400))}px)">${ruleIcon(icon)}<h3>${label}</h3></article>`).join('')}</div>
 <div class="gm-cue-next" style="opacity:${ease((time-GAME_CONFIG.gmCues.soundStart)/450)}">${ruleIcon('clock')}<p>Selanjutnya, ikuti sound cue dan timer GM.</p></div></div>`;
}
function discussionScene(p) {
 const f=F[0],move=smoother((p-.2)/.55);
 return `<div class="discussion-scene" style="--fc:${f.color};--ribbon-color:${f.color}">${heading('FASE DISKUSI','Bagikan informasi, bantu Leader',`Contoh satu faksi · ${f.name} · ruangan yang sama`)}
 <div class="discussion-board"><section>${art('gambler','discussion-role-art','G')}<h3>Gambler</h3><p>Hasil Terawang</p></section><section><div class="discussion-members">${Array.from({length:3},()=>token(f,false,false,'',false)).join('')}</div><h3>Anggota faksi</h3><p>Diskusikan informasi</p></section><section><div class="discussion-leader">${ribbonHeadFigure(1)}</div><h3>Leader</h3><p>Tentukan pilihan</p></section></div>
 <div class="discussion-info-track" aria-hidden="true"><i></i><span style="transform:translateX(${move*900}px)">${ruleIcon('info')}INFO</span></div>
 <p class="new-rule-caption">Gunakan informasi untuk memilih pemain saat Exchange.</p></div>`;
}
function terawangLossScene() {
 return `<div class="terawang-loss-scene" data-conditional="gambler-loses">${heading('HASIL ALTERNATIF SUIT','Jika Gambler kalah','Kartu role lawan tetap dirahasiakan.')}
 <div class="terawang-loss-board"><div>${art('gambler','loss-gambler-art','G')}<h3>Gambler kalah</h3></div><span class="loss-lock">${ruleIcon('lock')}</span><div>${cardBack()}<p>Tidak diperlihatkan</p></div></div><p class="new-rule-caption">Kesempatan Terawang sudah digunakan untuk fase ini.</p></div>`;
}
function cardSafetyScene(p) {
 const time=p*SCENES.find(scene=>scene.id==='card-safety').duration;
 return `<div class="card-safety-scene">${heading('ATURAN KARTU','Simpan kartu, rahasiakan role','Kartu asli tetap bersama pemainnya.')}
 <div class="card-safety-back">${cardBack()}</div><div class="card-safety-rules"><div class="card-safety-forbidden" style="opacity:${ease((time-GAME_CONFIG.cardSafety.forbiddenStart)/400)}"><span>${ruleIcon('swap')}<b>Jangan ditukar</b></span><span>${ruleIcon('camera')}<b>Jangan difoto</b></span></div>
 <div class="card-safety-allowed" style="opacity:${ease((time-GAME_CONFIG.cardSafety.allowedStart)/400)}"><p>HANYA BOLEH DIPERLIHATKAN KEPADA</p><div><span>${art('gambler','safety-gambler-art','G')}<b>Gambler pemenang</b></span><span><i class="gm-seal">GM</i><b>Game Master</b></span></div></div></div><p class="new-rule-caption">Tunjukkan kartu hanya saat aturan mengizinkannya.</p></div>`;
}
function roomCommunicationScene(p) {
 const time=p*SCENES.find(scene=>scene.id==='room-communication').duration,carry=ease((time-GAME_CONFIG.roomCommunication.carryStart)/450);
 return `<div class="room-communication-scene">${heading('INFORMASI ANTAR RUANGAN','Tidak ada komunikasi langsung','Room A dan Room B bermain di ruangan masing-masing.')}
 <div class="communication-rooms">${GAME_CONFIG.rooms.map(room=>`<section><h3>${room}</h3><div>${F.map(f=>token(f,false,false,'',false)).join('')}</div></section>`).join('')}</div>
 <div class="communication-block">${ruleIcon('chat')}<i></i><p>DILARANG</p></div>
 <div class="communication-carry" style="opacity:${carry};transform:translateY(${12*(1-carry)}px)">${token(F[0],false,false,'',false)}<div><span>INFORMASI</span><p>Dibawa pemain yang berpindah melalui Exchange.</p></div></div></div>`;
}
function renderScene(id,p){
 switch(id){
 case 'intro': return openingIntro(p);
 case 'card-pickup': return takeCards(p);
 case 'rooms': return roomOverview(p);
 case 'faction-spots': return factionSpotsScene(p);
 case 'gm-cues': return gmCuesScene(p);
 case 'leaders': return leaderSetupScene(p);
 case 'leader-protection': return leaderProtectionScene(p);
 case 'ribbons': return ribbonScene(p);
 case 'leader-rules': return exchangeTutorialScene(p);
 case 'roles': return rolesOverviewScene(p);
 case 'inspection': return inspectionScene(p);
 case 'discussion': return discussionScene(p);
 case 'anchor': return exchangeTutorialScene(p);
 case 'exchange': return exchangeTutorialScene(p);
 case 'exchange-completion': return exchangeCompletionScene(p);
 case 'gm-selection': return gmSelectionScene(p);
 case 'gambler-exchange': return gamblerExchangeScene(p);
 case 'loop': return gameFlowScene(p);
 case 'final': return finalPhaseScene(p);
 case 'card-safety': return cardSafetyScene(p);
 case 'room-communication': return roomCommunicationScene(p);
 case 'end':
  return `<div class="closing-scene center" style="padding-top:20px;opacity:${1-ease((p-GAME_CONFIG.closingMotion.fadeStart)/GAME_CONFIG.closingMotion.fadeDuration)}"><div class="eyebrow">${TEXT.closingEyebrow}</div><div class="factions" style="margin:70px 0">${F.map(faction).join('')}</div><h1>${TEXT.closingTitle}</h1><p class="subtitle" style="margin-top:30px">${TEXT.closingSubtitle}</p></div>`;
 }
}
let elapsed=0,playing=false,started=false,last=0,sceneIndex=0,idleTimer;
const sceneEl=$('#scene'),seek=$('#seek');seek.max=total/1000;
const narrationAudio=$('#narrationAudio'),voiceButton=$('#voiceoverControl');
let voicePending=false,voiceBlocked=false,voiceFailed=false,voiceEnded=false,voiceRequest=0;
function updateVoiceButton(){
 voiceButton.hidden=!GAME_CONFIG.narration.enabled||voiceFailed;
 voiceButton.textContent=voiceBlocked?'Aktifkan suara':narrationAudio.muted?'Suara: mati':'Suara: aktif';
 voiceButton.setAttribute('aria-pressed',String(Boolean(narrationAudio.muted)));
 voiceButton.setAttribute('aria-label',voiceBlocked?'Aktifkan narasi':narrationAudio.muted?'Nyalakan narasi':'Bisukan narasi');
}
function pauseNarration(){
 if(!narrationAudio.paused||voicePending){voiceRequest++;voicePending=false;narrationAudio.pause();}
}
function hasNarrationClock(){
 return GAME_CONFIG.narration.enabled&&!voiceFailed&&!voiceBlocked&&narrationAudio.readyState>=2&&!narrationAudio.paused&&!narrationAudio.seeking;
}
function syncNarration(forceSeek=false){
 const config=GAME_CONFIG.narration,sourceTime=elapsed/1000;
 if(!config.enabled||voiceFailed||elapsed>=total){pauseNarration();return;}
 if(forceSeek)voiceEnded=false;
 if(voiceEnded){pauseNarration();return;}
 if(narrationAudio.readyState>=1&&(forceSeek||(!playing&&Math.abs(narrationAudio.currentTime-sourceTime)>.025))){
  try{narrationAudio.currentTime=sourceTime;}catch(error){/* A seek resumes once metadata arrives. */}
 }
 narrationAudio.volume=clamp(config.volume);
 if(!playing){pauseNarration();return;}
 if(!narrationAudio.paused||voicePending||voiceBlocked)return;
 const request=++voiceRequest;voicePending=true;
 const failed=error=>{
  if(request!==voiceRequest)return;
  voicePending=false;
  if(error?.name==='NotAllowedError'){voiceBlocked=true;setPlaying(false);wake();}
  else if(error?.name!=='AbortError'){voiceFailed=true;pauseNarration();}
  updateVoiceButton();
 };
 try{
  Promise.resolve(narrationAudio.play()).then(()=>{
   if(request!==voiceRequest)return;
   voicePending=false;
   if(!playing)pauseNarration();
  },failed);
 }catch(error){failed(error);}
}
narrationAudio.addEventListener('loadedmetadata',()=>{voiceFailed=false;voiceEnded=false;updateVoiceButton();syncNarration(true);});
narrationAudio.addEventListener('timeupdate',()=>{
 if(playing&&hasNarrationClock()){elapsed=Math.min(total,narrationAudio.currentTime*1000);draw();if(elapsed>=total)setPlaying(false);}
});
narrationAudio.addEventListener('ended',()=>{
 if(Number.isFinite(narrationAudio.duration)&&narrationAudio.currentTime<narrationAudio.duration-.05)return;
 voiceEnded=true;voicePending=false;
 if(playing){elapsed=total;setPlaying(false);draw();}
});
narrationAudio.addEventListener('error',()=>{voiceFailed=true;pauseNarration();updateVoiceButton();});
voiceButton.onclick=()=>{
 if(voiceBlocked){voiceBlocked=false;setPlaying(true);}
 else narrationAudio.muted=!narrationAudio.muted;
 updateVoiceButton();syncNarration();
};
if(GAME_CONFIG.narration.enabled)narrationAudio.src=GAME_CONFIG.narration.asset;
updateVoiceButton();
$('#chapters').innerHTML=SCENES.map(s=>`<i style="width:${s.duration/total*100}%"></i>`).join('');
const format=t=>`${Math.floor(t/60000)}:${String(Math.floor(t/1000)%60).padStart(2,'0')}`;
$('#launchDuration').textContent=format(total);
function locate(t){let i=starts.findIndex((s,n)=>t>=s&&t<(starts[n+1]??total+1));return i<0?SCENES.length-1:i}
let lastMarkup = '';
const sceneTemplate = document.createElement('template');
function syncChildren(target, source) {
 const next = Array.from(source.childNodes);
 next.forEach((node,i) => {
  const current = target.childNodes[i];
  if (!current) { target.appendChild(node.cloneNode(true)); return; }
  if (current.nodeType!==node.nodeType || current.nodeName!==node.nodeName) {
   target.replaceChild(node.cloneNode(true),current); return;
  }
  if(node.nodeType===3){ if(current.nodeValue!==node.nodeValue)current.nodeValue=node.nodeValue; return; }
  if(node.nodeType!==1)return;
  for(const attr of Array.from(current.attributes))if(!node.hasAttribute(attr.name))current.removeAttribute(attr.name);
  for(const attr of Array.from(node.attributes))if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
  syncChildren(current,node);
 });
 while(target.childNodes.length>next.length)target.lastChild.remove();
}
function draw(){
 sceneIndex=locate(elapsed);
 const s=SCENES[sceneIndex],p=clamp((elapsed-starts[sceneIndex])/s.duration);
 const markup=renderScene(s.id,p);
 if(markup!==lastMarkup){sceneTemplate.innerHTML=markup;syncChildren(sceneEl,sceneTemplate.content);lastMarkup=markup;}
 const entrance=ease(p/.025);
 sceneEl.style.opacity=entrance;
 sceneEl.style.transform=`translateY(${(1-entrance)*16}px)`;
 $('#stage').classList.toggle('opening-active',s.id==='intro');
 $('#stage').classList.toggle('anchor-active',s.id==='anchor');
 $('#stage').classList.toggle('exchange-active',s.id==='exchange');
 $('#stage').classList.toggle('closing-active',['loop','final','end'].includes(s.id));
 $('#stage').classList.toggle('distribution-active',['card-pickup','rooms','leaders','leader-rules'].includes(s.id));
 $('#stage').style.setProperty('--drift',`${Math.sin(elapsed/25000)*18}px`);
 $('#stage').style.setProperty('--film-clock',`${-elapsed/1000}s`);
 $('#stage').style.setProperty('--scene-clock',`${-(elapsed-starts[sceneIndex])}ms`);
 $('#stage').style.setProperty('--scene-reveal',`${ease(p/.055)}`);
 $('#stage').style.setProperty('--light-x',`${20+60*ease(p)}%`);
 $('#chapterName').textContent=s.title;
 $('#time').textContent=`${format(elapsed)} / ${format(total)}`;
 seek.value=elapsed/1000;
 seek.setAttribute('aria-valuetext',`${format(elapsed)} — ${s.title}`);
 $('#filmProgress').style.width=`${1856*elapsed/total}px`;
 $('#endScreen').hidden=elapsed<total||!started;
 syncNarration();
 if(DEBUG){$('#debug').hidden=false;$('#debug').textContent=`${s.id}\nScene: ${((elapsed-starts[sceneIndex])/1000).toFixed(2)}s\nTotal: ${(elapsed/1000).toFixed(2)}s`;}
}
function wake(){document.body.classList.remove('idle');clearTimeout(idleTimer);if(playing)idleTimer=setTimeout(()=>{if(!$('#controls').matches(':focus-within'))document.body.classList.add('idle')},1800)}
function setPlaying(value){playing=value;if(value)voiceBlocked=false;last=performance.now();document.body.classList.toggle('playing',playing);$('#play').textContent=playing?'Ⅱ Jeda':'▶ Putar';wake();updateVoiceButton();syncNarration(true)}
function start(recording=false){started=true;$('#launch').hidden=true;elapsed=0;draw();setPlaying(true);if(recording){if(!document.fullscreenElement)fullscreen();document.activeElement?.blur();document.body.classList.add('idle')}}
function jump(t){elapsed=Math.max(0,Math.min(total,t));last=performance.now();if(elapsed===total)setPlaying(false);draw();syncNarration(true);wake()}
function toggle(){if(!started){start();return}if(elapsed>=total)elapsed=0;setPlaying(!playing);draw()}
function previewScene(id,cue){
 if(['active-roles','passive-roles'].includes(id))id='roles';
 if(['anchor','leader-rules'].includes(id))id='exchange';
 if(cue==='terawang-preparation'&&['roles','inspection'].includes(id))id='inspection';
 const index=SCENES.findIndex(scene=>scene.id===id);if(index<0)return;
 const scene=SCENES[index],motion=GAME_CONFIG.terawangPreparation;
 const offset=id==='inspection'&&cue==='terawang-preparation'
  ? motion.previewTime : id==='final'&&cue==='gm-example'
  ? GAME_CONFIG.exchangeScoring.overviewDuration+GAME_CONFIG.exchangeScoring.example.previewTime : (scene.previewTime??500);
 started=true;$('#launch').hidden=true;setPlaying(false);jump(starts[index]+Math.max(0,Math.min(scene.duration-1,offset)));
}
async function fullscreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch(e){$('#fullscreen').textContent='Fullscreen: gunakan menu browser';}}
$('#start').onclick=()=>start();$('#replay').onclick=()=>start();$('#record').onclick=()=>start(true);$('#recordControl').onclick=()=>start(true);$('#play').onclick=toggle;$('#restart').onclick=()=>start();$('#fullscreen').onclick=fullscreen;$('#previous').onclick=()=>jump(starts[Math.max(0,sceneIndex-1)]);$('#next').onclick=()=>jump(starts[Math.min(SCENES.length-1,sceneIndex+1)]);
document.querySelectorAll('[data-jump]').forEach(button=>button.addEventListener('click',()=>{
 previewScene(button.dataset.jump);
}));
// Pointer clicks must not leave a focused control holding the recording UI open.
$('#controls').addEventListener('pointerup',e=>{if(e.target.closest('button'))e.target.closest('button').blur()});
let scrubResume=false;seek.addEventListener('pointerdown',()=>{scrubResume=playing;setPlaying(false)});seek.addEventListener('input',()=>jump(Number(seek.value)*1000));function finishScrub(){if(scrubResume)setPlaying(true);scrubResume=false;}
seek.addEventListener('change',finishScrub);
document.addEventListener('pointerup',finishScrub);
document.addEventListener('pointercancel',finishScrub);
seek.addEventListener('pointermove',e=>{const rect=seek.getBoundingClientRect(),fraction=clamp((e.clientX-rect.left)/rect.width),t=fraction*total;$('#hoverTime').style.display='block';$('#hoverTime').style.left=`${Math.min(rect.width-180,Math.max(0,fraction*rect.width-65))}px`;$('#hoverTime').textContent=`${format(t)} · ${SCENES[locate(t)].title}`});seek.addEventListener('pointerleave',()=>$('#hoverTime').style.display='none');
document.addEventListener('pointermove',wake);document.addEventListener('pointerdown',wake);document.addEventListener('focusin',wake);
document.addEventListener('keydown',e=>{if(e.target===seek&&['ArrowLeft','ArrowRight','Home','End'].includes(e.code))return;if(['Space','ArrowLeft','ArrowRight','KeyR','KeyF'].includes(e.code)){e.preventDefault();if(e.code==='Space')toggle();if(e.code==='KeyR')start();if(e.code==='KeyF')fullscreen();if(e.code==='ArrowLeft')$('#previous').click();if(e.code==='ArrowRight')$('#next').click();}});
$('#atmosphere').innerHTML=GAME_CONFIG.effects.enabled?Array.from({length:GAME_CONFIG.effects.dustCount},(_,i)=>`<i class="gold-mote" style="left:${4+(i*37)%92}%;top:${8+(i*23)%83}%;--offset:${-i*1.73}s;--duration:${12+i%6*2}s;--size:${2+i%3}px"></i>`).join('')+'<div class="ambient-halo"></div>':'';
$('#stage').classList.toggle('effects-on',GAME_CONFIG.effects.enabled);
function resize(){document.documentElement.style.setProperty('--scale',Math.min(innerWidth/1920,innerHeight/1080))}addEventListener('resize',resize);resize();draw();
function frame(now){
 if(playing){
  if(hasNarrationClock())elapsed=Math.min(total,narrationAudio.currentTime*1000);
  else if(!GAME_CONFIG.narration.enabled||voiceFailed)elapsed=Math.min(total,elapsed+now-last);
  draw();if(elapsed>=total)setPlaying(false);
 }
 last=now;requestAnimationFrame(frame);
}requestAnimationFrame(frame);
// Helpful inspection API; seeking and pause always use the same deterministic clock.
window.TUTORIAL={config:GAME_CONFIG,scenes:SCENES,total,seek:jump,play:()=>setPlaying(true),pause:()=>setPlaying(false),get time(){return elapsed}};
const playbackParams=new URLSearchParams(location.search);
if(playbackParams.has('autoplay'))start(playbackParams.has('record'));
else if(playbackParams.has('scene'))previewScene(playbackParams.get('scene'),playbackParams.get('cue'));
