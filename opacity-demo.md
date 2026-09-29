---
story-map: true
---

```story-map
title: 文章透明度示範 · Panel Opacity Demo
panelOpacity: 0.8
map:
  theme: light
  center: [25.04, 121.55]
  zoom: 13
  showPath: true
layout:
  mode: full
  full:
    side: right
    contentRatio: 0.48
slides:
  - title: 台北 101 · Taipei 101
    location: [25.0330, 121.5654]
    zoom: 14
    text: |
      地圖維持 100% 飽和與不透明度，文章卡片設定 `panelOpacity: 0.8`。
      
      文字清晰易讀，而背景的地圖道路與地形可以淡淡地從文章背後透出，完美呈現空間故事感！
  - title: 象山步道 · Elephant Mountain
    location: [25.0270, 121.5760]
    zoom: 14
    text: |
      沿著登山步道遠眺台北盆地，右側文章區塊與地圖背景漸層融合，透出底層的地理脈絡。
  - title: 大稻埕 · Dadaocheng
    location: [25.0555, 121.5097]
    zoom: 14
    text: |
      漫步在迪化街歷史街區。支援在文件設定 `panelOpacity: 0.0 ~ 1.0`，或至外掛設定調整預設值。
```
