// Experimental acoustic phoneme comparison, separate from word recognition.
export const phoneChecks={
 sunglasses:{label:'sunglasses',ja:'サングラス',phones:['s','ʌ','ŋ','ɡ','l','æ','s','ɪ','z'],hint:'「グ」の後に母音を足さず、/l æ/ と、語尾の /ɪ z/ を意識します。'},
 millimeter:{label:'millimeter',ja:'ミリメートル',phones:['m','ɪ','l','ə','m','i','t','ɝ'],hint:'最初の /ɪ/、弱い /ə/、語尾の /ɝ/ を意識します。米音を基準にしています。'}
};
export function comparePhones(expected,heard){
 const normalize=p=>p.replace(/g/g,'ɡ');const a=expected.map(normalize),b=heard.map(normalize),d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
 for(let i=0;i<=a.length;i++)d[i][0]=i;for(let j=0;j<=b.length;j++)d[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
 const alignment=[];let i=a.length,j=b.length;
 while(i||j){if(i&&j&&d[i][j]===d[i-1][j-1]+(a[i-1]===b[j-1]?0:1)){alignment.push({expected:expected[--i],heard:heard[--j],match:a[i]===b[j]});}else if(i&&d[i][j]===d[i-1][j]+1)alignment.push({expected:expected[--i],heard:'—',match:false});else alignment.push({expected:'—',heard:heard[--j],match:false});}
 return {similarity:a.length&&b.length?Math.max(0,Math.round(100*(1-d[a.length][b.length]/Math.max(a.length,b.length)))):0,alignment:alignment.reverse()};
}
