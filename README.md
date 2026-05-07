# LifeScale

`LifeScale · 人生刻度` 是一个本地优先的人生阶段、暂停期与里程碑可视化工具。

## 本地前端开发

只启动前端：

```bash
npm install
npm run dev
```

访问 Vite 输出的地址，通常是 `http://localhost:5173`。

## 本地全栈开发

开两个终端。

终端 1 启动后端 API：

```bash
npm run dev:server
```

终端 2 启动前端：

```bash
npm run dev
```

前端会通过 Vite proxy 访问 `http://localhost:3001/api`。

后端数据会持久化写入：

```txt
data/lifescale.json
```

每次保存会先写临时文件，再原子替换正式文件，并保留上一版备份：

```txt
data/lifescale.json.bak
```

也可以用环境变量指定保存位置：

```bash
DATA_FILE=/absolute/path/lifescale.json npm run dev:server
```

或者指定目录：

```bash
DATA_DIR=/absolute/path npm run dev:server
```

## Docker 启动

```bash
docker compose up --build
```

然后访问：

```txt
http://localhost:3001
```

后端数据会保存在 Docker volume `lifescale-data` 中。

容器内路径是：

```txt
/data/lifescale.json
```

## 常用检查

```bash
npm run test
npm run build
npm run lint
```
