"""Record real browser interactions and mux an optional Persian TTS narration.

Requires playwright, edge-tts and imageio-ffmpeg. No application API is mocked.
Output is a reviewable local file; it is never uploaded by this script.
"""
import asyncio,json,os,subprocess,time,wave
from pathlib import Path
import edge_tts,imageio_ffmpeg
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parent.parent
out=root/'docs/delivery/video';out.mkdir(parents=True,exist_ok=True)
work=root/'test-results/demo-recording';work.mkdir(parents=True,exist_ok=True)
base=os.environ.get('TEST_BASE_URL','https://kavoshgaran.liara.run');ip=os.environ.get('TEST_ORIGIN_IP')
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
sections=[
 ('intro',25,'سلام. ما تیم کاوشگران هستیم. این همراه خرید حضوری، از انتخاب محصول تا برنامهٔ مراجعه در تهران به خریدار کمک می‌کند. نسخه‌ای که می‌بینید روی لیارا منتشر شده است. منبع اصلی، دیتاست کامل چالش ترب است. ارتباط با فروشنده در این نسخه شبیه‌سازی می‌شود؛ این موضوع در تمام مراحل روشن نمایش داده شده است.'),
 ('discovery',35,'کاربر لازم نیست از ابتدا مدل دقیق را بداند. می‌تواند با کاربرد، بودجه و شرایط خرید شروع کند. اینجا هندزفری برای رفت و آمد می‌خواهیم. دستیار نیاز را استخراج می‌کند و گزینه‌ها را از کاتالوگ واقعی می‌آورد. مشخصات ثبت‌شده برای مقایسه کنار هم قرار می‌گیرند. اگر داده برای قضاوت دربارهٔ کیفیت کافی نباشد، آن را صریح اعلام می‌کنیم. سؤال تکمیلی و انتخاب از کارت‌ها، هر دو در دسترس‌اند.'),
 ('comparison',35,'برای نشان دادن مسیر کامل، نمونهٔ مشخص انکر آر پنجاه آی را اجرا می‌کنیم. بودجه چهار میلیون و دویست هزار تومان و خرید حضوری با ترب پی است. نام مدل و واریانت حفظ می‌شود. جدول مقایسه از مشخصات ثبت‌شده استفاده می‌کند. قیمت شروع، تعداد فروشگاه‌ها و شرایط فعلی از داده محاسبه شده‌اند. کاربر می‌تواند بدون نوشتن دوبارهٔ درخواست، فیلترها را تغییر دهد یا مستقیماً مدل را انتخاب کند.'),
 ('stores',35,'حالا آفرهای همان محصول را می‌بینیم. دو فروشگاه با قیمت‌های سه میلیون و صد و پنجاه هزار، و سه میلیون و هشتصد و پنجاه هزار تومان با شرط ترب پی سازگارند. گارانتی، آدرس، ساعت و زمان تغییر قیمت جدا نمایش داده می‌شوند. بیشتر نام‌های فروشگاه در دیتاست مستعار هستند و شماره‌ها ساختگی‌اند. بنابراین شمارهٔ ساختگی را برای تماس ارائه نمی‌کنیم. نقشه برای موقعیت است و فاصلهٔ هوایی با زمان رانندگی یکی نیست.'),
 ('recovery',45,'فروشگاه ارزان‌تر را بررسی می‌کنیم. این پیگیری شبیه‌سازی است و تماس واقعی برقرار نمی‌شود. در سناریوی نمایش، فروشنده پاسخ نمی‌دهد. دستیار بلافاصله فروشگاه متمایز بعدی را با حفظ بودجه و اقساط پیشنهاد می‌کند. اختلاف هفتصد هزار تومان، فاصله و تفاوت گارانتی را هم توضیح می‌دهد. کاربر می‌فهمد چه اتفاقی افتاده و اقدام بعدی چیست. این جایگزین‌یابی برای محصولات دیگر هم از همان گردش کار استفاده می‌کند. اگر هیچ گزینه‌ای همهٔ شروط را نداشته باشد، دستیار شرط را بی‌اجازه حذف نمی‌کند.'),
 ('visit',45,'جایگزین را بررسی و با پاسخ شبیه‌سازی‌شده، کارت مراجعه می‌سازیم. محصول، مبلغ، آدرس، گارانتی، شرایط اقساط و لینک مسیریاب یکجا در دسترس هستند. کارت ادعای رزرو یا تأیید واقعی ندارد. برآورد نشان فقط زمانی نمایش داده می‌شود که سرویس واقعی پاسخ معتبر بدهد. با تازه کردن صفحه، کارت و تاریخچه حفظ می‌شوند. این رابط برای موبایل طراحی شده است؛ متن فارسی و راست به چپ، فیلترهای جمع‌شونده و کنترل‌های مناسب لمس، مراحل خرید را در صفحهٔ گوشی پیش می‌برند.'),
 ('coverage',35,'حالا شرط بودجه را تغییر می‌دهیم. نتیجه دوباره محاسبه می‌شود و بررسی قبلی خودکار معتبر فرض نمی‌شود. در یک جست‌وجوی تازه، مدلی را می‌خواهیم که در این نمونهٔ دیتاست پیدا نمی‌شود. این به معنی نبود آن در تهران نیست. دستیار محدودهٔ مرتبط خرید را با منبع بیرونی، زمان بررسی و نقشه پیشنهاد می‌دهد. پیشنهاد مرکز خرید، ادعای موجودی، قیمت یا پذیرندگی اقساط یک فروشگاه نیست.'),
 ('image',25,'ورودی تصویر هم به سرویس واقعی متصل است. در این نمونه، برچسب آزمایشی برند و کد مدل را می‌خوانیم. مدل تشخیص‌داده‌شده پیش از ارسال، قابل اصلاح و تأیید است. تصویر مبهم به مدل قطعی تبدیل نمی‌شود و متن روی تصویر اختیار تغییر بودجه یا تأیید موجودی را ندارد. تایپ همیشه در دسترس می‌ماند.'),
 ('ending',20,'نسخهٔ عمومی روی لیارا با چهار گیگابایت حافظه و دیسک پایدار اجرا شده است. پنجاه و هفت آزمون سرویس، مسیر مرورگر و اتصال واقعی تصویر و نشان بررسی شده‌اند. هدف کاوشگران، کم کردن مراجعهٔ بی‌نتیجه و روشن کردن قدم بعدی خریدار است. سپاس از توجه شما.'),
]

