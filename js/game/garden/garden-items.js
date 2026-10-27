/* Khu vườn (bản xem trước) — sinh từ scratchpad garden/build_app.py. Không phụ thuộc thư viện ngoài. */
window.GardenItems = (() => {
/* ---------- colour helpers ---------- */
function hexToHsl(h){h=h.replace('#','');const r=parseInt(h.slice(0,2),16)/255,g=parseInt(h.slice(2,4),16)/255,b=parseInt(h.slice(4,6),16)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let H=0,S=0,L=(mx+mn)/2;
  if(mx!==mn){const d=mx-mn;S=L>.5?d/(2-mx-mn):d/(mx+mn);H=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;H*=60}
  return [H,S*100,L*100]}
const hsl=(h,s,l)=>`hsl(${h} ${s}% ${Math.max(0,Math.min(100,l))}%)`;
function tri(hex,k='a'){const [h,s,l]=hexToHsl(hex);const o={};
  const map={a:['a','b','c'],d:['d','e',null],y:['y',null,null]}[k];
  o[map[0]]=hex; if(map[1])o[map[1]]=hsl(h,s,l-18); if(map[2])o[map[2]]=hsl(h,Math.min(100,s+5),l+16); return o}
const RB='R', RBD='Rd', RBL='Rl';
const TIER={1:{vi:'Đồng',en:'Copperleaf',c:'#c27a45'},2:{vi:'Bạc',en:'Silvermoon',c:'#c9d1dc'},3:{vi:'Vàng',en:'Goldensun',c:'#f0c04a'},
  4:{vi:'Ngọc',en:'Jadeheart',c:'#3fc5a0'},5:{vi:'Tinh Thể',en:'Starcrystal',c:'#a985f5'},vip:{vi:'Cầu Vồng',en:'Prismatic',c:'#ffd76b'}};
const ROMAN={1:'I',2:'II',3:'III',4:'IV',5:'V',vip:'VIP'};
const DEF={w:'#ffffff',k:'#2a1d14',g:'#4caf50',h:'#2f7a3a',l:'#9be07a',s:'#8a6440',t:'#5a3d25',y:'#ffd84a',x:'rgba(200,232,255,.28)',d:'#c0392b',e:'#8e2a1f',p:'#ff9cb0'};
const OUTLINE='#120d0a';

/* ---------- sprite templates (16×16, outline added automatically) ---------- */
const T={
BUD:["......ca........",".....caab..w....","....caaaab.ww...","....caaaab......","....aaaabb......",".....abbb.......","..lg..g..gl.....",".lggg.g.gggh....","..lgggggghh.....","....hgggh.......","......g........."],
BLOOM:[".....caab.......","....caaaab......",".cab.yyyy.cab...","caaayyyyyyaaab..","caayykyykyyaab..",".aayyyyyyyyab...","caayypyypyyaab..","caaayykkyyaaab..",".abb.yyyy.abb...","....caaaab......",".....abbb......."],
CLOVER:["...cc....cc.....","..caab..caab....","..caaab.caaab...","...caaabaaab....","..cc.aabbb.cc...",".caaabbdbbaab...",".caaab.d.baab...","..aab..d..bb....",".......d...w....","......d........."],
ROSE:["....cwcab.......","...cwccaab......","..cwaacaabb.....","..caacwaabb.....","..caaacabbb.....","...aaabbbb......","....abbb........","...l.dd.l.......","..lgg.d.ggl.....","...gg.d.gg......","......d........."],
TREE:["....clllll......","..clggggyggl....",".clgyggggggh....",".lgggggggyghh...",".gggyggggggghh..",".hgggggggyghhh..","..hhgggggghhh...","....hhssshh.....",".....sksks......",".....sssst......","....sssstt......","..lssst.sstl...."],
POUCH:[".....d...d......","......ddd.......",".....abdba......","....caaaaab.....","...caaaaaaab....","..caaaeyeaaab...",".caaaeyyyeaaab..",".caaaaeyeaaaab..",".caaaaaeaaaaab..",".caaaaaaaaaabb..","..aaaaaaaaabbb..","...abbbbbbbbb..."],
SEED:[".......lg.......","......lg........","......cab.......",".....caaab......","....caaaaab.....","....cwaaaab.....","....ckaakab.....","....caaaabb.....",".....aabbb......","......bbb......."],
RADISH:["....l..l........","...lgllgl.......","....lghg........",".....hgh........","....caaab.......","...caaaaab......","...cakaakab.....","...cpaaaapb.....","....aaaabb......",".....aabb.......","......ab........","......b........."],
GOURD:[".......st.......","......l.s.......",".....lg.s.......","...cacbcabcab...","..caabcaabcaab..",".caaabawwbaaabb.",".caaabwwaaaaabb.",".caaabwwaaaaabb.",".aaaabawwbaaabb.","..aabbaabbabbb..","...bbbbbbbbbb..."],
BERRY:["...l.hgh.l......","....hgggh.......","...caaaaab......","..caayaayab.....",".cwaaaaaaaab....",".caayaayaaab....",".caaaaaaayab....","..aayaayaab.....","...aaaaabb......","....aabb........",".....bb........."],
GRAPE:["......hs........",".....l.s........","....lg.s........","...caccacb......","..cabcabcab.....","..abbabbabb.....","...cacacab......","...abbabbb......","....cacab.......","....abbbb.......",".....cab........",".....ab........."],
APPLE:["......t.........","......s.lll.....",".....s.lgg......","..ccaa.saab.....",".cwcaaaaaaab....",".ccaaaaaaaab....",".caakaaakaab....",".capaaaaapab....",".aaaakkkaabb....","..aaaaaaabb.....","...abbabb......."],
PEACH:[".......s........","....ll.s.ll.....","...lggls.lggl...","....hh.s..hh....","....caaraab.....","...caaarraab....","..cwaaarraaab...","..caaaarraaab...","..caaaarrabbb...","...aaaarrbbb....","....abbrrbb.....",".....bbbbb......"],
SACK:["......tt........",".....ssss.......",".....tsst.......","....xwxxx.......","...caaaaab......","..caaaaaaab.....",".cwaaeeaaaab....",".caaeyyeaaab....",".caaeyyeaaab....",".caaaeeaaabb....","..aaaaaaabb.....","...abbbbbb......"],
VIAL_S:["......ss........","......tt........",".....xwxx.......","....caaab.......","....cwaab.......","....caaab.......",".....abb........"],
FLASK_M:["......ss........",".....ssss.......","......tt........",".....xwxx.......","....caaaab......","...cwaaaaab.....","...cwaawaab.....","...caaaaaab.....","...caaaaabb.....","....abbbbb......"],
FLASK_L:["......ss........",".....ssss.......","......tt........",".....yyyy.......","....xwxxxx......","...caaaaaab.....","..cwaaaaaaab....","..cwaawaaaab....","..caaaaaawab....","..caaaaaaaab....","..caaaaaaabb....","...aaaaaabb.....","....abbbbb......"],
SPRAY:["..d.............","...d.kkkk.......","..d.kkkkkk......","......kk........",".....xwwx.......","....caaaab......","....caaaab......","....cayyab......","....cyeeyb......","....cayyab......","....caaaab......","....caaabb......","....aaabbb......",".....bbbb......."],
SCARE:["......ttt.......",".....ttttt......","...ttttttttt....","....caaaac......","...yakaakay.....","....apaapa......","....aakkaa......","..ydddddddy.....",".y.ddedddd.y....","...ddddddd......","....ddddd.......","......s.........","......s.........",".....tst........"],
SOIL:[".......cc.......",".....caaaac.....","...caaayaaaac...",".caaaaaaaaaaaac.",".bbaaaaaaaaaaee.",".bbbbaaaaaaeeee.",".bbbbbbaaeeeeee.",".bbtbbbbeeeteee.",".bbbbbbbeeeeeee.",".btbbbbbeeeetee.",".bbbbbtbeeteeee.","..bbbbbbeeeeee..","....bbbbeeee....","......bbee......"],
SCROLL:["..ssssssssss....",".sttttttttttt...","..caaaaaaaab....","..ckkkkkkkab....","..caaaaaaaab....","..ckkkkkkaab....","..caaaaaaaab....","..ckkkkaaaab....","..caaaaaaddb....","..caaaaaddddb...","..caaaaaddyd....",".sssssssddd.....",".ttttttttt......"],
FENCE:["..c....c....c...",".cab..cab..cab..",".aab..aab..aab..","ddddddddddddddd.",".aagl.aab.laab..",".aab..agh..aab..","ddddddddddddddd.",".aab..aab..aab..",".abb..abb..abb.."],
PATH:["....caab........","...caaaab..cab..","...aaaabb.caaab.","....abbb..aabb..",".cab.....g......","caaab.caaab.....","aaabb.aaaabb.l..",".abb..aaabbb....","...g...abbb.....","......l...cab...","..caab...caaab..",".caaaab..aaabb..",".aaabbb...abb...","..abbb.g........"],
LANTERN:["......kk........",".....k..k.......","......kk........","....tttttt......","...tyyyyyyt.....","...tyywlwyd.....","...tywlllwd.....","...tyywlwyd.....","...tyyyyydd.....","....tttttt......",".....tttt......."],
SICKLE:["......ccca......","....cca...ab....","...ca......b....","..ca.......b....","..ca......bb....","..ab.....bb.....","...b...bb.......","....bbb.........",".....st.........","......st........",".......st.......","........st......",".........st....."],
CAN:[".......cccc.....","......c....b....","......c....b....",".d..caaaaaaab...","dwd.caaaaaaabb..",".dccaaaaaaaabb..","...ccaayyaaabb..","....caaaaaaabb..","....caaaaaaabb..","....aaaaaaabbb..",".....bbbbbbbb..."],
SPADE:["......ss........",".....s..s.......","......ss........",".......s........",".......s........",".......t........",".......t........",".....caaab......","....caaaaab.....","....cwaaaab.....","....caaaaab.....",".....aaaab......","......abb.......",".......b........"],
BISCUIT:["..ca......ca....",".caab....caab...",".caaaaaaaaaab...","caaadaaadaaaab..","caaddaaaddaaab..","caaaaadaaaaaab..","caaaadddaaaabb..","caaadddddaaabb..","caaaadddaaaabb..",".aaaaaaaaaabb...","..abbbbbbbbb...."],
WEED:["....l.....l.....","...lg....lg.....","...gh...lgh.....","....gh..gh..l...","...lg..lg..lg...","..lgh..gh..gh...","...gh.lg..lg....","..lg..gh.lgh....","..gh.lg..gh.....","...g.gh.lg......","...gh.g.gh......","....gggggh......","...ddddddd......","....eeeee......."],
CHILI:[".........hg.....","........hg......",".......lgg......","......caab......",".....caaab......","....cwaabb......","...caaabb.......","..caaabb........","..caabb.........","..aabb..........",".yabb...........","y.b.............",".y.............."],
SPROUT:["..ll........ll..",".lggl......lggh.",".lgggl....lgggh.","..ggggl..lgggh..","...hgggllgghh...",".....hhgghh.....",".......gg.......",".......gh.......",".......gh.......","......wgh.......",".....sssst......","....sstsstt....."],
TEA:[".....w.w........","....wwwww.......",".....www........","......w.........","..caaaaaaaab....","..cddddddddb....","..caaaaaaaabaa..","..caaagaaaab..a.","..caagggaaab..a.","...caagaaab.aa..","...caaaaabb.....","..ccbbbbbbbbb..."],
STEW:[".....w.w........","....wwwww.......",".....www........","......w.........",".cddyddddyddb...",".caaaaaaaaaab...",".caaaaaaaaabb...","..caaeeeaabb....","..caaaaaaabb....","...abbbbbbb.....","....bbbbbb......"],
TEAR:[".......c........","......cab.......","......cab.......",".....cwaab......",".....cwaab......","....cwaaabb.....","....cwaaabb.....","...cwaaaaabb....","...cwaacaabb....","...caaccaabb....","...caaaaabbb....","....aaaabbb.....",".....abbbb......"],
HEART:["....d.....d.....","...dyd...dyd....","..cca.d.dcca....",".cwaab..cwaab...",".cwaaabcaaabb...",".caaaaaaaaabb...",".caaaayaaaabb...","..aaayyyaabb....","...aaayaabb.....","....aaabbb......",".....abbb.......","......bb........"],
CORE:["......l.l.......",".....lgglg......","......hgh.......",".....caaab......","....cwaaaab.....","...cwaayaaab....","...caayyyaab....","...caaayaabb....","...caaaaaabb....","....aaaaabb.....",".....abbbb......"],
GLASS:["..tttttttttt....","...scaaaaabs....","...sxcaaabxs....","...sxxcabxxs....","...sxxxaxxxs....","...sxxxaxxxs....","...sxxcwbxxs....","...sxcwaabxs....","...scaaaaabs....","..tttttttttt...."],
MUG:["..wwwwwww.......",".wcwcwcwwww.....",".saaaaaaas......",".styyyyyts.ss...",".saaaaaaass..s..",".saaaaaaas...s..",".styyyyyts...s..",".saaaaaaass.s...",".saaaaaaasss....",".tttttttt......."],
SHIELD:["..ccccccccccc...",".cayyyyyyyyyab..",".cyaaaaaaaaayb..",".cyaaawwaaaayb..",".cyaawwkwwaayb..",".cyaaawwaaaayb..",".cyaaaaaaaaayb..","..cyaaaaaaayb...","..cyaaaaaaayb...","...cyaaaaayb....","....cyaaayb.....",".....cyayb......","......cyb......."],
CLOCK:["..y.........y...",".yyy.ccccc.yyy..","..ycwwwwwwwby...","...cwwwkwwwwb...","..cwwwwkwwwwwb..","..cwwwwkwwwwwb..","..cwwwwkkkkwwb..","..cwwwwwwwwwwb..","...cwwwwwwwwb...","....bwwwwwwb....",".....bbbbbb.....","...yy......yy..."],
BOMB:[".........y.w....","........ydy.....",".......s.y......","......s.........",".....tt.........","....caaab.......","...cwaaaab......","..cwaaaaaab.....","..cakaakaab.....","..caappaabb.....","..aaaaaaabb.....","...aaaabbb......","....abbb........"],
SHARD:[".........c......","........cab.....",".......caab.....","......caaab.....",".....caadab.....","....caadaab.....","...caadaabb.....","...cadaaabb.....","....aaaabb......",".....aabb.......","......bb........"],
CHEST:["...cccccccccc...","..caaaaaaaaaab..",".caaaaaaaaaaaab.",".yyyyyyyyyyyyyy.",".caaaaayyaaaaab.",".caaaaykkyaaaab.",".caaaaayyaaaaab.",".caaaaaaaaaaaab.",".cyaaaaaaaaaayb.","..yyyyyyyyyyyy..","..bbbbbbbbbbbb.."]
};

/* ---------- item data ---------- */
const G=[
 {id:1,vi:'Tiền tệ chính',en:'Bloom Treasury',desc:'Quy luật chung: 5 đơn vị bậc dưới đổi 1 đơn vị bậc trên.'},
 {id:2,vi:'Hạt giống',en:'Seed Vault',desc:'Mỗi túi chứa 10 hạt cùng bậc.'},
 {id:3,vi:'Nông sản',en:'Harvest',desc:'Mỗi loại hạt cho ra đúng một loại nông sản cố định.'},
 {id:4,vi:'Chăm sóc & bảo vệ vườn',en:'Grove Keeping',desc:'Vật phẩm tiêu hao, khối đất và đồ trang trí.'},
 {id:5,vi:'Vật phẩm cho Pet',en:'Companion Pantry',desc:'Trạng thái no đói: Sắp chết đói → Đói → Bình thường → No → Hưng phấn.'},
 {id:6,vi:'Vật phẩm chiến đấu',en:'Battle Satchel',desc:'Dùng trong trận gõ nhanh hoặc đọc thành tiếng.'},
 {id:7,vi:'Rương thưởng',en:'Reward Coffers',desc:'Rơi ra mọi vật phẩm ở nhóm 1–6 (trừ dụng cụ mặc định). Khi khiêu chiến: thêm Đá Tiến Hóa đúng nguyên tố của pet đã tham chiến.'},
 {id:0,vi:'Dụng cụ mặc định trong vườn',en:'Garden Hearth',desc:'Không nằm trong kho. Có sẵn một ô cố định trong vườn, dùng vô hạn.'}
];
const SZ={1:['Nhỏ','Minor'],2:['Vừa','Greater'],3:['Lớn','Grand']};
const I=[];
const add=(o)=>I.push(o);
// Group 1
add({g:1,vi:'Nụ Sương',en:'Dewbud',tier:1,tpl:'BUD',pal:{...tri('#f4a7c0'),w:'#bfeaff'},note:'Đơn vị gốc (hoa nhỏ).'});
add({g:1,vi:'Hoa Bình Minh',en:'Dawnbloom',tier:2,tpl:'BLOOM',pal:{...tri('#ff9a6b'),d:'#e8743b',y:'#ffe07a'},note:'= 5 Nụ Sương (hoa lớn).'});
add({g:1,vi:'Hoa Tứ Diệp',en:'Luckpetal',tier:3,tpl:'CLOVER',pal:{...tri('#5fcf6a'),d:'#2f7a3a',w:'#fff3a8'},note:'= 5 Hoa Bình Minh (hoa may mắn).'});
add({g:1,vi:'Hoa Pha Lê',en:'Prismrose',tier:4,tpl:'ROSE',pal:{...tri('#9fdcff'),d:'#5e93b5'},note:'= 5 Hoa Tứ Diệp (hoa kim cương).'});
add({g:1,vi:'Thần Mộc',en:'Eldertree',tier:5,tpl:'TREE',pal:{g:'#53c28b',h:'#2e7d5b',l:'#a6f5c8',y:'#ffe066',c:'#fff7c2'},note:'= 5 Hoa Pha Lê. Vật phẩm tối thượng.',glow:1});
// Group 2
const seedCol={1:'#b8743f',2:'#b9c3cf',3:'#e8b43a',4:'#35b48f',5:'#9a74ea'};
for(const t of [1,2,3,4,5]){
  add({g:2,vi:'Túi Hạt '+TIER[t].vi,en:TIER[t].en+' Pouch',tier:t,tpl:'POUCH',pal:{...tri(seedCol[t]),e:hsl(...(()=>{const [h,s,l]=hexToHsl(seedCol[t]);return [h,s,l-30]})()),y:'#fff3c4',d:'#6b4a2e'},note:'Mở ra nhận 10 '+'Hạt '+TIER[t].vi+'.',glow:t===5});
}
add({g:2,vi:'Túi Hạt Cầu Vồng',en:'Prismatic Pouch',tier:'vip',tpl:'POUCH',pal:{a:RB,b:RBD,c:RBL,e:'#2a1d14',y:'#ffffff',d:'#ffd76b'},note:'Mở ra nhận 10 Hạt Cầu Vồng. Art yêu cầu nhiều chi tiết, sặc sỡ.'});
for(const t of [1,2,3,4,5]) add({g:2,vi:'Hạt '+TIER[t].vi,en:TIER[t].en+' Seed',tier:t,tpl:'SEED',pal:tri(seedCol[t]),note:'Trồng ra nông sản bậc '+ROMAN[t]+'.',glow:t===5});
add({g:2,vi:'Hạt Cầu Vồng',en:'Prismatic Seed',tier:'vip',tpl:'SEED',pal:{a:RB,b:RBD,c:RBL,w:'#ffffff'},note:'Trồng ra Đào Tiên Cầu Vồng.'});
// Group 3
add({g:3,vi:'Củ Cải Sương',en:'Frostroot',tier:1,tpl:'RADISH',pal:{a:'#dcefff',b:'#93bfe0',c:'#ffffff',w:'#ffffff'},note:'Thu hoạch từ Hạt Đồng.'});
add({g:3,vi:'Bí Ngô Ánh Trăng',en:'Moonlit Gourd',tier:2,tpl:'GOURD',pal:{...tri('#b4a3e6'),w:'#efe9ff'},note:'Thu hoạch từ Hạt Bạc.'});
add({g:3,vi:'Dâu Lửa',en:'Emberberry',tier:3,tpl:'BERRY',pal:{...tri('#ff5a3c'),y:'#ffd84a',w:'#ffd2c2'},note:'Thu hoạch từ Hạt Vàng.'});
add({g:3,vi:'Nho Lục Bảo',en:'Jadevine Grape',tier:4,tpl:'GRAPE',pal:tri('#3fc59a'),note:'Thu hoạch từ Hạt Ngọc.'});
add({g:3,vi:'Táo Hoàng Kim',en:'Sunforged Apple',tier:5,tpl:'APPLE',pal:{...tri('#f5c542'),w:'#fffbe0'},note:'Thu hoạch từ Hạt Tinh Thể.',glow:1});
add({g:3,vi:'Đào Tiên Cầu Vồng',en:'Celestial Peach',tier:'vip',tpl:'PEACH',pal:{...tri('#ffb3a1'),r:RB,g:'#e8c04a',h:'#a8862a',l:'#fff0a0',w:'#ffffff'},note:'Thu hoạch từ Hạt Cầu Vồng.'});
// Group 4
for(const t of [1,2,3]) add({g:4,vi:'Phân Bón Tinh Linh ('+SZ[t][0]+')',en:SZ[t][1]+' Spiritmulch',tier:t,size:t,tpl:'SACK',pal:{...tri('#9a7650'),e:'#3f7a32',y:'#9ee77f',d:'#5a3d25'},note:'Phân bón, tiêu hao.'});
for(const t of [1,2,3]) add({g:4,vi:'Thuốc Tăng Trưởng ('+SZ[t][0]+')',en:SZ[t][1]+' Bloomrush Tonic',tier:t,size:t,tpl:['VIAL_S','FLASK_M','FLASK_L'][t-1],pal:{...tri('#7ee06a'),y:'#f0c04a'},note:'Tiêu hao.'});
add({g:4,vi:'Thuốc Diệt Châu Chấu',en:'Locustbane',tier:2,tpl:'SPRAY',pal:{...tri('#cfe05a'),k:'#3b3b48',d:'#dff3ff',y:'#ffffff',e:'#c0392b'},note:'Chống châu chấu, tiêu hao.'});
add({g:4,vi:'Bù Nhìn Rơm',en:'Strawwarden',tier:2,tpl:'SCARE',pal:{a:'#e9cf9a',c:'#fff0c8',y:'#f2d16b',d:'#4f7fc9',e:'#d65a4a',t:'#6b4a2e',s:'#8a6440',k:'#2a1d14'},note:'Chống chim, tiêu hao.'});
add({g:4,vi:'Khối Đất',en:'Loamstone',tier:1,tpl:'SOIL',pal:{a:'#9b6b43',c:'#b8865a',b:'#6e4a2d',e:'#55371f',t:'#3e2716',y:'#d8c3a0'},note:'Có giới hạn số lượng. Lắp đặt, trang trí tự do.'});
add({g:4,vi:'Chứng Thư Mở Đất',en:'Wildland Charter',tier:4,tpl:'SCROLL',pal:{a:'#f1e2b8',c:'#fff6dc',b:'#c9b07a',k:'#8a6f4c',d:'#c0392b',y:'#ff8a7a',s:'#a07850',t:'#6b4f30'},note:'Mở rộng vườn (10 → 50 ô).'});
add({g:4,vi:'Hàng Rào Gai Mộc',en:'Thornwood Fence',tier:1,tpl:'FENCE',pal:{...tri('#a8754a'),d:'#6b4426'},note:'Đồ trang trí vườn.'});
add({g:4,vi:'Lối Đi Đá Rêu',en:'Mossstone Path',tier:1,tpl:'PATH',pal:tri('#9aa3a8'),note:'Đồ trang trí vườn.'});
add({g:4,vi:'Đèn Lồng Đom Đóm',en:'Firefly Lantern',tier:2,tpl:'LANTERN',pal:{y:'#ffd45e',d:'#f08c2e',w:'#fffbe6',t:'#6b4a2e',k:'#3a2b20',l:'#d6ff7a'},note:'Đồ trang trí vườn.'});
// Group 5
add({g:5,vi:'Bánh Quy Thú Cưng',en:'Snugglebite',tier:1,tpl:'BISCUIT',pal:{...tri('#e3a75f'),d:'#9a5c33'},note:'Đồ ăn vặt, đổi trạng thái no đói.'});
add({g:5,vi:'Rong Biển Triều',en:'Tideweed',tier:2,tpl:'WEED',pal:{g:'#3fb8a8',h:'#23786f',l:'#8ff0de',d:'#5aa6e0',e:'#3a74b0'},note:'Thức ăn nguyên tố Nước.'});
add({g:5,vi:'Ớt Than Hồng',en:'Cinderpepper',tier:2,tpl:'CHILI',pal:{...tri('#ff4b2b'),y:'#ffc93a'},note:'Thức ăn nguyên tố Lửa.'});
add({g:5,vi:'Lá Non Sớm Mai',en:'Dawnsprout',tier:2,tpl:'SPROUT',pal:{w:'#bfeaff'},note:'Thức ăn nguyên tố Lá.'});
for(const t of [1,2,3]) add({g:5,vi:'Thuốc Bổ Sinh Lực ('+SZ[t][0]+')',en:SZ[t][1]+' Vigor Draught',tier:t,size:t,tpl:['VIAL_S','FLASK_M','FLASK_L'][t-1],pal:{...tri('#ff9f3a'),y:'#f0c04a'},note:'Tăng máu cho pet.'});
add({g:5,vi:'Trà Tĩnh Tâm',en:'Stillmind Tea',tier:3,tpl:'TEA',pal:{a:'#f5f0e6',b:'#c9bfa8',c:'#ffffff',d:'#8fbf5a',g:'#5f9a3a',w:'#e6eef5'},note:'Giảm hồi chiêu cho pet.'});
add({g:5,vi:'Cháo Hồi Sức',en:'Second Dawn Stew',tier:3,tpl:'STEW',pal:{a:'#e9e2d0',b:'#b8ab8c',c:'#ffffff',d:'#f0a04b',y:'#ffe08a',e:'#7a5a3a',w:'#e6eef5'},note:'Cứu pet khỏi trạng thái Sắp chết đói.'});
const evo=[['Nước','Lệ Đại Dương','Tidal Tear','TEAR','#4fa8ff',{}],['Lửa','Tim Hỏa Long','Emberheart','HEART','#ff5a3c',{d:'#ff9a2e',y:'#ffe066'}],['Lá','Lõi Cổ Thụ','Grovecore','CORE','#5fd36a',{y:'#eaff8a'}]];
for(const [el,vi,en,tpl,c,x] of evo){
  add({g:5,vi:vi,en:en,tier:4,tpl,pal:{...tri(c),...x},note:'Đá Tiến Hóa hệ '+el+', giai đoạn 2.'});
  add({g:5,vi:vi+' Thức Tỉnh',en:'Ascended '+en,tier:5,tpl,pal:{...tri(c),...x},aura:1,glow:1,note:'Đá Tiến Hóa hệ '+el+', giai đoạn 3.'});
}
// Group 6
for(const t of [1,2,3]) add({g:6,vi:'Bình Máu Đỏ ('+SZ[t][0]+')',en:SZ[t][1]+' Crimson Vial',tier:t,size:t,tpl:['VIAL_S','FLASK_M','FLASK_L'][t-1],pal:{...tri('#e0344a'),y:'#f0c04a'},note:'Hồi máu.'});
for(const t of [1,2,3]) add({g:6,vi:'Bình Mana Xanh ('+SZ[t][0]+')',en:SZ[t][1]+' Azure Vial',tier:t,size:t,tpl:['VIAL_S','FLASK_M','FLASK_L'][t-1],pal:{...tri('#3a7bff'),y:'#f0c04a'},note:'Hồi mana.'});
add({g:6,vi:'Cát Thời Gian',en:'Chronosand',tier:3,tpl:'GLASS',pal:{...tri('#f0c04a'),t:'#6b4a2e',s:'#a07850'},note:'Hồi chiêu.'});
add({g:6,vi:'Thuốc Cuồng Nộ',en:'Berserker Brew',tier:3,tpl:'MUG',pal:{a:'#8a5a36',s:'#6b4428',t:'#4a2e1a',y:'#c9ccd2',w:'#ff7a68',c:'#ffc2b8'},note:'Tăng sức mạnh.'});
add({g:6,vi:'Khiên Tập Trung',en:'Focus Aegis',tier:2,tpl:'SHIELD',pal:{...tri('#4f6fb0'),y:'#e9c45a',w:'#bfe9ff',k:'#1b2a4a'},note:'Giảm sát thương nhận vào.'});
add({g:6,vi:'Đồng Hồ Chậm',en:'Slowtide Clock',tier:3,tpl:'CLOCK',pal:{c:'#6fb6e8',b:'#3a6f9c',w:'#eaf6ff',y:'#f0c04a',k:'#1b2a4a'},note:'Làm chậm quái.'});
add({g:6,vi:'Bom Ánh Sáng',en:'Dawnburst',tier:4,tpl:'BOMB',pal:{a:'#fff1b8',b:'#e2b94e',c:'#ffffff',y:'#ffd84a',d:'#ff8a3a'},note:'Đánh nhiều quái cùng lúc.'});
add({g:6,vi:'Mảnh Bóng Tối',en:'Gloom Shard',tier:1,tpl:'SHARD',pal:{a:'#5b3f8c',b:'#35225a',c:'#8a6cc4',d:'#1e1233'},note:'Rơi ra từ quái Trì hoãn, Lười biếng, Sợ bắt đầu. Công dụng chưa chốt.'});
// Group 7
const chests=[['A1','Rương Khởi Đầu','Seedling Chest',1],['A2','Rương Tập Sự','Apprentice Chest',2],['B1','Rương Lữ Khách','Wayfarer Chest',3],['B2','Rương Hiệp Sĩ',"Knight's Coffer",4],['C1','Rương Hiền Giả',"Sage's Coffer",5],['C2','Rương Huyền Thoại','Mythic Hoard','vip']];
for(const [lv,vi,en,t] of chests) add({g:7,vi:vi+' · '+lv,en:en,tier:t,tpl:'CHEST',pal:{a:'#8a5a36',b:'#5e3b22',c:'#a9744a',k:'#2a1d14',y:t==='vip'?RB:TIER[t].c},note:'Phần thưởng chiến đấu cấp CEFR '+lv+'.',glow:t===5});
// Default tools
add({g:0,vi:'Liềm Trăng Khuyết',en:'Crescent Reaper',tier:null,tpl:'SICKLE',pal:{a:'#d8dee6',b:'#8f9aa6',c:'#ffffff'},note:'Thu hoạch. Dùng vô hạn.'});
add({g:0,vi:'Bình Tưới',en:'Rainkeeper',tier:null,tpl:'CAN',pal:{...tri('#5aa6c9'),d:'#bfeaff',y:'#f0c04a'},note:'Nước vô hạn.'});
add({g:0,vi:'Xẻng Đào Rễ',en:'Rootdigger',tier:null,tpl:'SPADE',pal:{a:'#b8c2cc',b:'#7d8894',c:'#e8eef3'},note:'Nhổ cây, dọn ô, di chuyển khối đất. (Cần xác nhận nhóm.)'});

const N=20;
function prep(item){
  let rows=T[item.tpl].map(r=>(r+'................').slice(0,16));
  let minx=16,maxx=-1,miny=16,maxy=-1;
  rows.forEach((r,y)=>[...r].forEach((ch,x)=>{if(ch!=='.'){minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y)}}));
  const w=maxx-minx+1,h=maxy-miny+1,ox=Math.floor((N-w)/2)-minx,oy=Math.floor((N-h)/2)-miny;
  const grid=Array.from({length:N},()=>Array(N).fill('.'));
  rows.forEach((r,y)=>[...r].forEach((ch,x)=>{if(ch!=='.'){const X=x+ox,Y=y+oy;if(X>=0&&X<N&&Y>=0&&Y<N)grid[Y][X]=ch}}));
  const out=grid.map(r=>r.slice());
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    if(grid[y][x]!=='.')continue;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const c=grid[y+dy]?.[x+dx];if(c&&c!=='.'&&c!=='x'){out[y][x]='#';break}}
  }
  item._grid=out; item._rb=Object.values(item.pal).some(v=>v===RB||v===RBD||v===RBL);
}
function color(item,ch,x,y,t){
  if(ch==='#')return OUTLINE;
  const v=item.pal[ch]??DEF[ch]; if(!v) return '#ff00ff';
  if(v===RB||v===RBD||v===RBL){const hue=((x+y)*22+t*12)%360;return hsl(hue,88,v===RB?62:v===RBD?46:78)}
  return v;
}

return { T, I, G, TIER, ROMAN, seedCol, prep, color, N };
})();
