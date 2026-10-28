import type { AgentTool, ToolSpec } from "@open-bpo/core";

export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

/**
 * Mock handlers keyed by tool name. Real integrations replace these entries;
 * the set of tools a model sees always comes from the recipe's tools.json.
 */
export const MOCK_TOOL_HANDLERS: Record<string, ToolHandler> = {
  async schedule_callback() { return "callback_scheduled"; },
  async crm_lookup() { return "crm_lookup_ok"; },
  async send_brochure() { return "brochure_sent"; },
  async account_summary() { return "account_summary_ok"; },
  async record_payment_status() { return "payment_status_recorded"; },
  async ticket_lookup() { return "ticket_status:open"; },
  async ticket_escalate() { return "ticket_escalated"; }
};

/** Binds recipe tool specs to handlers. Tools with no handler fall back to a generic mock. */
export function buildTools(specs: ToolSpec[], handlers: Record<string, ToolHandler> = MOCK_TOOL_HANDLERS): AgentTool[] {
  return specs.map((spec) => ({
    ...spec,
    run: handlers[spec.name] ?? (async () => `${spec.name}_mock_ok`)
  }));
}
