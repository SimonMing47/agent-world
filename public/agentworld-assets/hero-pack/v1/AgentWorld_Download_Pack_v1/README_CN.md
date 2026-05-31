# AgentWorld Download Pack v1

这是给 AgentWorld 使用的角色元素下载包。

## 包内容
- `sheets/`：原始元素总表（sprite sheet）
- `crops/`：按 4x2 网格切分后的单元素图片
- `metadata/agentworld_asset_manifest.json`：总元数据清单
- `metadata/agentworld_asset_manifest.csv`：便于程序读取/表格查看的清单
- `metadata/agentworld_layer_schema.json`：图层顺序定义
- `metadata/agentworld_example_agents.json`：3 个示例 Agent 组合
- `legacy/`：之前版本的 zip、参考图、旧版 json/csv

## 推荐图层顺序
ground, side_prop, back_accessory, bottom, shoes, outfit_top, face, hair, headgear, hand_item

## 使用建议
1. 先根据 Agent 特质选择每个 layer 的 trait_id。
2. 通过 `agentworld_asset_manifest.json` 找到对应 `crop_file`。
3. 如果用于参考生成，可以直接把这些 crop 作为参考图。
4. 如果用于前端拼装，可以先用 cell 图片，再逐步替换成更干净的透明抠图版本。

## 当前资产规模
- 图层类别数：10
- trait 总数：152
- 原始 sheet 数：19

## 示例 trait_id
- `headgear.tricorn_feather.v2`
- `hair.low_ponytail.v1`
- `outfit_top.cloak_mage.v2`
- `hand_item.staff_purple_orb.v2`

