"""List the top-level files of HF mirrors of LLVIP (looking for the original zip / visible+infrared+Annotations)."""
import json
import urllib.request

for rid in ["jsonhash/LLVIP", "YH111111/LLVIP", "McCheng/LLVIP", "dronefreak/LLVIP", "Frencis/LLVIP_RGBT", "hieupth/llvip", "jhakrraman/LLVIP"]:
    try:
        t = json.load(urllib.request.urlopen(f"https://huggingface.co/api/datasets/{rid}/tree/main", timeout=20))
        print(rid, [(x["path"], x.get("size", 0) // 2**20) for x in t][:12])
    except Exception as e:  # noqa: BLE001
        print(rid, "ERR", e)
