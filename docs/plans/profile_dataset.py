import collections as C
import csv
import datetime as dt
import io
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ARCHIVE = Path('/home/arash/Downloads/starcoach-dataset-v16-cap300-csv.zip')

def present(v):
    return v not in ('', 'null', '{}', '[]', None)

def parsed(v, default):
    return json.loads(v) if present(v) else default

def rows(z, name):
    return csv.DictReader(io.TextIOWrapper(z.open(name + '.csv'), encoding='utf-8-sig'))

def main():
    out = {'archive': str(ARCHIVE), 'analysis_date': '2026-10-22', 'tables': {}}
    with zipfile.ZipFile(ARCHIVE) as z:
        shops, products = {}, {}
        for name, dest, key in [('shops', shops, 'shop_id'), ('products', products, 'product_id')]:
            coverage, categories, signatures = C.Counter(), C.Counter(), C.Counter()
            count = duplicate_ids = 0
            for r in rows(z, name):
                count += 1
                duplicate_ids += r[key] in dest
                dest[r[key]] = r
                coverage.update(k for k, v in r.items() if present(v))
                if name == 'products':
                    categories[r['category_name']] += 1
                else:
                    for p in parsed(r['payment_options'], []):
                        signatures[json.dumps(p, ensure_ascii=False, sort_keys=True)] += 1
            out['tables'][name] = {'rows': count, 'duplicate_ids': duplicate_ids, 'nonempty_fields': dict(coverage)}
            if name == 'products':
                out['top_product_categories'] = categories.most_common(35)
            else:
                out['payment_option_values'] = signatures.most_common()

        counts, shop_counts, offer_categories = C.Counter(), C.Counter(), C.Counter()
        offer_coverage, ids, date_months = C.Counter(), set(), C.Counter()
        candidates = {}
        min_date, max_date = None, None
        invalid_refs = bad_prices = duplicate_offers = duplicate_pairs = 0
        missing_prices = nonpositive_prices = malformed_prices = 0
        pairs = set()
        multi_summary = {}
        n = 0
        for r in rows(z, 'offers'):
            n += 1
            duplicate_offers += r['offer_id'] in ids
            ids.add(r['offer_id'])
            pair = (r['product_id'], r['shop_id'])
            duplicate_pairs += pair in pairs
            pairs.add(pair)
            offer_coverage.update(k for k, v in r.items() if present(v))
            if r['shop_id'] not in shops or r['product_id'] not in products:
                invalid_refs += 1
                continue
            counts[r['product_id']] += 1
            shop_counts[r['shop_id']] += 1
            cat = products[r['product_id']]['category_name']
            offer_categories[cat] += 1
            try:
                price = float(r['price_toman'])
                bad_prices += price <= 0
                nonpositive_prices += price <= 0
            except ValueError:
                price = None
                bad_prices += 1
                missing_prices += not present(r['price_toman'])
                malformed_prices += present(r['price_toman'])
            d = r['last_price_changed_at']
            if present(d):
                min_date = min(min_date, d) if min_date else d
                max_date = max(max_date, d) if max_date else d
                date_months[d[:7]] += 1
            if re.search('گوشی موبایل|لپ تاپ|هدفون|هندزفری|اسپیکر|کفش',cat):
                s = shops[r['shop_id']]
                item = candidates.setdefault(r['product_id'], {'product_id':r['product_id'], 'title':products[r['product_id']]['persian_title'], 'category':cat,'has_specs':present(products[r['product_id']]['specs']), 'offers':[]})
                item['offers'].append({'offer_id':r['offer_id'], 'shop_id':r['shop_id'], 'shop_name':s['name'], 'price_toman':price, 'last_price_changed_at':d,'location':s['location_label'],'address':s['address'],'has_hours':present(s['weekly_hours']),'payments':parsed(s['payment_options'],[]),'lat':s['lat'],'lon':s['lon']})
        out['tables']['offers'] = {'rows':n,'duplicate_ids':duplicate_offers,'additional_offers_for_existing_product_shop_pair':duplicate_pairs,'nonempty_fields':dict(offer_coverage),'invalid_foreign_keys':invalid_refs,'missing_prices':missing_prices,'nonpositive_prices':nonpositive_prices,'malformed_nonmissing_prices':malformed_prices}
        distinct_sellers = C.Counter(pid for pid, sid in pairs)
        distinct_products = C.Counter(sid for pid, sid in pairs)
        out['price_change_range'] = [min_date, max_date]
        out['price_change_months'] = dict(sorted(date_months.items()))
        out['products_with_offers'] = len(counts)
        out['shops_with_offers'] = len(shop_counts)
        out['products_with_at_least_2_distinct_sellers'] = sum(v >= 2 for v in distinct_sellers.values())
        out['products_with_at_least_3_distinct_sellers'] = sum(v >= 3 for v in distinct_sellers.values())
        out['max_distinct_products_per_shop'] = max(distinct_products.values())
        out['max_offers_per_shop'] = max(shop_counts.values())
        out['max_offers_per_product'] = max(counts.values())
        out['top_offer_categories'] = offer_categories.most_common(25)
        for pid, c in distinct_sellers.items():
            cat = products[pid]['category_name']
            v = multi_summary.setdefault(cat, {'products':0,'multiple_sellers':0,'three_plus_sellers':0})
            v['products'] += 1
            v['multiple_sellers'] += c >= 2
            v['three_plus_sellers'] += c >= 3
        out['comparison_categories'] = sorted(multi_summary.items(), key=lambda kv:kv[1]['three_plus_sellers'], reverse=True)[:25]
        shop_extra = C.Counter()
        hour_status = C.Counter()
        bounds = []
        for s in shops.values():
            shop_extra['shops_with_explicit_in_person_payment'] += any(p.get('channel') == 'in_person' for p in parsed(s['payment_options'],[]))
            shop_extra['website_or_instagram'] += present(s['website_url']) or present(s['instagram'])
            shop_extra['address_mentions_floor_or_unit'] += bool(re.search('طبقه|واحد|پلاک',s['address']))
            shop_extra['address_mentions_mall'] += bool(re.search('پاساژ|مجتمع|مرکز خرید',s['address']))
            try:
                lat, lon = float(s['lat']), float(s['lon'])
                bounds.append((lat,lon))
                shop_extra['coordinates_outside_broad_tehran_bbox'] += not (35.4 <= lat <= 36 and 50.8 <= lon <= 51.9)
            except ValueError:
                shop_extra['invalid_coordinates'] += 1
            for day in parsed(s['weekly_hours'],{}).values():
                hour_status[day.get('status','missing')] += 1
        out['shop_details'] = dict(shop_extra)
        out['weekly_hours_day_statuses'] = dict(hour_status)
        out['coordinate_bounds'] = {'lat':[min(x[0] for x in bounds),max(x[0] for x in bounds)],'lon':[min(x[1] for x in bounds),max(x[1] for x in bounds)]}
        # Favor real multi-seller joins, typed payment data and declared hours.
        shortlist = [v for v in candidates.values() if len({o['shop_id'] for o in v['offers']}) >= 3]
        shortlist.sort(key=lambda v:(min(len(v['offers']),15)+4*sum(bool(o['payments']) for o in v['offers'])+2*sum(o['has_hours'] for o in v['offers'])+v['has_specs']),reverse=True)
        selected = []
        percat = C.Counter()
        for v in shortlist:
            if percat[v['category']] >= 3:
                continue
            selected.append(v)
            v['distinct_seller_count'] = len({o['shop_id'] for o in v['offers']})
            v['explicit_in_person_payment_seller_count'] = len({o['shop_id'] for o in v['offers'] if any(p.get('channel') == 'in_person' for p in o['payments'])})
            percat[v['category']] += 1
            if len(selected) >= 15:
                break
        (ROOT/'demo-candidates.json').write_text(json.dumps(selected,ensure_ascii=False,indent=2))
        (ROOT/'dataset-audit.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
        print(json.dumps(out,ensure_ascii=False,indent=2))
        print('DEMO CANDIDATES',json.dumps([{k:v for k,v in p.items() if k!='offers'}|{'offer_count':len(p['offers'])} for p in selected],ensure_ascii=False,indent=2))

if __name__ == '__main__':
    main()
