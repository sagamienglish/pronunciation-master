export const words = [
['nearly','ほとんど','副詞',1],['kilogram','キログラム','名詞',1],['tragedy','悲劇','名詞',1],['occur','起こる','動詞',1],['victim','犠牲者','名詞',1],['mistake','…を間違える','動詞',1],['in fact','実際には','表現',1],['green sea turtle','アオウミガメ','名詞',1],['mistake ... for ～','…を～と間違える','表現',1,'mistake for'],
['debris','破片、残骸','名詞',2],['decompose','分解する','動詞',2],['worse','より悪い','形容詞',2],['microplastic','マイクロプラスチック','名詞',2],['millimeter','ミリメートル','名詞',2],['consume','…を消費する、摂取する','動詞',2],['end up in ...','（場所など）に最終的に至る','表現',2,'end up in'],['in terms of ...','…に関しては','表現',2,'in terms of'],['to make matters worse','その上悪いことに','表現',2],['break down into ...','…に分解される','表現',2,'break down into'],['in turn','今度は','表現',2],
['non-profit organization','非営利団体','名詞',3],['found','…を設立する、創設する','動詞',3],['Dutch','オランダ人の','形容詞',3],['aim (to do)','…（すること）を目指す','動詞',3,'aim to do'],['remove','…を取り除く','動詞',3],['floating','浮いている','形容詞',3],['sunglasses','サングラス','名詞',3],['reduce','…を減少させる','動詞',3],['reuse','…を再利用する','動詞',3],['ourselves','私たち自身','代名詞',3],['so far','今までのところでは','表現',3],['without doing','…しないで','表現',3]
].map(([en,ja,pos,part,say],id)=>({id,en,ja,pos,part,say:say||en}));
export function normalize(s){return s.toLowerCase().replace(/[^a-z0-9]/g,'');}
export function scoreWord(target,heard){
 const a=normalize(target),b=normalize(heard); if(!a||!b)return 0;
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=row;}
 return Math.max(0,Math.round((1-prev[b.length]/Math.max(a.length,b.length))*100));
}
export function sample(items,count=10,rng=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a.slice(0,count);}
export function totalScore(results){return Math.round(results.reduce((n,r)=>n+(r?.score||0),0)/10);}
