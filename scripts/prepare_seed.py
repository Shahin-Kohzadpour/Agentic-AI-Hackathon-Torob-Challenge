"""Create a consistent, compressed deployment seed without copying live WAL files."""
import argparse, gzip, pathlib, shutil, sqlite3
root=pathlib.Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser()
parser.add_argument('--source',type=pathlib.Path,default=root/'data/torob.db')
args=parser.parse_args()
seed=root/'seed';seed.mkdir(exist_ok=True)
snapshot=seed/'torob-snapshot.db'
source=sqlite3.connect(f'file:{args.source.resolve().as_posix()}?mode=ro',uri=True)
target=sqlite3.connect(snapshot)
source.backup(target)
assert target.execute('SELECT COUNT(*) FROM offers').fetchone()[0]==331506
target.close();source.close()
with snapshot.open('rb') as src,gzip.open(seed/'torob.db.gz','wb',compresslevel=6) as dest:shutil.copyfileobj(src,dest)
snapshot.unlink()
print('Verified deployment seed bytes:',(seed/'torob.db.gz').stat().st_size)
