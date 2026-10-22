#!/usr/bin/env python3
"""
Torob Dataset Importer for SQLite with FTS5 Full-Text Search.
Supports both sample mode (--sample) and full dataset mode.
Preserves 100% referential integrity, parses nested JSON, normalizes Persian text,
and creates high-performance indexes.
"""

import argparse
import csv
import io
import json
import os
import re
import sqlite3
import sys
import time
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
DEFAULT_DB_PATH = DATA_DIR / "torob.db"

PARENT_DIR = PROJECT_DIR.parent
SAMPLE_DIR = PARENT_DIR / "samples"
FULL_CSV_DIR = PARENT_DIR


def normalize_persian_text(text: str) -> str:
    """Normalize Persian/Arabic characters, digits, and whitespace for search."""
    if not text or text == "null":
        return ""
    # Characters
    text = text.replace("\u064a", "\u06cc")  # Arabic Yeh to Persian Yeh
    text = text.replace("\u0643", "\u06a9")  # Arabic Kaf to Persian Keheh
    text = text.replace("\u06c0", "\u0647")  # Heh with yeh above
    text = text.replace("\u0626", "\u06cc")  # Yeh with hamza
    # Digits
    persian_digits = "۰۱۲۳۴۵۶۷۸۹"
    arabic_digits = "٠١٢٣٤٥٦٧٨٩"
    for i in range(10):
        text = text.replace(persian_digits[i], str(i))
        text = text.replace(arabic_digits[i], str(i))
    # Remove diacritics
    text = re.sub(r"[\u064B-\u065F\u0670]", "", text)
    # Standardize whitespace and remove excessive ZWNJ
    text = text.replace("\u200c", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip().lower()


def parse_json_safely(val, default):
    if not val or val == "null" or val == '""':
        return default
    try:
        return json.loads(val)
    except Exception:
        return default


def check_torob_pay_in_person(payment_options_json: str) -> int:
    """Check if payment options explicitly contain TorobPay with in_person channel."""
    opts = parse_json_safely(payment_options_json, [])
    if not isinstance(opts, list):
        return 0
    for opt in opts:
        if isinstance(opt, dict):
            provider = str(opt.get("provider_name", "")).lower()
            channel = str(opt.get("channel", "")).lower()
            if "torob" in provider and "in_person" in channel:
                return 1
            if "ترب" in provider and "in_person" in channel:
                return 1
    return 0


def create_schema(conn: sqlite3.Connection):
    cursor = conn.cursor()
    cursor.executescript("""
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    DROP TABLE IF EXISTS offers;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS shops;
    DROP TABLE IF EXISTS products_fts;
    DROP TABLE IF EXISTS shops_fts;

    CREATE TABLE shops (
        shop_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        location_label TEXT,
        address TEXT,
        lat REAL,
        lon REAL,
        category_names TEXT,
        contacts TEXT,
        weekly_hours TEXT,
        payment_options TEXT,
        has_torob_pay_in_person INTEGER DEFAULT 0,
        supports_fast_delivery INTEGER DEFAULT 0,
        website_url TEXT,
        instagram TEXT,
        normalized_search TEXT
    );

    CREATE TABLE products (
        product_id TEXT PRIMARY KEY,
        persian_title TEXT NOT NULL,
        brand_name TEXT,
        category_name TEXT NOT NULL,
        model TEXT,
        image_urls TEXT,
        specs TEXT,
        normalized_title TEXT
    );

    CREATE TABLE offers (
        offer_id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        shop_id TEXT NOT NULL,
        seller_title TEXT,
        price_toman REAL,
        last_price_changed_at TEXT,
        warranty TEXT,
        description TEXT,
        normalized_seller_title TEXT,
        FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
        FOREIGN KEY (shop_id) REFERENCES shops(shop_id) ON DELETE CASCADE
    );

    -- Indexes for high-performance joins and filtering
    CREATE INDEX idx_offers_product_id ON offers(product_id);
    CREATE INDEX idx_offers_shop_id ON offers(shop_id);
    CREATE INDEX idx_offers_price ON offers(price_toman);
    CREATE INDEX idx_shops_torob_pay ON shops(has_torob_pay_in_person);
    CREATE INDEX idx_products_category ON products(category_name);
    CREATE INDEX idx_products_brand ON products(brand_name);

    -- FTS5 Virtual Tables for full-text Persian search
    CREATE VIRTUAL TABLE products_fts USING fts5(
        product_id UNINDEXED,
        persian_title,
        brand_name,
        category_name,
        model,
        normalized_title,
        tokenize = 'unicode61'
    );

    CREATE VIRTUAL TABLE shops_fts USING fts5(
        shop_id UNINDEXED,
        name,
        location_label,
        address,
        normalized_search,
        tokenize = 'unicode61'
    );
    """)
    conn.commit()


def import_data(conn: sqlite3.Connection, csv_dir: Path, is_sample: bool = False):
    cursor = conn.cursor()
    prefix = "sample_" if is_sample else ""

    shops_file = csv_dir / f"{prefix}shops.csv"
    products_file = csv_dir / f"{prefix}products.csv"
    offers_file = csv_dir / f"{prefix}offers.csv"

    if not shops_file.exists() or not products_file.exists() or not offers_file.exists():
        raise FileNotFoundError(f"Missing CSV files in {csv_dir}. Looked for {shops_file.name}, {products_file.name}, {offers_file.name}")

    print(f"=== Starting Import ({'SAMPLE' if is_sample else 'FULL'} MODE) ===")
    start_total = time.time()

    # 1. Import Shops
    t0 = time.time()
    shop_rows = []
    shop_fts_rows = []
    valid_shop_ids = set()

    with open(shops_file, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            s_id = row["shop_id"]
            name = row.get("name") or ""
            loc_label = row.get("location_label") or ""
            addr = row.get("address") or ""
            lat = float(row["lat"]) if row.get("lat") and row["lat"] != "null" else None
            lon = float(row["lon"]) if row.get("lon") and row["lon"] != "null" else None
            cat_names = row.get("category_names") or "[]"
            contacts = row.get("contacts") or "[]"
            weekly_hours = row.get("weekly_hours") or "{}"
            pay_opts = row.get("payment_options") or "[]"
            torob_pay = check_torob_pay_in_person(pay_opts)
            fast_del = 1 if str(row.get("supports_fast_delivery", "")).lower() in ("true", "1") else 0
            web_url = row.get("website_url") or None
            insta = row.get("instagram") or None
            norm_search = normalize_persian_text(f"{name} {loc_label} {addr}")

            shop_rows.append((
                s_id, name, loc_label, addr, lat, lon,
                cat_names, contacts, weekly_hours, pay_opts,
                torob_pay, fast_del, web_url, insta, norm_search
            ))
            shop_fts_rows.append((s_id, name, loc_label, addr, norm_search))
            valid_shop_ids.add(s_id)

    cursor.executemany("""
        INSERT INTO shops (
            shop_id, name, location_label, address, lat, lon,
            category_names, contacts, weekly_hours, payment_options,
            has_torob_pay_in_person, supports_fast_delivery, website_url, instagram, normalized_search
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, shop_rows)

    cursor.executemany("""
        INSERT INTO shops_fts (shop_id, name, location_label, address, normalized_search)
        VALUES (?, ?, ?, ?, ?)
    """, shop_fts_rows)
    conn.commit()
    print(f"-> Imported {len(shop_rows):,} shops in {time.time()-t0:.2f}s")

    # 2. Import Products
    t0 = time.time()
    product_rows = []
    product_fts_rows = []
    valid_product_ids = set()

    with open(products_file, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            p_id = row["product_id"]
            title = row.get("persian_title") or ""
            brand = row.get("brand_name") or ""
            if brand == "null":
                brand = ""
            cat = row.get("category_name") or ""
            model = row.get("model") or ""
            if model == "null":
                model = ""
            img_urls = row.get("image_urls") or "[]"
            specs = row.get("specs") or "[]"
            norm_title = normalize_persian_text(f"{title} {brand} {model}")

            product_rows.append((p_id, title, brand, cat, model, img_urls, specs, norm_title))
            product_fts_rows.append((p_id, title, brand, cat, model, norm_title))
            valid_product_ids.add(p_id)

    cursor.executemany("""
        INSERT INTO products (
            product_id, persian_title, brand_name, category_name, model,
            image_urls, specs, normalized_title
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, product_rows)

    cursor.executemany("""
        INSERT INTO products_fts (product_id, persian_title, brand_name, category_name, model, normalized_title)
        VALUES (?, ?, ?, ?, ?, ?)
    """, product_fts_rows)
    conn.commit()
    print(f"-> Imported {len(product_rows):,} products in {time.time()-t0:.2f}s")

    # 3. Import Offers
    t0 = time.time()
    offer_rows = []
    skipped_offers = 0

    with open(offers_file, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            o_id = row["offer_id"]
            p_id = row["product_id"]
            s_id = row["shop_id"]

            # Referential integrity check
            if p_id not in valid_product_ids or s_id not in valid_shop_ids:
                skipped_offers += 1
                continue

            seller_title = row.get("seller_title") or ""
            price_val = row.get("price_toman")
            price = None
            if price_val and price_val != "null":
                try:
                    price = float(price_val)
                except ValueError:
                    price = None

            last_change = row.get("last_price_changed_at") or None
            if last_change == "null":
                last_change = None

            warranty = row.get("warranty") or ""
            if warranty == "null":
                warranty = ""
            desc = row.get("description") or ""
            if desc == "null":
                desc = ""
            norm_seller_title = normalize_persian_text(seller_title)

            offer_rows.append((
                o_id, p_id, s_id, seller_title, price,
                last_change, warranty, desc, norm_seller_title
            ))

    cursor.executemany("""
        INSERT INTO offers (
            offer_id, product_id, shop_id, seller_title, price_toman,
            last_price_changed_at, warranty, description, normalized_seller_title
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, offer_rows)
    conn.commit()
    print(f"-> Imported {len(offer_rows):,} offers in {time.time()-t0:.2f}s (skipped invalid refs: {skipped_offers})")

    # Optimize and vacuum
    t0 = time.time()
    cursor.execute("PRAGMA optimize;")
    conn.commit()
    print(f"-> Optimized SQLite FTS & Indexes in {time.time()-t0:.2f}s")
    print(f"=== Total Import Time: {time.time()-start_total:.2f}s ===")


def main():
    parser = argparse.ArgumentParser(description="Import Torob dataset into SQLite")
    parser.add_argument("--sample", action="store_true", help="Use small sample dataset for rapid development")
    parser.add_argument("--db", type=str, default=str(DEFAULT_DB_PATH), help="Target SQLite database path")
    args = parser.parse_args()

    target_db = Path(args.db)
    target_db.parent.mkdir(parents=True, exist_ok=True)

    csv_dir = SAMPLE_DIR if args.sample else FULL_CSV_DIR
    print(f"Database target: {target_db}")
    print(f"CSV directory:   {csv_dir}")

    conn = sqlite3.connect(str(target_db))
    try:
        create_schema(conn)
        import_data(conn, csv_dir, is_sample=args.sample)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