async def make_audio():
 for name,_,text in sections:
  mp3=work/f'{name}.mp3';pcm=work/f'{name}.wav'
  if not mp3.exists():await edge_tts.Communicate(text,'fa-IR-DilaraNeural',rate='+8%').save(str(mp3))
  subprocess.run([ffmpeg,'-y','-loglevel','error','-i',str(mp3),'-ar','24000','-ac','1','-c:a','pcm_s16le',str(pcm)],check=True)
asyncio.run(make_audio())
if os.environ.get('DEMO_AUDIO_ONLY')=='1':
 print('Persian narration segments are ready.',flush=True)
 raise SystemExit(0)
timings=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--host-resolver-rules=MAP '+base.split('/')[2]+' '+ip] if ip else [])
 context=browser.new_context(**p.devices['iPhone 13'],record_video_dir=str(work),record_video_size={'width':390,'height':844},reduced_motion='reduce')
 page=context.new_page();video=page.video
 def wait_ready():page.locator('.preferences').wait_for(timeout=40000)
 def send(message):
  page.get_by_label('نیاز یا مدل مورد نظر',exact=True).fill(message)
  page.get_by_role('button',name='ارسال پیام',exact=True).click()
  page.get_by_role('button',name='انتخاب و دیدن فروشگاه‌ها',exact=True).first.wait_for(timeout=45000)
 def scroll(selector):
  page.locator(selector).first.scroll_into_view_if_needed();page.wait_for_timeout(600)
 def reset():
  page.get_by_role('button',name='شروع دوباره',exact=True).click()
  page.locator('.entry-options').wait_for(timeout=10000)
 def action(name):
  if name=='intro':page.goto(base,wait_until='networkidle');wait_ready()
  elif name=='discovery':
   send('هندزفری برای رفت و آمد با بودجه ۴٫۲ میلیون تومان می‌خواهم');scroll('.product-card');page.wait_for_timeout(5000)
   page.get_by_role('button',name='جدول مقایسه',exact=True).click();scroll('.comparison-wrapper')
   page.wait_for_timeout(5000);page.locator('.comparison-wrapper').evaluate('(e)=>e.scrollLeft=-e.scrollWidth')
  elif name=='comparison':
   page.goto(base,wait_until='networkidle');reset()
   send('Anker Soundcore R50i A3949 با ترب‌پی و بودجه ۴٫۲ میلیون تومان')
   page.get_by_role('button',name='جدول مقایسه',exact=True).click();scroll('.comparison-wrapper')
  elif name=='stores':
   page.get_by_role('button',name='انتخاب و دیدن فروشگاه‌ها',exact=True).first.click()
   page.locator('.offer-card').first.wait_for();scroll('.offer-card')
   page.locator('.evidence-details summary').first.click();page.wait_for_timeout(2500)
   page.get_by_role('button',name='نقشه',exact=True).click();scroll('.store-map');page.wait_for_timeout(2500)
   page.get_by_role('button',name='لیست',exact=True).click();scroll('.offer-card')
  elif name=='recovery':
   page.get_by_role('button',name='بررسی قیمت و موجودی (شبیه‌سازی)',exact=True).first.click()
   page.get_by_role('heading',name='فروشنده پاسخ نداد',exact=True).wait_for(timeout=20000);scroll('.check-card')
   page.wait_for_timeout(5000);page.locator('.event-log summary').click();scroll('.event-log');page.wait_for_timeout(5000);scroll('.offer-card.recommended')
  elif name=='visit':
   page.locator('.offer-card.recommended').get_by_role('button',name='بررسی قیمت و موجودی (شبیه‌سازی)',exact=True).click()
   page.get_by_role('button',name='ساخت کارت مراجعه با همین پاسخ',exact=True).wait_for(timeout=20000)
   page.get_by_role('button',name='ساخت کارت مراجعه با همین پاسخ',exact=True).click();scroll('.visit-card')
   page.get_by_role('button',name='محاسبهٔ مسیر با نشان',exact=True).click();page.wait_for_timeout(3500)
   page.reload(wait_until='networkidle');scroll('.visit-card');page.wait_for_timeout(4000)
   page.locator('.visit-actions').scroll_into_view_if_needed();page.wait_for_timeout(6000);scroll('.visit-card')
  elif name=='coverage':
   page.get_by_label('ویرایش شرایط خرید',exact=True).click();page.get_by_label('سقف بودجه',exact=False).fill('1000000')
   page.get_by_role('button',name='اعمال شرایط',exact=True).click();page.locator('.empty-results').wait_for();scroll('.empty-results');page.wait_for_timeout(3000)
   reset();page.get_by_label('نیاز یا مدل مورد نظر',exact=True).fill('هدفون مدل ZX9999UNKNOWN می‌خواهم')
   page.get_by_role('button',name='ارسال پیام',exact=True).click();page.locator('.hub-list article').first.wait_for(timeout=40000);scroll('.hub-list article')
  elif name=='image':
   page.locator('input[type=file]').set_input_files(str(root/'test-results/fixture-label.png'))
   page.get_by_role('dialog',name='بررسی عکس محصول').wait_for()
   page.get_by_role('button',name='قرار دادن مدل در کادر پیام',exact=True).wait_for(state='visible')
   page.wait_for_function("!document.querySelector('[aria-label=\"بررسی عکس محصول\"] button.button')?.disabled",timeout=25000)
  elif name=='ending':
   page.get_by_role('button',name='بستن عکس',exact=True).click();reset();page.evaluate('window.scrollTo(0,0)')
 for name,planned,text in sections:
  with wave.open(str(work/f'{name}.wav'),'rb') as audio:audio_seconds=audio.getnframes()/audio.getframerate()
  started=time.monotonic();action(name);elapsed=time.monotonic()-started
  duration=max(planned,audio_seconds+2,elapsed+1)
  page.wait_for_timeout(max(0,duration-elapsed)*1000)
  timings.append({'name':name,'duration':round(time.monotonic()-started,3),'audio_seconds':audio_seconds,'narration':text})
  print(json.dumps({'section':name,'seconds':timings[-1]['duration']}),flush=True)
 context.close();source=Path(video.path());browser.close()

