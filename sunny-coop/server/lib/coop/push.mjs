const enc = new TextEncoder();
export const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const unb64 = s => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const join=(...v)=>{const out=new Uint8Array(v.reduce((n,b)=>n+b.length,0));let i=0;for(const b of v){out.set(b,i);i+=b.length}return out};
async function hmac(k,b){const key=await crypto.subtle.importKey('raw',k,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,b))}
export function validateSubscription(sub){
 if(!sub||typeof sub.endpoint!=='string'||sub.endpoint.length>2048)throw Error('訂閱格式不正確');
 const u=new URL(sub.endpoint),host=u.hostname;
 const allowed=host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host==='push.services.mozilla.com'||host==='web.push.apple.com'||(host.endsWith('.notify.windows.com')&&host!=='notify.windows.com');
 if(u.protocol!=='https:'||u.username||u.password||u.port||!allowed)throw Error('不支援的推播服務');
 if(typeof sub.keys?.p256dh!=='string'||typeof sub.keys?.auth!=='string')throw Error('缺少推播加密金鑰');
 const pub=unb64(sub.keys.p256dh),auth=unb64(sub.keys.auth);if(pub.length!==65||pub[0]!==4||auth.length!==16)throw Error('推播金鑰格式錯誤');
 return{endpoint:u.href,expirationTime:sub.expirationTime??null,keys:{p256dh:sub.keys.p256dh,auth:sub.keys.auth}};
}
export async function encryptPayload(subscription,payload){
 const sub=validateSubscription(subscription),ua=unb64(sub.keys.p256dh),auth=unb64(sub.keys.auth);
 const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const as=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
 const peer=await crypto.subtle.importKey('raw',ua,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const secret=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:peer},pair.privateKey,256));
 const prkKey=await hmac(auth,secret),ikm=await hmac(prkKey,join(enc.encode('WebPush: info\0'),ua,as,new Uint8Array([1])));
 const salt=crypto.getRandomValues(new Uint8Array(16)),prk=await hmac(salt,ikm);
 const cek=(await hmac(prk,enc.encode('Content-Encoding: aes128gcm\0\x01'))).slice(0,16);
 const nonce=(await hmac(prk,enc.encode('Content-Encoding: nonce\0\x01'))).slice(0,12);
 const plaintext=enc.encode(JSON.stringify(payload));if(plaintext.length>3900)throw Error('通知內容過長');
 const aes=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
 const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},aes,join(plaintext,new Uint8Array([2]))));
 return join(salt,new Uint8Array([0,0,16,0,65]),as,encrypted);
}
export async function vapidAuthorization(endpoint,env){
 const privateJwk=JSON.parse(env.VAPID_PRIVATE_JWK),pub=env.VAPID_PUBLIC_KEY;
 const head=b64(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
 const body=b64(enc.encode(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:env.VAPID_SUBJECT})));
 const key=await crypto.subtle.importKey('jwk',privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(head+'.'+body));
 return `vapid t=${head}.${body}.${b64(sig)}, k=${pub}`;
}
function stageError(stage,e){const name=/^[A-Za-z]+Error$/.test(e?.name||'')?e.name:'Error';const detail=String(e?.message||'').replace(/https?:\/\/[^\s\"']+/g,'[服務網址]').replace(/[A-Za-z0-9_=-]{40,}/g,'[省略]').slice(0,180);return new Error(stage+'（'+name+'）'+(detail?'：'+detail:''))}
export async function pushSelfCheck(env){
 try{const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);const pub=b64(await crypto.subtle.exportKey('raw',pair.publicKey));await encryptPayload({endpoint:'https://fcm.googleapis.com/fcm/send/self-check',keys:{p256dh:pub,auth:b64(crypto.getRandomValues(new Uint8Array(16)))}},{title:'self-check'});}catch(e){return{ok:false,error:stageError('推播內容加密失敗',e).message}}
 try{await vapidAuthorization('https://fcm.googleapis.com/fcm/send/self-check',env);}catch(e){return{ok:false,error:stageError('推播簽章失敗',e).message}}
 return{ok:true};
}
export async function sendPush(sub,payload,env,fetcher=fetch){
 const valid=validateSubscription(sub);let body,authorization;
 try{body=await encryptPayload(valid,payload)}catch(e){throw stageError('推播內容加密失敗',e)}
 try{authorization=await vapidAuthorization(valid.endpoint,env)}catch(e){throw stageError('推播簽章失敗',e)}
 let response;try{response=await fetcher(valid.endpoint,{method:'POST',headers:{Authorization:authorization,'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:'3600',Urgency:'high'},body,redirect:'manual',signal:AbortSignal.timeout(15000)})}catch(e){throw stageError('推播服務連線失敗',e)}
 return{accepted:response.status>=200&&response.status<300,expired:response.status===404||response.status===410,status:response.status};
}
