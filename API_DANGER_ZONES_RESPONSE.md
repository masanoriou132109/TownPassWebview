# `/api/danger-zones` API 响应格式

## 请求

**端点**: `POST /api/danger-zones`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

**请求体**:
```json
{
  "lat": 25.0478,
  "lng": 121.5170,
  "radius": 1000,
  "eps": 500,
  "minpoints": 3
}
```

**参数说明**:
- `lat`: 中心点纬度
- `lng`: 中心点经度
- `radius`: 查询半径（米）
- `eps`: DBSCAN 算法的 eps 参数（米）
- `minpoints`: DBSCAN 算法的最小点数

## 响应格式

### 成功响应 (200 OK)

```json
{
  "success": true,
  "data": {
    "query": {
      "center": {
        "lat": 25.0478,
        "lng": 121.517
      },
      "radius": 1000,
      "eps": 500,
      "minpoints": 3
    },
    "statistics": {
      "total_points_in_range": 0,
      "clusters_found": 0,
      "noise_points": 0,
      "total_alpha_sum": 0,
      "clusters_alpha_sum": 0,
      "noise_alpha_sum": 0
    },
    "clusters": [
      {
        "cluster_id": 1,
        "point_count": 5,
        "alpha": 0.75,
        "lat": 25.0478,
        "lng": 121.5170,
        "risk_level": "medium"
      }
    ],
    "noise_points": [
      {
        "id": 1,
        "lat": 25.0480,
        "lng": 121.5172,
        "alpha": 0.3
      }
    ],
    "geojson": {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "geometry": {
            "type": "Point",
            "coordinates": [121.5170, 25.0478]
          },
          "properties": {
            "type": "cluster",
            "cluster_id": 1,
            "alpha": 0.75,
            "risk_level": "medium",
            "point_count": 5
          }
        },
        {
          "type": "Feature",
          "geometry": {
            "type": "Point",
            "coordinates": [121.5172, 25.0480]
          },
          "properties": {
            "type": "noise",
            "id": 1,
            "alpha": 0.3
          }
        }
      ]
    }
  },
  "message": "Danger zones retrieved successfully"
}
```

### 数据结构说明

#### `data.query`
- `center`: 查询中心点坐标
  - `lat`: 纬度
  - `lng`: 经度
- `radius`: 查询半径（米）
- `eps`: DBSCAN eps 参数（米）
- `minpoints`: DBSCAN 最小点数

#### `data.statistics`
- `total_points_in_range`: 查询范围内的总点数
- `clusters_found`: 发现的群集数量
- `noise_points`: 噪音点数量
- `total_alpha_sum`: 所有点的 alpha 值总和
- `clusters_alpha_sum`: 群集的 alpha 值总和
- `noise_alpha_sum`: 噪音点的 alpha 值总和

#### `data.clusters[]`
群集数组，每个群集包含：
- `cluster_id`: 群集 ID（数字）
- `point_count`: 群集中的点数
- `alpha`: 群集的 alpha 值（用于判断风险等级）
- `lat`: 群集中心点纬度
- `lng`: 群集中心点经度
- `risk_level`: 风险等级（字符串，如 "low", "medium", "high"）

**风险等级判断规则**（前端实现）:
- `alpha <= 0.5`: `risk_level = "low"` → 使用 `stupid-b-svgrepo-com.svg` 图标
- `0.5 < alpha <= 1.0`: `risk_level = "medium"` → 使用 `injuried-svgrepo-com.svg` 图标
- `alpha > 1.0`: `risk_level = "high"` → 使用 `devil-svgrepo-com.svg` 图标

#### `data.noise_points[]`
噪音点数组（不属于任何群集的孤立点），每个点包含：
- `id`: 点 ID（数字）
- `lat`: 纬度
- `lng`: 经度
- `alpha`: 该点的 alpha 值

#### `data.geojson`
GeoJSON 格式的数据，包含：
- `type`: "FeatureCollection"
- `features[]`: 特征数组
  - 群集特征:
    - `type`: "Feature"
    - `geometry.type`: "Point"
    - `geometry.coordinates`: [经度, 纬度]
    - `properties.type`: "cluster"
    - `properties.cluster_id`: 群集 ID
    - `properties.alpha`: alpha 值
    - `properties.risk_level`: 风险等级
    - `properties.point_count`: 点数
  - 噪音点特征:
    - `type`: "Feature"
    - `geometry.type`: "Point"
    - `geometry.coordinates`: [经度, 纬度]
    - `properties.type`: "noise"
    - `properties.id`: 点 ID
    - `properties.alpha`: alpha 值

## 前端处理逻辑

### 1. 数据接收 (`HomeMap.tsx`)
```typescript
const result = await response.json()
if (result.success && result.data) {
  // 保存数据
  if (onDangerZonesData) {
    onDangerZonesData(result.data)
  }
  
  // 绘制危险区域
  drawDangerZones(result.data)
  
  // 显示统计信息
  const stats = result.data.statistics
  console.log('统计信息:', {
    总点数: stats.total_points_in_range,
    群集数量: stats.clusters_found,
    噪音点数: stats.noise_points,
    总Alpha: stats.total_alpha_sum,
    群集Alpha: stats.clusters_alpha_sum,
    噪音Alpha: stats.noise_alpha_sum,
  })
}
```

### 2. 绘制群集 (`drawDangerZones`)
- 遍历 `data.clusters[]` 数组
- 根据 `alpha` 值确定风险等级和图标
- 在地图上绘制标记（使用 SVG 图标）
- 添加点击事件，显示信息窗口

### 3. 绘制噪音点
- 遍历 `data.noise_points[]` 数组
- 在地图上绘制小圆点标记

## 错误响应

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing token"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation Error",
  "data": {
    "errors": [
      {
        "path": "body.lat",
        "message": "Invalid latitude"
      }
    ]
  }
}
```

## 注意事项

1. **JWT Token**: 所有请求必须包含有效的 JWT token 在 `Authorization` header 中
2. **坐标顺序**: GeoJSON 使用 `[经度, 纬度]` 顺序，而 API 响应中的 `lat`/`lng` 字段使用 `纬度, 经度` 顺序
3. **空数据**: 当查询范围内没有数据时，`clusters` 和 `noise_points` 数组为空
4. **风险等级**: 风险等级由前端根据 `alpha` 值计算，后端可能不返回 `risk_level` 字段（需要确认）



