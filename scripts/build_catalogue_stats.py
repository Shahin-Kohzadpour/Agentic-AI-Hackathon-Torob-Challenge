import pathlib,sqlite3
from import_dataset import create_product_stats
root=pathlib.Path(__file__).resolve().parent.parent
source=sqlite3.connect(f'file:{(root/"scratch/catalogue-v2.db").as_posix()}?mode=ro',uri=True)
target_path=root/'scratch/catalogue-v3.db'
if target_path.exists():raise SystemExit('Target exists; choose a new version rather than overwrite it.')
target=sqlite3.connect(target_path);source.backup(target);source.close()
create_product_stats(target)
assert target.execute('SELECT COUNT(*) FROM product_stats').fetchone()[0]==225903
assert not target.execute('PRAGMA foreign_key_check').fetchone()
target.close();print('Versioned catalogue statistics ready; supplied product/offer/shop records unchanged.')
