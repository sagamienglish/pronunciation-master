let model;
self.postMessage({type:'boot'});
self.phonemeLabProgress=message=>self.postMessage({type:'progress',message});
self.onmessage=async({data})=>{try{
 if(data.type==='prepare'){self.phonemeLabProgress('2/3 計算エンジンを読み込んでいます…');const {ASRBrowserModel}=await import('./vendor/hama-1.7.0/browser.js?v=2');model??=await ASRBrowserModel.create();self.postMessage({type:'ready'});}
 if(data.type==='analyze'){if(!model)throw Error('音素モデルを準備してください。');let energy=0;for(const sample of data.samples)energy+=sample*sample;if(!data.samples.length||Math.sqrt(energy/data.samples.length)<.002){self.postMessage({type:'result',phonemes:[],elapsedMs:0});return;}const start=performance.now(),result=await model.transcribeWaveform(data.samples,data.sampleRate);self.postMessage({type:'result',phonemes:result.phonemes,elapsedMs:Math.round(performance.now()-start)});}
}catch(error){self.postMessage({type:'error',message:error.message||'音素を認識できませんでした。'});}};
