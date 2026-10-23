"""Location onboarding against real app APIs; geolocation is an explicit browser fixture."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os,re,sys,time
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parent.parent
out=root/'test-results/location';out.mkdir(parents=True,exist_ok=True)
base=os.environ.get('TEST_BASE_URL','http://127.0.0.1:3108')
ip=os.environ.get('TEST_ORIGIN_IP')
report={'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'url':base,'geolocation':'controlled browser positions and permission failures; not a physical GPS test'}
def state(page):return page.evaluate("async()=>(await fetch('/api/workflow')).json()")
def overflow(page):return page.evaluate('document.documentElement.scrollWidth<=innerWidth')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--host-resolver-rules=MAP '+base.split('/')[2]+' '+ip] if ip else [])
 contexts=[];errors=[]
 def fresh(script=None,**options):
  context=browser.new_context(**{**p.devices['iPhone 13'],'viewport':{'width':390,'height':844},**options});contexts.append(context)
  if script:context.add_init_script(script)
  page=context.new_page();page.set_default_navigation_timeout(90000);page.on('pageerror',lambda e:errors.append({'error':str(e),'stack':e.stack}))
  page.goto(base,wait_until='networkidle');page.locator('.location-choices').wait_for()
  return context,page
 gps_count="""window.gpsRequests=0;const get=navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);navigator.geolocation.getCurrentPosition=(...args)=>{window.gpsRequests++;return get(...args)};"""
 context,page=fresh(gps_count,permissions=['geolocation'],geolocation={'latitude':35.7575,'longitude':51.4099})
 assert page.evaluate('window.gpsRequests')==0
 for width,height in [(320,700),(360,780),(390,844),(430,932),(844,390)]:
  page.set_viewport_size({'width':width,'height':height});assert overflow(page)
  assert page.locator('.location-choice').evaluate_all('(items)=>items.every(e=>e.getBoundingClientRect().height>=44)')
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/'01-choice.png'))
 page.get_by_role('button',name='استفاده از موقعیت فعلی',exact=False).click();page.locator('.preferences').wait_for()
 saved=state(page)['session']['preferences'];assert saved['locationConfirmed'] and saved['location']['lat']==35.7575
 assert page.evaluate('window.gpsRequests')==1
 page.reload(wait_until='networkidle');page.locator('.preferences').wait_for();assert not page.locator('.location-choices').count()
 report['gps_explicit_choice_and_persistence']=True
 page.get_by_role('button',name='تغییر موقعیت',exact=True).click();page.get_by_role('button',name='خودم روی نقشه انتخاب می‌کنم',exact=False).click()
 page.locator('.location-map.leaflet-container').wait_for()
 page.wait_for_function("Array.from(document.querySelectorAll('img.leaflet-tile')).some(img=>img.complete&&img.naturalWidth>0)")
 report['map_tiles_loaded']=True
 page.locator('.location-map').click(position={'x':65,'y':135});page.wait_for_timeout(400)
 page.screenshot(path=str(out/'02-manual-map.png'))
 page.get_by_role('button',name='تأیید موقعیت و ادامه',exact=False).click();page.locator('.preferences').wait_for()
 updated=state(page)['session']['preferences'];assert updated['location']['lat']!=saved['location']['lat']
 assert updated['location']['label']=='موقعیت انتخابی روی نقشه' and page.evaluate('window.gpsRequests')==0
 report['manual_selection_replaces_origin_without_gps']=True
 denial="navigator.geolocation.getCurrentPosition=(ok,fail)=>fail({code:1});"
 _,denied=fresh(denial);denied.get_by_role('button',name='استفاده از موقعیت فعلی',exact=False).click()
 denied.get_by_role('alert').filter(has_text='دسترسی به موقعیت داده نشد').wait_for()
 denied.get_by_role('button',name='خودم روی نقشه انتخاب می‌کنم',exact=False).click();denied.locator('.location-map.leaflet-container').wait_for()
 for width,height in [(320,700),(390,480),(844,390)]:
  denied.set_viewport_size({'width':width,'height':height});assert overflow(denied)
 denied.get_by_role('button',name='تأیید موقعیت و ادامه',exact=False).click();denied.locator('.preferences').wait_for()
 assert state(denied)['session']['preferences']['locationConfirmed'];report['denied_gps_manual_recovery']=True
 late="navigator.geolocation.getCurrentPosition=(ok)=>setTimeout(()=>ok({coords:{latitude:35.7575,longitude:51.4099}}),600);"
 _,racing=fresh(late);racing.get_by_role('button',name='استفاده از موقعیت فعلی',exact=False).click()
 racing.get_by_role('button',name='خودم روی نقشه انتخاب می‌کنم',exact=False).click();racing.wait_for_timeout(800)
 assert racing.locator('.location-map-frame').is_visible() and not state(racing)['session']['preferences']['locationConfirmed']
 report['late_gps_cannot_override_manual_choice']=True
 _,outside=fresh(permissions=['geolocation'],geolocation={'latitude':32.65,'longitude':51.67})
 outside.get_by_role('button',name='استفاده از موقعیت فعلی',exact=False).click();outside.get_by_role('alert').filter(has_text='تهران').wait_for()
 assert not state(outside)['session']['preferences']['locationConfirmed'];report['outside_tehran_is_rejected']=True
 _,legacy=fresh();legacy.evaluate("async()=>{const d=await(await fetch('/api/workflow')).json();await fetch('/api/workflow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'chat',version:d.session.version,message:'Anker R50i A3949'})})}")
 legacy.reload(wait_until='networkidle')
 legacy.get_by_role('button',name='خودم روی نقشه انتخاب می‌کنم',exact=False).click();legacy.get_by_role('button',name='تأیید موقعیت و ادامه',exact=False).click();legacy.locator('.product-card').first.wait_for()
 if legacy.get_by_role('button',name='نمایش مکالمه',exact=True).count():legacy.get_by_role('button',name='نمایش مکالمه',exact=True).click()
 assert not re.search('شبیه|دیتاست|مستعار|کاتالوگ',legacy.locator('body').inner_text())
 report['customer_copy_on_loaded_conversation']=True
 report['page_errors']=errors;assert not errors, errors
 report['health']=page.evaluate("async()=>(await fetch('/api/health')).json()")
 browser.close()
(out/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
