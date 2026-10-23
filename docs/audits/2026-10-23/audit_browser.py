import json,pathlib,sys
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
root=pathlib.Path.cwd()
fixtures=json.loads((root/'scratch/audit-ui-fixtures.json').read_text(encoding='utf-8'))
out={'scope':'Production UI with intercepted chat responses from real services; actual local seller-check API. No live LLM/Neshan validation.'}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
 page.route('https://**/*',lambda route:route.abort())
 page.add_init_script('window.SpeechRecognition=undefined; window.webkitSpeechRecognition=undefined;')
 errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.goto('http://127.0.0.1:3107',wait_until='networkidle')
 out['initial_buttons']=page.get_by_role('button').all_text_contents()
 out['mobile_initial']=page.evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,dir:document.documentElement.dir})')
 page.screenshot(path=str(root/'scratch/audit-mobile-initial.png'),full_page=True)
 def chat_route(route):
  msg=route.request.post_data_json['messages'][-1]['content']
  which='visit' if 'کارت نهایی' in msg else 'stores' if 'انتخاب کردم' in msg else 'products'
  route.fulfill(json=fixtures[which])
 page.route('**/api/chat',chat_route)
 field=page.get_by_placeholder('چه محصولی مد نظرتان است؟...')
 field.fill('r50i');page.get_by_title('ارسال',exact=True).click()
 page.get_by_role('button',name='جدول مشخصات',exact=True).wait_for()
 page.get_by_role('button',name='جدول مشخصات',exact=True).click()
 out['comparison_table']=page.locator('table').inner_text()
 page.get_by_role('button',name='انتخاب',exact=True).last.click()
 page.get_by_role('button',name='استعلام موجودی',exact=True).first.wait_for()
 out['mobile_stores']=page.evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})')
 page.screenshot(path=str(root/'scratch/audit-mobile-stores.png'),full_page=True)
 page.get_by_role('button',name='استعلام موجودی',exact=True).first.click()
 page.get_by_role('button',name='استعلام از آوان آران (شیخ هادی)',exact=True).wait_for()
 requests=[]
 page.on('request',lambda req:requests.append(req.post_data_json) if '/api/seller-check' in req.url and req.method=='POST' else None)
 page.get_by_role('button',name='استعلام از آوان آران (شیخ هادی)',exact=True).click()
 page.get_by_role('button',name='مشاهده کارت نهایی مراجعه حضوری',exact=True).wait_for()
 out['backup_request']=requests[-1]
 page.get_by_role('button',name='مشاهده کارت نهایی مراجعه حضوری',exact=True).click()
 page.get_by_text('موجودی و قیمت قطعی تأیید شد',exact=True).wait_for()
 out['visit_claim']=page.get_by_text('موجودی و قیمت قطعی تأیید شد',exact=True).inner_text()
 out['visit_explicit_simulation_in_card']=page.locator('div').filter(has=page.get_by_text('موجودی و قیمت قطعی تأیید شد',exact=True)).last.inner_text().find('شبیه')>=0
 page.screenshot(path=str(root/'scratch/audit-mobile-journey.png'),full_page=True)
 page.reload(wait_until='networkidle')
 out['refresh_loses_visit']=page.get_by_text('موجودی و قیمت قطعی تأیید شد',exact=True).count()==0
 page.locator('input[type=file]').set_input_files(str(root/'docs/plans/sources/liara-p3-attachement.png'))
 page.get_by_text('Anker Soundcore R50i A3949',exact=True).wait_for()
 out['slide_recognized_as_product']=page.get_by_text('Anker Soundcore R50i A3949',exact=True).inner_text()
 page.get_by_role('button',name='انصراف',exact=True).click()
 page.get_by_title('ورودی صوتی (Push-to-Talk)',exact=True).click()
 page.locator('textarea').wait_for()
 out['unsupported_voice_fabricated_transcript']=page.locator('textarea').input_value()
 page.reload(wait_until='networkidle')
 page.set_viewport_size({'width':1440,'height':1000})
 out['desktop']=page.evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,appWidth:document.querySelector(".mobile-viewport").offsetWidth})')
 page.screenshot(path=str(root/'scratch/audit-desktop-initial.png'),full_page=True)
 out['page_errors']=errors
 api=page.request.get('http://127.0.0.1:3107/api/search?q=r50i').json()
 out['actual_search_api_titles']=[x['persian_title'] for x in api['products']]
 fake=page.request.post('http://127.0.0.1:3107/api/seller-check',data={'offerId':'nonexistent_audit_offer','shopName':'audit_shop','priceToman':123}).json()
 out['actual_api_accepts_invalid_offer']={k:fake[k] for k in ['offer_id','status','observed_price']}
 browser.close()
(root/'scratch/audit-browser-results.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2))
