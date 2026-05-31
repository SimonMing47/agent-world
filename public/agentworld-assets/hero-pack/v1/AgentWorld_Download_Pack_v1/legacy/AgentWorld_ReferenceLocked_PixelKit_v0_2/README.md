# AgentWorld Reference-Locked Pixel Kit v0.2

这个版本用于替换 v0.1 的粗糙像素角色。

核心原则：不再重画简化版，而是以用户参考图为视觉黄金样张进行透明化、部件拆解、源像素调色和局部硬边像素道具叠加。

## 关键文件

- `source/reference_transparent_clean_256.png`：清理后的 256×256 透明复刻角色。
- `layers/reconstruction/`：像素级复刻拆解层。按任意顺序叠加都能复原 clean 版本；当前差异像素数：0。
- `parts/`：可组合 NFT 式部件，包括 headgear、hair、face、outfit、shoes、side_prop、ground、hand_item、aura。
- `composites/roles/`：12 个 Agent 角色预览，轮廓和细节来自参考图，颜色与少量道具表达角色差异。
- `metadata/agentworld_reference_locked_traits.json`：主元数据。
- `compose_reference_locked.py`：按 metadata 的 visual_recipe 合成角色的示例。

## 导入建议

画布统一为 256×256，透明 PNG，锚点为 top-left，缩放必须使用 nearest-neighbor。

推荐图层顺序：

`ground -> side_prop -> aura -> hair -> shoes -> outfit -> face -> headgear -> detail -> hand_item`

不要使用模糊/抗锯齿缩放，否则会破坏参考图的清晰像素边缘。
