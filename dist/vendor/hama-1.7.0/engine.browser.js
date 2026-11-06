// Adapted from hama-js 1.7.0: cache immutable WASM and acoustic weights locally.
const assetUrl=asset=>new URL('./assets/'+asset,import.meta.url).toString();
async function assetBytes(url){
 let cache;try{cache=await globalThis.caches?.open('pronunciation-phoneme-hama-1.7.0');const saved=await cache?.match(url);if(saved)return new Uint8Array(await saved.arrayBuffer());}catch{}
 const response=await fetch(url);if(!response.ok)throw Error('音素モデルを取得できませんでした ('+response.status+')');
 try{await cache?.put(url,response.clone());}catch{}
 return new Uint8Array(await response.arrayBuffer());
}
export const loadWasm=()=>assetBytes(assetUrl('hama.wasm'));
export const resolveModelBytes=(url,asset)=>assetBytes(url??assetUrl(asset));
