"""Decode the portrait demo, inspect its audio, and play it in a fresh browser."""
from pathlib import Path
import json,re,subprocess
import imageio_ffmpeg
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent;folder=root/'docs/delivery/video';video=folder/'kavoshgaran-demo-fa.mp4'
work=root/'test-results/mobile-video-qa';work.mkdir(parents=True,exist_ok=True)
ff=imageio_ffmpeg.get_ffmpeg_exe()
probe=subprocess.run([ff,'-hide_banner','-i',str(video),'-af','volumedetect','-vn','-f','null','-'],capture_output=True,text=True,encoding='utf-8',errors='replace')
assert probe.returncode==0,probe.stderr[-1000:]
logs=probe.stderr
report={'decoder_exit':0,'duration_line':re.search(r'Duration:.*',logs).group(0),'video_stream':next(x.strip() for x in logs.splitlines() if 'Video:' in x),'audio_stream':next(x.strip() for x in logs.splitlines() if 'Audio:' in x),'mean_volume':re.search(r'mean_volume: ([^\n]+)',logs).group(1),'max_volume':re.search(r'max_volume: ([^\n]+)',logs).group(1)}
sheet=Image.new('RGB',(720,1614),'#e5e7eb');draw=ImageDraw.Draw(sheet)
for index,seconds in enumerate([15,45,85,115,160,210,250,280,295]):
 path=work/f'frame-{seconds}.png'
 subprocess.run([ff,'-y','-loglevel','error','-ss',str(seconds),'-i',str(video),'-frames:v','1',str(path)],check=True)
 frame=Image.open(path);frame.thumbnail((240,519));x=index%3*240;y=index//3*538
 sheet.paste(frame,(x,y+18));draw.text((x+4,y+2),f'{seconds}s',fill='black')
sheet.save(folder/'contact-sheet-mobile.png')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--autoplay-policy=no-user-gesture-required'])
 page=browser.new_page(viewport={'width':390,'height':844});page.goto(video.as_uri(),wait_until='load');v=page.locator('video');v.wait_for();v.evaluate('(v)=>v.play()');page.wait_for_timeout(2500)
 playback=v.evaluate('(v)=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,currentTime:v.currentTime,paused:v.paused,muted:v.muted,error:v.error?.message||null,readyState:v.readyState,audioDecodedBytes:v.webkitAudioDecodedByteCount})')
 assert playback['width']==780 and playback['height']==1688 and 295<playback['duration']<330 and playback['currentTime']>0 and not playback['paused'] and not playback['error'],playback
 v.evaluate('(v)=>v.currentTime=160');page.wait_for_timeout(1000);page.screenshot(path=str(folder/'playback-mobile.png'));browser.close()
report['playback']=playback;report['bytes']=video.stat().st_size
(folder/'media-qa-mobile.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
