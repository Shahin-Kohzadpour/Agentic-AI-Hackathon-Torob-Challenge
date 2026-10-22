import sys
import sqlite3
import json

sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect("data/torob.db")
c = conn.cursor()

# Check row counts
c.execute("SELECT count(*) FROM shops")
shops_count = c.fetchone()[0]
c.execute("SELECT count(*) FROM products")
products_count = c.fetchone()[0]
c.execute("SELECT count(*) FROM offers")
offers_count = c.fetchone()[0]
c.execute("SELECT count(*) FROM shops WHERE has_torob_pay_in_person = 1")
torob_pay_shops = c.fetchone()[0]

print(f"Shops: {shops_count:,}")
print(f"Products: {products_count:,}")
print(f"Offers: {offers_count:,}")
print(f"Shops with TorobPay in-person: {torob_pay_shops:,}")

# Test FTS search for R50i
print("\n--- FTS Search Test for 'R50i' ---")
c.execute("""
    SELECT p.product_id, p.persian_title, p.brand_name, p.category_name, count(o.offer_id) as offer_count
    FROM products_fts f
    JOIN products p ON f.product_id = p.product_id
    LEFT JOIN offers o ON p.product_id = o.product_id
    WHERE products_fts MATCH 'r50i'
    GROUP BY p.product_id
    ORDER BY offer_count DESC
    LIMIT 3
""")
for row in c.fetchall():
    print(f"ID: {row[0]} | Title: {row[1]} | Brand: {row[2]} | Offers: {row[4]}")

# Test Join for R50i with TorobPay in-person
demo_product_id = "product_92ac53fa75e18e8e73f20b56"
print(f"\n--- Checking Eligible Offers for Demo Product {demo_product_id} with TorobPay ---")
c.execute("""
    SELECT o.offer_id, s.shop_id, s.name, s.location_label, o.seller_title, o.price_toman, o.last_price_changed_at, o.warranty
    FROM offers o
    JOIN shops s ON o.shop_id = s.shop_id
    WHERE o.product_id = ? AND s.has_torob_pay_in_person = 1 AND o.price_toman IS NOT NULL
    ORDER BY o.price_toman ASC
""", (demo_product_id,))

for row in c.fetchall():
    print(f"Shop: {row[2]} ({row[3]}) | Price: {row[5]:,.0f} Toman | Updated: {row[6]} | Warranty: {row[7]}")

conn.close()
