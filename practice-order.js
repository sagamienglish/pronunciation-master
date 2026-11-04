// Stable ordering: untouched entries first, then the BEST score shown on the card.
export function practiceOrder(words,progress,byScore=false){
 if(!byScore)return [...words];
 const rank=word=>progress.history[word.id]?.length?(progress.bestScores[word.id]??Math.max(...progress.history[word.id].map(x=>x.score))):-1;
 return words.map((word,index)=>({word,index,rank:rank(word)})).sort((a,b)=>a.rank-b.rank||a.index-b.index).map(x=>x.word);
}
