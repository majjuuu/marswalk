"""Extract a 1,024 m Bright Angel crop from the USGS TRN HiRISE products.
Requires rasterio, numpy, pillow. Run from repository root.
"""
import json, math
from pathlib import Path
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from PIL import Image

BASE = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/HiRISE/'
PRODUCTS = {
 'dtm': 'JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif',
 'ortho': 'JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first.tif',
}
LON, LAT, SIZE = 77.30519, 18.49748, 1024
cx, cy = (3396190 * math.radians(v) for v in (LON, LAT))
bounds = [cx-SIZE/2, cy-SIZE/2, cx+SIZE/2, cy+SIZE/2]
out = Path('public/terrain'); out.mkdir(parents=True, exist_ok=True)
with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', GDAL_HTTP_MULTIRANGE='YES', GDAL_HTTP_TIMEOUT='60'):
 for kind, name in PRODUCTS.items():
  with rasterio.open('/vsicurl/'+BASE+name) as src:
   print(kind, src.bounds, flush=True)
   if not (src.bounds.left <= bounds[0] < bounds[2] <= src.bounds.right and src.bounds.bottom <= bounds[1] < bounds[3] <= src.bounds.top):
    raise ValueError('Bright Angel crop outside dataset coverage')
   n = 257 if kind == 'dtm' else 2048
   data = src.read(1,window=from_bounds(*bounds,transform=src.transform),out_shape=(n,n),masked=True,resampling=Resampling.bilinear)
   if np.ma.getmaskarray(data).any(): raise ValueError('Crop has missing data; do not fabricate terrain')
   print(kind, float(data.min()),float(data.max()), flush=True)
   if kind == 'dtm':
    heights=np.asarray(data,dtype=float)
    payload=dict(size=SIZE,resolution=n,center=[LON,LAT],bounds=bounds,heights=np.round(heights,3).ravel().tolist(),source=BASE+name)
    (out/'bright-angel.json').write_text(json.dumps(payload,separators=(',',':')))
   else:
    pixels=np.asarray(data,dtype=float)
    lo,hi=np.percentile(pixels,[1,99])
    pixels=np.uint8(np.clip((pixels-lo)/(hi-lo),0,1)*255)
    Image.fromarray(pixels).save(out/'bright-angel.webp',quality=92)
(out/'provenance.json').write_text(json.dumps(dict(title='USGS Mars 2020 TRN HiRISE DTM and orthomosaic',doi='10.5066/P9REJ9JN',center=[LON,LAT],sizeMeters=SIZE,products={k:BASE+v for k,v in PRODUCTS.items()},note='Orbital reconstruction; illustrative camera positions and science marker bearings. Grayscale ortho is display-tinted, not true color.'),indent=2))
