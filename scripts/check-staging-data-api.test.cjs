const {test}=require('node:test');
const assert=require('node:assert/strict');
const {main}=require('./check-staging-data-api.cjs');
const env={HWB_ISOLATED_SYNTHETIC_STAGING:'yes',HWB_STAGING_SUPABASE_URL:'https://synthetic.supabase.co',
 HWB_STAGING_PUBLISHABLE_KEY:'synthetic',HWB_STAGING_USER_JWT:'synthetic',
 HWB_STAGING_RELATIONS_JSON:JSON.stringify([{schema:'public',name:'hwb_db_stampings'}])};
test('reject production, malformed configuration and missing user before requests',async()=>{
 for(const overrides of [{HWB_STAGING_SUPABASE_URL:'https://vdqdopjinjyginervesk.supabase.co'},
 {HWB_ISOLATED_SYNTHETIC_STAGING:''},{HWB_STAGING_USER_JWT:''}]){
  await assert.rejects(main({...env,...overrides},()=>assert.fail('network must not run')));
 }
});
test('accept only explicit database permission denial for both client contexts',async()=>{
 const calls=[];
 await main(env,async(url,{headers})=>{
  calls.push({url,headers});
  assert.equal(url.searchParams.get('limit'),'0');
  return {status:headers.Authorization?403:401,json:async()=>({code:'42501'})};
 });
 assert.equal(calls.length,2);
 assert.equal(calls[0].headers.Authorization,undefined);
 assert.equal(calls[1].headers.Authorization,'Bearer synthetic');
});
test('empty 200, invalid JWT, missing relation or gateway error are inconclusive',async()=>{
 for(const [status,code] of [[200,undefined],[401,'PGRST301'],[404,'PGRST205'],[500,undefined]]){
  await assert.rejects(main(env,async()=>({status,json:async()=>({code})})));
 }
});
