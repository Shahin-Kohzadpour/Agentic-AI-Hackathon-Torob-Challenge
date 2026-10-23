"""Exercise the actual application API through Chromium; no intercepted chat responses."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os,sys,time
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parent.parent
out=root/'test-results';out.mkdir(exist_ok=True)
base=os.environ.get('TEST_BASE_URL','http://127.0.0.1:3107')
results={'base_url':base,'mode':'real application API; external services may degrade with explicit fallback'}
with sync_playwright() as p:
 origin_ip=os.environ.get('TEST_ORIGIN_IP')
 args=['--host-resolver-rules=MAP '+base.split('/')[2]+' '+origin_ip] if origin_ip else []
 results['forced_origin_ip']=origin_ip
 browser=p.chromium.launch(headless=True,args=args)
 context=browser.new_context(viewport={'width':1440,'height':1000})
 page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base+'/demo',wait_until='networkidle')
 page.get_by_role('button',name='اجرای نمونهٔ R50i',exact=True).wait_for()
 page.screenshot(path=str(out/'desktop-initial.png'),full_page=True)
 started=time.monotonic();page.get_by_role('button',name='اجرای نمونهٔ R50i',exact=True).click()
 page.get_by_role('button',name='انتخاب و دیدن فروشگاه‌ها',exact=True).first.wait_for(timeout=40000)
 results['initial_result_seconds']=round(time.monotonic()-started,2)
 page.get_by_role('button',name='جدول مقایسه',exact=True).click()
 assert page.locator('table').count()==1
 page.screenshot(path=str(out/'desktop-products.png'),full_page=True)
 page.get_by_role('button',name='انتخاب و دیدن فروشگاه‌ها',exact=True).first.click()
 page.get_by_role('button',name='بررسی قیمت و موجودی (شبیه‌سازی)',exact=True).first.wait_for()
 assert page.locator('.offer-card').count()==2
 page.get_by_role('button',name='بررسی قیمت و موجودی (شبیه‌سازی)',exact=True).first.click()
 page.get_by_role('heading',name='فروشنده پاسخ نداد',exact=True).wait_for(timeout=15000)
 assert 'آوان آران' in page.locator('.offer-card.recommended').inner_text()
 assert '۳٬۸۵۰٬۰۰۰' in page.locator('.offer-card.recommended').inner_text()
 page.screenshot(path=str(out/'desktop-recovery.png'),full_page=True)
 page.locator('.offer-card.recommended').get_by_role('button',name='بررسی قیمت و موجودی (شبیه‌سازی)',exact=True).click()
 page.get_by_role('button',name='ساخت کارت مراجعه با همین پاسخ',exact=True).wait_for(timeout=15000)
 page.get_by_role('button',name='ساخت کارت مراجعه با همین پاسخ',exact=True).click()
 page.locator('.visit-card').wait_for()
 card=page.locator('.visit-card').inner_text();assert '۳٬۸۵۰٬۰۰۰' in card and 'شبیه‌سازی' in card and 'رزرو نشده' in card
 assert 'قطعی تأیید شد' not in card
 page.reload(wait_until='networkidle');page.locator('.visit-card').wait_for()
 results['reload_preserves_visit']=True
 page.screenshot(path=str(out/'desktop-visit.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844})
 results['mobile_width']=page.evaluate('({viewport:innerWidth,document:document.documentElement.scrollWidth})')
 assert results['mobile_width']['document']<=390
 page.screenshot(path=str(out/'mobile-visit.png'),full_page=True)
 results['health_status']=page.evaluate("async()=> (await fetch('/api/health')).status")
 invalid=page.evaluate("async()=> (await fetch('/api/seller-check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({offerId:'offer_fake',shopName:'fake',priceToman:1})})).status")
 results['forged_legacy_api_status']=invalid;assert invalid>=400
 state=page.evaluate("async()=> (await fetch('/api/workflow')).json()")
 results['final_offer_id']=state['visit']['offer']['offer_id'];results['final_observed_price']=state['visit']['check']['observedPrice']
 assert results['final_offer_id']=='offer_3c1ad9b2b3081b07991d5872'
 context2=browser.new_context(viewport={'width':390,'height':844});page2=context2.new_page();page2.goto(base,wait_until='networkidle')
 state2=page2.evaluate("async()=> (await fetch('/api/workflow')).json()");assert state2['session']['id']!=state['session']['id'] and state2['visit'] is None
 results['session_isolation']=True
 page2.screenshot(path=str(out/'mobile-initial.png'),full_page=True)
 results['page_errors']=errors;assert not errors
 browser.close()
(out/'browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False,indent=2))
