import json
import requests
from collections.abc import Mapping

URL = "https://fibalivestats.dcd.shared.geniussports.com/data/2798717/data.json"

response = requests.get(URL)
data = response.json()

with open("raw_game.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

all_paths = set()

def walk_json(obj, prefix=""):
    if isinstance(obj, Mapping):
        for key, value in obj.items():
            new_prefix = f"{prefix}.{key}" if prefix else key
            all_paths.add(new_prefix)
            walk_json(value, new_prefix)

    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            new_prefix = f"{prefix}[]"
            walk_json(item, new_prefix)

walk_json(data)

sorted_paths = sorted(all_paths)

with open("json_fields.txt", "w", encoding="utf-8") as f:
    for path in sorted_paths:
        f.write(path + "\n")

print(f"Found {len(sorted_paths)} fields")