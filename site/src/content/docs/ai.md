---
title: AI agents
description: How agents drive Pargar through the same commands humans use.
---

Pargar was designed with AI agents as users from the start, not as a plugin added later. The idea is simple: if every operation is already a typed command, an agent needs no special access. It calls the same commands a person triggers from the toolbar.

## Every operation is a command

The kernel exposes one entry point that takes a JSON command and returns a JSON result. A command carries the **actor** that issued it, human or agent, and the resulting events land in the same hash-chained log. Agent edits undo like any other edit, and the log shows who did what.

## MCP tools

[`packages/mcp`](https://github.com/mbaneshi/pargar/tree/dev/packages/mcp) runs a [Model Context Protocol](https://modelcontextprotocol.io) server. Its `tool-definitions.ts` is the canonical list of 90+ tools, grouped by category:

| Category | Examples |
|---|---|
| draw | `draw_line`, `draw_circle`, `draw_polyline`, `draw_hatch`, `draw_dimension` |
| edit | move, copy, rotate, trim, offset, fillet, array |
| query / measure | find entities, read properties, measure distances and areas |
| layer, style, block | layers, text and dimension styles, blocks and groups |
| constraint | horizontal, parallel, coincident, distance and more |
| view, UCS | named views and coordinate systems |

Each tool has a name, a description, typed parameters and a mapping to a kernel command. Any MCP-capable client can use them.

## The in-app agent loop

The app has an agent panel that runs the tool-calling loop **in the browser**, next to the kernel, so tool calls don't round-trip through a server. It builds context from the current drawing, sends the request with the tool schemas, executes the returned tool calls against the kernel and shows each step. In development it can talk to a model running on your own machine.

:::note
A hosted AI assistant in the app is being wired up. Until it ships, the MCP server and the local agent loop are the ways to drive Pargar with an agent.
:::

## Why this order

AI sits **on top** of the 2D product, not in place of it. The [roadmap](/pargar/roadmap/) ships solid 2D drafting first; because the tool layer already exists, the AI phase after launch is mostly UX: a chat bar, multi-step flows, and an action log you can replay.
