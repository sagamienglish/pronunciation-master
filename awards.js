const names=['チャレンジャー','ルーキー','エキスパート','マスター','レジェンド'];

export function certificateRank(type,score){
 const thresholds=type==='quick'?[4,7,10,13]:[50,70,90,100];
 const level=thresholds.filter(threshold=>score>=threshold).length;
 return {level,name:names[level]};
}
