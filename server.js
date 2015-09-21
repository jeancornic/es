#!/usr/bin/env node

/**
 * List shards of an elastic search cluster, grouped by indexes.
 * Groups are sorted by index total segment memory size.
 *
 * Algorithm: Based on https://www.elastic.co/guide/en/elasticsearch/reference/1.4/indices-segments.html
 *
 * For each index:
 *    List shards
 *    For each shards:
 *        List segments of shard
 *        Sum segments memory size, as the shard memory size
 *
 *    Sum shards memory size, as index total memory size
 *
 * Sort groups by memory size
 */


// ------------------------------
// CONFIG
// ------------------------------

var ES_HOST = 'localhost';
var ES_PORT = 9200;

var WEBAPP_PORT = 8080;


// ------------------------------
// IMPORTS
// ------------------------------

var elasticsearch = require('elasticsearch');
var http = require('http');
var util = require('util');

// Open a connection to Elastic Search cluster
var es_client = new elasticsearch.Client({
  host: ES_HOST + ':' + ES_PORT
});


// ------------------------------
// WEBAPP
// ------------------------------

// Define server
var server = http.createServer(function(request, response) {
  // Test cluster availability before doing any operation
  es_client.ping({
    requestTimeout: 1000 // 1s timeout
  }, function (error) {
    if (error) {
      response.end('elasticsearch cluster is down!');
    } else {
      // Fetches elastic search shard list
      listAndSortIndices(es_client, function(indexGroups) {
        var body = formatResponse(indexGroups);
        response.end(body);
      });
    }
  });
});


// Start server
server.listen(WEBAPP_PORT, function() {
  console.log("Server listening on: http://localhost:%s", WEBAPP_PORT);
});


// ------------------------------
// HTML FORMATTING
// ------------------------------

/**
 * Formats a list of indexGroups to html.
 *
 * @param  {Array.<Object>} indexGroups   List of indexGroups.
 * @return {string} Html body.
 */
var formatResponse = function(indexGroups) {
  var body = '<table style="font-family:monospace;">\n'
           + '<tr><td>shard id</td><td>p/r</td><td>index</td><td>index total memory size</td></tr>';

  indexGroups.forEach(function(indexGroup) {
    var indexName = indexGroup.indexName;
    var indexMemorySize = indexGroup.memory;

    indexGroup.shards.forEach(function(shardInfo) {
      var primary = (shardInfo.primary) ? 'p' : 'r';
      body += util.format('<tr> <td>%s</td><td>%s&nbsp;</td><td>%s</td><td>%s</td></tr>\n',
        shardInfo.id, primary, indexName, indexMemorySize);
    });
  });

  return body + '</table>';
};


// ------------------------------
// ES FUNCTIONS
// ------------------------------


/**
 * Formats a list of indexGroups to html.
 *
 * @param  {Object} client  Elastic search client.
 */
var listAndSortIndices = function(client, callback) {
  var indexGroups = [];

  client.indices.segments({}).then(function(resp) {
    for (var index in resp.indices) {
      var indexGroup = aggregateShards(resp.indices[index]);
      indexGroup.indexName = index;
      indexGroups.push(indexGroup);
    }

    indexGroups.sort(function(a, b) {
      if (a.memory < b.memory) {
        return -1;
      } else if (a.memory > b.memory) {
        return 1;
      }

      return 0;
    });

    callback(indexGroups);
  });
};


/**
 * From index info object, compute total segment memory size
 * and lists shards.
 *
 * @param  {Object} indexInfo   Index info object.
 * @return {{memory: number, shards: Object}}
 */
var aggregateShards = function(indexInfo) {
  var shardsById = indexInfo.shards;
  var totalMemory = 0;
  var shards = [];

  // Compute total segment memory size
  for (var shardId in shardsById) {

    // For each shard, we sum segments memory_size
    shardsById[shardId].forEach(function(shard) {
      totalMemory += sumSegmentsMemorySize(shard);

      shards.push({
        'id': shardId,
        'primary': shard.routing.state,
        'node': shard.routing.node
      });
    });
  }

  return {
    'memory': totalMemory,
    'shards': shards
  };
};


/**
 * From a shard object, computes total memory size.
 *
 * @param  {Object} shard   Shard object.
 * @return {number}         Total segment memory size.
 */
var sumSegmentsMemorySize = function(shard) {
  var segments = shard.segments;
  var totalMemorySize = 0;

  for (var s in segments) {
    totalMemorySize += segments[s].memory_in_bytes;
  }

  return totalMemorySize;
};
