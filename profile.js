export function validSelection(value,max){const s=String(value??'');return /^\d+$/.test(s)&&Number(s)>=1&&Number(s)<=max?String(Number(s)):'';}
export function migrateProfile(p={}){
 const group=typeof p.group==='string'?p.group.slice(0,60):'';
 const classNo=validSelection(p.classNo||group.match(/(\d+)組/)?.[1],13);
 const number=validSelection(p.number||group.match(/(\d+)番/)?.[1],50);
 return {name:typeof p.name==='string'?p.name.slice(0,60):'',classNo,number,group:classNo&&number?`${classNo}組 ${number}番`:group};
}
export function profileSelections(classNo,number){const c=validSelection(classNo,13),n=validSelection(number,50);return {classNo:c,number:n,group:[c?`${c}組`:'',n?`${n}番`:''].filter(Boolean).join(' ')};}