audio_path=work/'narration.wav'
with wave.open(str(audio_path),'wb') as target:
 target.setparams((1,2,24000,0,'NONE','not compressed'))
 for row in timings:
  with wave.open(str(work/(row['name']+'.wav')),'rb') as source_audio:pcm=source_audio.readframes(source_audio.getnframes())
  # One second of quiet before each section gives the UI time to settle.
  target.writeframes(b'\0'*(24000*2));target.writeframes(pcm)
  silence=max(0,round((row['duration']-1)*24000)*2-len(pcm));target.writeframes(b'\0'*silence)
destination=out/'kavoshgaran-demo-fa.mp4'
subprocess.run([ffmpeg,'-y','-loglevel','error','-i',str(source),'-i',str(audio_path),'-map','0:v:0','-map','1:a:0','-vf','scale=780:1688:flags=lanczos','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart','-shortest',str(destination)],check=True)
manifest={'recorded_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'url':base,'forced_origin_ip':ip,'device':'iPhone 13, 390x844 CSS viewport; portrait output 780x1688','narration':'Persian synthesized voice fa-IR-DilaraNeural; review before submission','duration_seconds':sum(r['duration'] for r in timings),'bytes':destination.stat().st_size,'sections':timings}
(out/'recording-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'file':str(destination),'seconds':manifest['duration_seconds'],'bytes':manifest['bytes']}),flush=True)
