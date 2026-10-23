"""Check deployed media and sourced no-result guidance through the real browser."""
import json,os,time
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent;out=root/'test-results';out.mkdir(exist_ok=True)
base=os.environ.get('TEST_BASE_URL','https://kavoshgaran.liara.run');ip=os.environ.get('TEST_ORIGIN_IP')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--host-resolver-rules=MAP '+base.split('/')[2]+' '+ip] if ip else [])
 context=browser.new_context(viewport={'width':1440,'height':1000});page=context.new_page();errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)));page.goto(base,wait_until='networkidle')
 image=page.evaluate("async()=>{const r=await fetch('/api/product-image?productId=product_92ac53fa75e18e8e73f20b56');return {status:r.status,type:r.headers.get('content-type'),bytes:(await r.arrayBuffer()).byteLength}}")
 assert image['status']==200 and image['type']=='image/webp' and image['bytes']>100,image
 page.get_by_label('نیاز یا مدل مورد نظر',exact=True).fill('هدفون مدل ZX9999UNKNOWN می‌خواهم')
 page.get_by_role('button',name='ارسال پیام',exact=True).click()
 page.locator('.hub-list article').first.wait_for(timeout=40000)
 assert 'در این دیتاست پیدا نشد' in page.locator('.empty-results').inner_text()
 links=page.locator('.hub-list a').evaluate_all('(links)=>links.map(a=>a.href)')
 assert any(url.startswith('https://charsou.com') for url in links),links
 page.locator('.leaflet-container').wait_for(timeout=20000)
 assert page.locator('.leaflet-container').count()==1
 page.wait_for_function("document.querySelectorAll('.leaflet-tile-loaded').length>=4",timeout=20000)
 loaded_tiles=page.locator('.leaflet-tile-loaded').count()
 page.screenshot(path=str(out/'public-area-guide.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path=str(out/'public-mobile-area.png'),full_page=True)
 report={'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'url':base,'forced_origin_ip':ip,'thumbnail':image,'external_guide_links':links,'map_widget':True,'loaded_map_tiles':loaded_tiles,'mobile_no_overflow':True,'page_errors':errors}
 assert not errors,errors
 (out/'public-smoke.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(report,indent=2));browser.close()
