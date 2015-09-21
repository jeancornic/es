# Elasticsearch Web App

Connects to an elasticsearch cluster and lists all the shards grouped by index.
Index groups are sorted by total segment memory size.

Implemented in js.

Uses ES [Indices segment](https://www.elastic.co/guide/en/elasticsearch/reference/1.4/indices-segments.html) api.

## Configuration

Edit constants on top of file `server.js`.

* `ES_HOST`: elasticsearch ip (default: `localhost`)
* `ES_PORT`: es port (default: `9200`)
* `WEBAPP_PORT`: the port the webapp will listen on (default: `8080`)

## Usage

```bash
node server.js
```

Open your favorite browser at `localhost:8080` (or your custom url), and you'll see the list of shards.

