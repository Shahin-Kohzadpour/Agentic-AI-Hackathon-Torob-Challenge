"""Real browser and app APIs: urgent purchase, linked map/cards, context and constraints."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os,json,time,sys
sys.stdout.reconfigure(encoding='utf-8')
base=os.getenv('TEST_BASE_URL','http://127.0.0.1:3110');ip=os.getenv('TEST_ORIGIN_IP')
out=Path(__file__).resolve().parent.parent/'test-results/journey';out.mkdir(parents=True,exist_ok=True)
report={'url':base,'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'device':'touch Chromium, controlled Tehran GPS; not physical Safari'}
def state(page):return page.evaluate("async()=>(await fetch('/api/workflow')).json()")
def ready(page):
 page.locator('.decision-summary').wait_for(timeout=120000)
 page.wait_for_function("!Array.from(document.querySelectorAll('.journey-controls button')).some(b=>b.disabled)")
 version=state(page)['session']['version']
 page.wait_for_function('(v)=>document.querySelector(\".journey-decision\")?.dataset.version===String(v)',arg=version,timeout=120000)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--host-resolver-rules=MAP '+base.split('/')[2]+' '+ip] if ip else [])
 context=b.new_context(**{**p.devices['iPhone 13'],'viewport':{'width':390,'height':844}},permissions=['geolocation'],geolocation={'latitude':35.7008,'longitude':51.4056})
 page=context.new_page();page.set_default_timeout(60000);page.set_default_navigation_timeout(120000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base,wait_until='networkidle');page.get_by_role('button',name='استفاده از موقعیت فعلی',exact=False).click()
 page.locator('.minimal-welcome').wait_for();page.screenshot(path=str(out/'01-minimal-home.png'))
 prompt='ساعت ۱۱:۳۰ شب است. همین امشب شارژر USB-C برای گوشی سامسونگ می‌خواهم. پیاده می‌روم و ترجیح می‌دهم بیشتر از ۲ کیلومتر راه نروم.'
 page.get_by_label('نیاز یا مدل مورد نظر',exact=True).fill(prompt);page.get_by_role('button',name='ارسال پیام',exact=True).click();ready(page)
 page.locator('.decision-map.leaflet-container').wait_for();page.wait_for_function("Array.from(document.querySelectorAll('img.leaflet-tile')).some(i=>i.complete&&i.naturalWidth>0)");page.locator('.decision-cards .decision-card').first.wait_for()
 first=state(page);assert first['session']['preferences']['travelMode']=='walking';assert first['session']['preferences']['radiusMode']=='preferred';assert first['hubs']
 assert page.locator('.shop-pin').count() and page.locator('.hub-pin').count()
 assert not any(w in page.locator('body').inner_text() for w in ['دیتاست','شبیه‌سازی','مستعار'])
 page.locator('.journey-decision').scroll_into_view_if_needed();page.screenshot(path=str(out/'02-night-decision.png'))
 page.get_by_role('button',name='انتخاب این مدل',exact=True).first.click();ready(page)
 selected=state(page)['session']['selectedProductId'];assert selected
 page.get_by_role('button',name='با ماشین',exact=True).click();ready(page)
 changed=state(page);assert changed['session']['preferences']['travelMode']=='driving';assert changed['session']['selectedProductId']==selected
 report['mode_preserves_product']=True
 page.locator('.area-card .decision-card-title').first.click();assert page.locator('.hub-pin.active').count()==1
 page.locator('.shop-pin').first.click();assert page.locator('.decision-cards .decision-card.selected').count()==1
 report['map_card_selection_both_directions']=True
 page.get_by_label('نیاز یا مدل مورد نظر',exact=True).fill('اگر تا رسیدنم بسته شود چه؟');page.get_by_role('button',name='ارسال پیام',exact=True).click();ready(page)
 follow=state(page);assert follow['session']['selectedProductId']==selected and follow['session']['query']==changed['session']['query'];report['chat_followup_preserves_context']=True
 page.get_by_label('ویرایش شرایط خرید',exact=True).click();page.get_by_label('سقف بودجه',exact=False).fill('1000')
 page.get_by_label('ترب‌پی حضوری الزامی است',exact=True).check();page.get_by_role('button',name='اعمال شرایط',exact=True).click();ready(page)
 assert page.locator('.decision-cards .decision-card').count()==0
 limited=state(page);assert limited['session']['preferences']['payment']=='torobpay' and limited['session']['preferences']['budget']==1000
 assert page.locator('.area-card').count();report['budget_and_payment_never_relaxed']=True
 sizes=[]
 for width,height in [(320,700),(360,780),(390,844),(430,932),(390,480)]:
  page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(150)
  size=page.evaluate('({width:innerWidth,document:document.documentElement.scrollWidth,height:innerHeight})');assert size['document']<=width,size;sizes.append(size)
  field=page.locator('#shopping-message');assert float(field.evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)'))>=16
  box=field.bounding_box();assert box['y']+box['height']<=height+1,box
 report['viewports']=sizes
 for selector in ['.send-button','.composer-tools .icon-button','.journey-controls button']:
  boxes=page.locator(selector).evaluate_all('(items)=>items.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))')
  assert all(x['width']>=44 and x['height']>=44 for x in boxes),boxes
 report['touch_targets_44px']=True;report['page_errors']=errors;assert not errors,errors
 page.set_viewport_size({'width':390,'height':844});page.locator('.journey-decision').scroll_into_view_if_needed();page.screenshot(path=str(out/'03-preserved-constraints.png'))
 report['health']=page.evaluate("async()=>(await fetch('/api/health')).json()")
 b.close()
(out/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False,indent=2))
