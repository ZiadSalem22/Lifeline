import { Router } from 'express';
import type { OpenApiRegistry } from '../openapi/registry.js';

/**
 * API documentation routes:
 * - GET /api/docs/openapi.json — OpenAPI 3.1 document from the route registry.
 * - GET /api/docs — self-contained HTML viewer (inline CSS/JS, NO external
 *   CDN — the strict CSP stays intact). Fetches the JSON and renders a
 *   readable endpoint list with expandable request/response schemas.
 */
export function createDocsRouter(
  registry: OpenApiRegistry,
  info: { title: string; version: string },
): Router {
  const router = Router();

  router.get('/openapi.json', (_req, res) => {
    res.json(registry.buildDocument(info));
  });

  router.get('/', (_req, res) => {
    res.type('html').send(DOCS_HTML);
  });

  return router;
}

const DOCS_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Lifeline API docs</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 2rem 1rem; max-width: 900px; margin-inline: auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; margin: 0 0 0.25rem; }
  .muted { opacity: 0.65; font-size: 0.85rem; }
  .tag-group { margin-top: 2rem; }
  .tag-group > h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.75; border-bottom: 1px solid rgba(128,128,128,0.35); padding-bottom: 0.3rem; }
  details { border: 1px solid rgba(128,128,128,0.3); border-radius: 8px; margin: 0.5rem 0; overflow: hidden; }
  summary { display: flex; gap: 0.75rem; align-items: center; padding: 0.55rem 0.75rem; cursor: pointer; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  .method { font-weight: 700; font-size: 0.72rem; padding: 0.15rem 0.5rem; border-radius: 4px; color: #fff; min-width: 3.6rem; text-align: center; }
  .get { background: #2563eb; } .post { background: #16a34a; } .put { background: #d97706; } .patch { background: #9333ea; } .delete { background: #dc2626; }
  .path { font-family: ui-monospace, monospace; font-size: 0.9rem; }
  .summary-text { opacity: 0.75; font-size: 0.85rem; margin-left: auto; text-align: right; }
  .body { padding: 0.25rem 0.9rem 0.9rem; border-top: 1px solid rgba(128,128,128,0.2); }
  .body h4 { margin: 0.75rem 0 0.25rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; }
  pre { background: rgba(128,128,128,0.12); padding: 0.6rem; border-radius: 6px; overflow-x: auto; font-size: 0.78rem; margin: 0.25rem 0; }
  .error { color: #dc2626; }
</style>
</head>
<body>
<h1>Lifeline API</h1>
<p class="muted">Endpoint reference generated from the zod route registry.
Raw spec: <a href="/api/docs/openapi.json">openapi.json</a></p>
<div id="root"><p class="muted">Loading…</p></div>
<script>
(function () {
  'use strict';
  var root = document.getElementById('root');
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function schemaBlock(container, label, schema) {
    if (!schema) return;
    container.appendChild(el('h4', null, label));
    var pre = el('pre');
    pre.textContent = JSON.stringify(schema, null, 2);
    container.appendChild(pre);
  }
  fetch('/api/docs/openapi.json')
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function (doc) {
      root.textContent = '';
      var header = el('p', 'muted', 'Version ' + (doc.info && doc.info.version ? doc.info.version : '?'));
      root.appendChild(header);
      var groups = {};
      Object.keys(doc.paths || {}).forEach(function (path) {
        Object.keys(doc.paths[path]).forEach(function (method) {
          var op = doc.paths[path][method];
          var tag = (op.tags && op.tags[0]) || 'other';
          (groups[tag] = groups[tag] || []).push({ path: path, method: method, op: op });
        });
      });
      Object.keys(groups).sort().forEach(function (tag) {
        var section = el('div', 'tag-group');
        section.appendChild(el('h2', null, tag));
        groups[tag].forEach(function (entry) {
          var details = el('details');
          var summary = el('summary');
          summary.appendChild(el('span', 'method ' + entry.method, entry.method.toUpperCase()));
          summary.appendChild(el('span', 'path', entry.path));
          summary.appendChild(el('span', 'summary-text', entry.op.summary || ''));
          details.appendChild(summary);
          var body = el('div', 'body');
          (entry.op.parameters || []).length && (function () {
            body.appendChild(el('h4', null, 'Parameters'));
            var pre = el('pre');
            pre.textContent = JSON.stringify(entry.op.parameters, null, 2);
            body.appendChild(pre);
          })();
          if (entry.op.requestBody && entry.op.requestBody.content) {
            var reqSchema = (entry.op.requestBody.content['application/json'] || {}).schema;
            schemaBlock(body, 'Request body', reqSchema);
          }
          Object.keys(entry.op.responses || {}).forEach(function (status) {
            var response = entry.op.responses[status];
            var label = status + ' — ' + (response.description || '');
            var respSchema = response.content && response.content['application/json']
              ? response.content['application/json'].schema
              : null;
            if (respSchema) schemaBlock(body, label, respSchema);
            else body.appendChild(el('h4', null, label));
          });
          details.appendChild(body);
          section.appendChild(details);
        });
        root.appendChild(section);
      });
    })
    .catch(function (error) {
      root.textContent = '';
      root.appendChild(el('p', 'error', 'Failed to load the OpenAPI document: ' + error.message));
    });
})();
</script>
</body>
</html>`;
