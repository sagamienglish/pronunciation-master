// Adapted from hama-js 1.7.0: bounded cache access and visible download progress.
const assetUrl=asset=>new URL('./assets/'+asset,import.meta.url).toString();
const report=message=>globalThis.phonemeLabProgress?.(message);
function bounded(promise,ms){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('保存データの読み込みが終わりませんでした。')),ms);})]).finally(()=>clearTimeout(timer));}
async function assetBytes(url){
 const model=url.endsWith('.hama'),name=model?'音素モデル':'計算エンジン';let cache;
 report((model?'3/3 ':'2/3 ')+name+'の保存データを確認しています…');
 try{const saved=await bounded((async()=>{cache=await globalThis.caches?.open('pronunciation-phoneme-hama-1.7.0');const response=await cache?.match(url);return response?new Uint8Array(await response.arrayBuffer()):null;})(),1200);if(saved){report((model?'3/3 ':'2/3 ')+name+'を保存データから読み込みました。');return saved;}}catch{}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  report((model?'3/3 ':'2/3 ')+name+'を取得しています…');const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error(name+'を取得できませんでした ('+response.status+')');
  const saved=response.clone();let bytes;
  if(response.body?.getReader){const reader=response.body.getReader(),chunks=[];let received=0,last=0;const total=Number(response.headers.get('content-length'));
   for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.length;if(received-last>250000||received===total){last=received;report((model?'3/3 ':'2/3 ')+name+'を取得中 '+(received/1000000).toFixed(1)+'MB'+(total?' / '+(total/1000000).toFixed(1)+'MB':''));}}
   bytes=new Uint8Array(received);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  }else bytes=new Uint8Array(await response.arrayBuffer());
  // Cache writes must never delay model startup on browsers with stalled storage.
  try{cache?.put(url,saved).catch(()=>{});}catch{}
  report((model?'3/3 ':'2/3 ')+name+'を起動しています…');return bytes;
 }catch(error){if(error.name==='AbortError')throw Error(name+'の取得が30秒以内に終わりませんでした。通信環境を確認してください。');throw error;}finally{clearTimeout(timer);}
}
export const loadWasm=()=>assetBytes(assetUrl('hama.wasm'));
export const resolveModelBytes=(url,asset)=>assetBytes(url??assetUrl(asset));
