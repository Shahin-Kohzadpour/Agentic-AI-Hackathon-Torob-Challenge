"""Primary acceptance: touch-enabled Chromium with phone viewports, real APIs."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os,sys,time
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parent.parent;out=root/'test-results/mobile';out.mkdir(parents=True,exist_ok=True)
base=os.environ.get('TEST_BASE_URL','http://127.0.0.1:3107');ip=os.environ.get('TEST_ORIGIN_IP')
report={'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'url':base,'forced_origin_ip':ip,'device':'iPhone 13 emulation, touch-enabled Chromium; not physical iOS Safari'}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--host-resolver-rules=MAP '+base.split('/')[2]+' '+ip] if ip else [])
 context=b.new_context(**p.devices['iPhone 13']);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base,wait_until='networkidle')
 page.get_by_role('button',name='خودم روی نقشه انتخاب می‌کنم',exact=False).click()
 page.get_by_role('button',name='تأیید موقعیت و ادامه',exact=False).click()
 page.locator('.preferences').wait_for()
 assert not page.locator('.preferences').evaluate('(e)=>e.open')
 assert page.get_by_role('button',name='کمکم کن انتخاب کنم',exact=False).is_visible()
 assert float(page.locator('#shopping-message').evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)'))>=16
 page.screenshot(path=str(out/'01-start.png'))
 started=time.monotonic();page.get_by_label('نیاز یا مدل مورد نظر',exact=True).fill('Anker Soundcore R50i A3949 با ترب‌پی و بودجه ۴٫۲ میلیون تومان')
 page.get_by_role('button',name='ارسال پیام',exact=True).click()
 page.get_by_role('button',name='انتخاب و دیدن فروشگاه‌ها',exact=True).first.wait_for(timeout=45000)
 report['initial_result_seconds']=round(time.monotonic()-started,2)
 assert page.locator('.mobile-latest-message').is_visible()
 page.screenshot(path=str(out/'02-product.png'))
 page.get_by_role('button',name='انتخاب و دیدن فروشگاه‌ها',exact=True).first.click()
 page.locator('.offer-card').first.wait_for();assert page.locator('.offer-card').count()==2
 page.get_by_role('button',name='بررسی شرایط خرید',exact=True).first.click()
 page.get_by_role('heading',name='تأیید فروشگاه در دسترس نیست',exact=True).wait_for(timeout=20000)
 assert '۳٬۸۵۰٬۰۰۰' in page.locator('.offer-card.recommended').inner_text()
 page.locator('.offer-card.recommended').scroll_into_view_if_needed();page.screenshot(path=str(out/'03-recovery.png'))
 page.locator('.offer-card.recommended').get_by_role('button',name='بررسی شرایط خرید',exact=True).click()
 page.get_by_role('button',name='ساخت برنامهٔ مراجعه',exact=True).wait_for(timeout=20000)
 page.get_by_role('button',name='ساخت برنامهٔ مراجعه',exact=True).click();page.locator('.visit-card').wait_for()
 page.reload(wait_until='networkidle');page.locator('.visit-card').wait_for()
 assert '۳٬۸۵۰٬۰۰۰' in page.locator('.visit-card').inner_text()
 assert 'رزرو کالا نیست' in page.locator('.visit-card').inner_text()
 page.locator('.visit-card').evaluate('(e)=>window.scrollTo(0,e.getBoundingClientRect().top+scrollY-150)');page.wait_for_timeout(500)
 page.screenshot(path=str(out/'04-visit.png'));report['reload_preserves_visit']=True
 page.get_by_label('ویرایش شرایط خرید',exact=True).click()
 page.get_by_label('سقف بودجه',exact=False).fill('1000000');page.get_by_role('button',name='اعمال شرایط',exact=True).click()
 page.locator('.empty-results').wait_for();assert not page.locator('.preferences').evaluate('(e)=>e.open')
 report['editing_preferences_recalculates']=True
 sizes=[]
 for width,height in [(320,700),(360,780),(390,844),(430,932),(390,480)]:
  page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(150)
  size=page.evaluate('({width:innerWidth,document:document.documentElement.scrollWidth,height:innerHeight})');assert size['document']<=size['width'],size;sizes.append(size)
  if height==480:
   page.locator('#shopping-message').focus();box=page.locator('#shopping-message').bounding_box();assert box['y']+box['height']<=height,box
 report['viewports']=sizes;report['short_viewport_input_accessible']=True
 for selector in ['.send-button','.composer-tools .icon-button']:
  boxes=page.locator(selector).evaluate_all('(items)=>items.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))')
  assert all(x['width']>=44 and x['height']>=44 for x in boxes),boxes
 report['composer_touch_targets_44px']=True
 other=b.new_context(**p.devices['iPhone 13']);tab=other.new_page();tab.goto(base,wait_until='networkidle')
 state=page.evaluate("async()=> (await fetch('/api/workflow')).json()");separate=tab.evaluate("async()=> (await fetch('/api/workflow')).json()")
 assert state['session']['id']!=separate['session']['id'] and separate['visit'] is None
 report['session_isolation']=True;report['page_errors']=errors;assert not errors
 report['health']=page.evaluate("async()=> (await fetch('/api/health')).json()")
 b.close()
(out/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False,indent=2))
