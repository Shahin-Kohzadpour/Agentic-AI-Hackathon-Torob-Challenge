import json,pathlib,sys
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
root=pathlib.Path.cwd(); fixtures=json.loads((root/'scratch/audit-ui-fixtures.json').read_text(encoding='utf-8'))
out={}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 page=browser.new_page(viewport={'width':390,'height':844})
 page.route('https://**/*',lambda r:r.abort())
 page.goto('http://127.0.0.1:3107',wait_until='networkidle')
 held=[]
 page.route('**/api/chat',lambda r:held.append(r))
 page.get_by_placeholder('چه محصولی مد نظرتان است؟...').fill('r50i')
 page.get_by_title('ارسال',exact=True).click()
 page.get_by_text('در حال بررسی...',exact=True).wait_for()
 page.get_by_title('شروع دوباره',exact=True).click()
 held[0].fulfill(json=fixtures['products'])
 page.get_by_role('button',name='جدول مشخصات',exact=True).wait_for()
 out['stale_response_after_reset']=True
 page.reload(wait_until='networkidle')
 page.unroute('**/api/chat')
 page.route('**/api/chat',lambda r:r.fulfill(json=fixtures['stores']))
 page.get_by_placeholder('چه محصولی مد نظرتان است؟...').fill('r50i')
 page.get_by_title('ارسال',exact=True).click()
 page.get_by_role('button',name='نقشه',exact=True).click()
 page.locator('.leaflet-marker-icon').first.wait_for(timeout=15000)
 out['map_markers_without_tiles']=page.locator('.leaflet-marker-icon').count()
 out['list_available_without_tiles']=page.get_by_role('button',name='استعلام موجودی',exact=True).count()
 page.request.post('http://127.0.0.1:3107/api/seller-check',data={'action':'override_scenario','scenario':'FORCE_PRICE_CHANGE'})
 page.get_by_role('button',name='استعلام موجودی',exact=True).last.click()
 page.get_by_text('پاسخ شبیه‌سازی‌شده: فروشنده تغییر قیمت به ۴٬۲۳۵٬۰۰۰ تومان را اعلام کرد.',exact=True).wait_for()
 out['price_changed_shown_as_pending']=page.get_by_text('در حال استعلام...',exact=True).count()>0
 out['price_changed_has_recovery_action']=page.get_by_role('button',name='مشاهده کارت نهایی مراجعه حضوری',exact=True).count()>0 or page.get_by_role('button',name='استعلام از آوان آران (شیخ هادی)',exact=True).count()>0
 page.request.post('http://127.0.0.1:3107/api/seller-check',data={'action':'override_scenario','scenario':'AUTO'})
 browser.close()
(root/'scratch/audit-browser-edges.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2))
