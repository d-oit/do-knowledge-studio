/**
 * MCP server factory: wires tool definitions and Zod-validated handlers to
 * the low-level Server over stdio. Pure factory (no process I/O) so the
 * contract test can drive it over InMemoryTransport.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { LibraryIndex } from './library-index.js'
import { toolDefinitions, toolHandlers } from './tool-definitions.js'

/** Server name advertised during MCP initialization. */
const SERVER_NAME = 'dks-mcp'
/** Server version (mirrors the package version). */
const SERVER_VERSION = '0.1.0'

/**
 * Creates a read-only MCP server over the given index.
 * @param index - Loaded library index backing every tool.
 * @returns The configured server (unconnected).
 */
export const createServer = (index: LibraryIndex): Server => {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  )
  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: toolDefinitions }))
  server.setRequestHandler(CallToolRequestSchema, (request) => {
    const handler = toolHandlers[request.params.name]
    if (!handler) {
      return {
        content: [{ type: 'text', text: `Unknown tool "${request.params.name}".` }],
        isError: true,
      }
    }
    return handler(request.params.arguments, index)
  })
  return server
}

/**
 * Connects a server to stdio and blocks until the client disconnects.
 * @param server - Server built by createServer.
 */
export const serveStdio = async (server: Server): Promise<void> => {
  await server.connect(new StdioServerTransport())
}
