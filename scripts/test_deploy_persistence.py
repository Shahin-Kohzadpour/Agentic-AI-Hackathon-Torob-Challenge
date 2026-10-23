"""Preserve a private browser session across a real deployment or restart."""
import argparse,json,os,time
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['prepare','verify']);args=parser.parse_args()
base=os.environ.get('TEST_BASE_URL','https://kavoshgaran.liara.run');ip=os.environ.get('TEST_ORIGIN_IP')
state=Path(os.environ['TOROB_PERSISTENCE_STATE']);checkpoint=state.with_suffix('.checkpoint.json')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--host-resolver-rules=MAP '+base.split('/')[2]+' '+ip] if ip else [])
 context=browser.new_context(storage_state=str(state) if args.mode=='verify' else None)
 page=context.new_page();page.goto(base,wait_until='networkidle')
 expected=os.environ.get('EXPECTED_RELEASE')
 if expected:
  stable=0
  for _ in range(30):
   health=page.evaluate("async()=>{try{return await (await fetch('/api/health')).json()}catch{return null}}")
   stable=stable+1 if health and health.get('release')==expected else 0
   if stable>=3:break
   page.wait_for_timeout(2000)
  assert stable>=3,{'expected_release':expected,'actual':health}
 def api(body=None):
  result=page.evaluate('''async body=>{const r=await fetch('/api/workflow',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});return {status:r.status,data:await r.json()}}''',body)
  assert result['status']==200,result
  return result['data']
 current=api()
 if args.mode=='prepare':
  def act(action,**fields):return api({'action':action,'version':current['session']['version'],**fields})
  current=act('chat',message='Anker Soundcore R50i A3949 با ترب پی بودجه ۴٫۲ میلیون تومان')
  current=act('select_product',productId=current['session']['products'][0]['product_id'])
  current=act('scenario',scenario='AVAILABLE')
  current=act('check',offerId=current['offers'][-1]['offer_id'])
  time.sleep(2.2);current=api()
  current=act('visit',checkId=current['activeCheck']['id'])
  assert current['visit']
  state.parent.mkdir(parents=True,exist_ok=True);context.storage_state(path=str(state))
  checkpoint.write_text(json.dumps(current),encoding='utf-8')
  print(json.dumps({'prepared':True,'stage':current['session']['stage'],'event_count':len(current['session']['events'])}))
 else:
  previous=json.loads(checkpoint.read_text(encoding='utf-8'))
  checks={'same_session':current['session']['id']==previous['session']['id'],
   'same_preferences':current['session']['preferences']==previous['session']['preferences'],
   'same_visit_check':bool(current['visit']) and current['visit']['check']['id']==previous['visit']['check']['id'],
   'same_offer':bool(current['visit']) and current['visit']['offer']['offer_id']==previous['visit']['offer']['offer_id'],
   'same_events':current['session']['events']==previous['session']['events']}
  assert all(checks.values()),checks
  health=page.evaluate("async()=> (await fetch('/api/health')).json()")
  assert not expected or health.get('release')==expected,health
  report={'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'url':base,'forced_origin_ip':ip,'phase':os.environ.get('DEPLOY_TEST_PHASE','verify'),'checks':checks,'health':health}
  out=Path(__file__).resolve().parent.parent/'test-results';out.mkdir(exist_ok=True)
  (out/'deployment-persistence.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
  print(json.dumps(report,indent=2))
 browser.close()
