from PIL import Image
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
with open(ROOT / "metadata" / "agentworld_reference_locked_traits.json", "r", encoding="utf-8") as f:
    meta = json.load(f)

traits = {t["trait_id"]: t for t in meta["traits"]}
layers = {l["layer"]: l["z_index"] for l in meta["layers"]}

def compose(recipe, out_path="composed_agent.png"):
    canvas = Image.new("RGBA", (meta["canvas"]["width"], meta["canvas"]["height"]), (0,0,0,0))
    items = []
    for layer, trait_id in recipe.items():
        t = traits[trait_id]
        items.append((layers[layer], t))
    for _, t in sorted(items, key=lambda x: x[0]):
        part = Image.open(ROOT / t["path"]).convert("RGBA")
        canvas = Image.alpha_composite(canvas, part)
    canvas.save(ROOT / out_path)
    return canvas

# Example: use one of the role recipes.
role = meta["roles"][0]
compose(role["visual_recipe"], "example_from_recipe.png")
