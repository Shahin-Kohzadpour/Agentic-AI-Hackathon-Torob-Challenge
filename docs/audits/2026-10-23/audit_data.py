import collections, json, pathlib, sqlite3, sys
sys.stdout.reconfigure(encoding='utf-8')
root=pathlib.Path.cwd()
(root/'scratch').mkdir(exist_ok=True)
c=sqlite3.connect('file:data/torob.db?mode=ro',uri=True)
c.row_factory=sqlite3.Row
audit=json.loads((root/'docs/plans/dataset-audit.json').read_text(encoding='utf-8'))
candidates=json.loads((root/'docs/plans/demo-candidates.json').read_text(encoding='utf-8'))
log=(root/'docs/plans/audit-output.txt').read_text(encoding='utf-8')
logged,end=json.JSONDecoder().raw_decode(log.lstrip())
print('AUDIT_LOG_MATCH',logged==audit,'LOG_REMAINDER',log.lstrip()[end:end+80])
print('TABLES',[r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")])
metrics={
 'shops': 'SELECT COUNT(*) FROM shops',
 'products':'SELECT COUNT(*) FROM products',
 'offers':'SELECT COUNT(*) FROM offers',
 'missing_prices':'SELECT COUNT(*) FROM offers WHERE price_toman IS NULL',
 'nonpositive_prices':'SELECT COUNT(*) FROM offers WHERE price_toman<=0',
 'duplicate_pairs': 'SELECT SUM(n-1) FROM (SELECT COUNT(*) n FROM offers GROUP BY product_id,shop_id)',
 'shops_with_offers':'SELECT COUNT(DISTINCT shop_id) FROM offers',
 'products_with_offers':'SELECT COUNT(DISTINCT product_id) FROM offers',
 'foreign_key_errors':'SELECT COUNT(*) FROM pragma_foreign_key_check',
 'torob_pay_in_person':'SELECT COUNT(*) FROM shops WHERE has_torob_pay_in_person=1',
 'max_distinct_products_shop':'SELECT MAX(n) FROM (SELECT COUNT(DISTINCT product_id) n FROM offers GROUP BY shop_id)',
}
results={k:c.execute(sql).fetchone()[0] for k,sql in metrics.items()}
shops=[dict(r) for r in c.execute('SELECT * FROM shops')]
results['any_in_person_payment']=sum(any(p.get('channel')=='in_person' for p in json.loads(s['payment_options'] or '[]')) for s in shops)
errors=[]
checked=0
for p in candidates:
 row=c.execute('SELECT * FROM products WHERE product_id=?',(p['product_id'],)).fetchone()
 if not row or row['persian_title']!=p['title']:errors.append([p['product_id'],'product'])
 for o in p['offers']:
  actual=c.execute('SELECT o.*, s.name shop_name,s.address,s.location_label,s.weekly_hours,s.payment_options,s.lat,s.lon FROM offers o JOIN shops s USING(shop_id) WHERE offer_id=?',(o['offer_id'],)).fetchone()
  checked+=1
  if not actual:errors.append([o['offer_id'],'absent']);continue
  for key in ['shop_id','shop_name','price_toman','last_price_changed_at','address']:
   if o[key]!=actual[key]:errors.append([o['offer_id'],key])
  if o['payments']!=json.loads(actual['payment_options'] or '[]'):errors.append([o['offer_id'],'payment'])
  if o['location']!=actual['location_label']:errors.append([o['offer_id'],'location'])
  if float(o['lat'])!=actual['lat'] or float(o['lon'])!=actual['lon']:errors.append([o['offer_id'],'coordinates'])
  if p['product_id']!=actual['product_id']:errors.append([o['offer_id'],'product_id'])
 print('CANDIDATE',p['product_id'],len(p['offers']),p['distinct_seller_count'])
results['candidate_products']=len(candidates)
results['candidate_offers_checked']=checked
results['candidate_mismatches']=errors
results['demo_specs']=json.loads(c.execute("SELECT specs FROM products WHERE product_id='product_92ac53fa75e18e8e73f20b56'").fetchone()[0])
results['demo_shop']=dict(c.execute("SELECT weekly_hours,payment_options FROM shops WHERE shop_id='shop_13336f1a0d2ec0b16bbd60aa'").fetchone())
print(json.dumps(results,ensure_ascii=False,indent=2))
(root/'scratch/audit-data-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
c.close()
