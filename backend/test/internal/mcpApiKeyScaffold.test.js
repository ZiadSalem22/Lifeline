const { buildAppDataSourceOptions } = require('../../src/infra/db/data-source-options');
const { hashMcpApiKeySecret, verifyMcpApiKeySecret } = require('../../src/utils/mcpApiKeys');

describe('MCP API key scaffolding', () => {
  it('registers the McpApiKey entity in the data source options', () => {
    const options = buildAppDataSourceOptions();
    const entityNames = (options.entities || []).map((entity) => entity.options?.name).filter(Boolean);

    expect(entityNames).toContain('McpApiKey');
  });

  it('hashes and verifies MCP API key secrets without storing plaintext', () => {
    const secret = 'lifeline-mcp-secret-value';
    const hash = hashMcpApiKeySecret(secret, 'pepper');

    expect(hash).not.toBe(secret);
    expect(verifyMcpApiKeySecret(secret, hash, 'pepper')).toBe(true);
    expect(verifyMcpApiKeySecret('wrong-secret', hash, 'pepper')).toBe(false);
  });
});
