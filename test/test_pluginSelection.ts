import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isPluginSelected, type RoleRules } from "../src/tools/pluginSelection";

const recordingRules = (
  available: Record<string, string[]>,
  customizable: Record<string, boolean>,
) => {
  const calls: string[] = [];
  const rules: RoleRules = {
    isPluginAvailableInRole: (toolName, roleId) => {
      calls.push(`available:${toolName}:${roleId}`);
      return available[roleId]?.includes(toolName) ?? false;
    },
    isRoleCustomizable: (roleId) => {
      calls.push(`customizable:${roleId}`);
      return customizable[roleId] ?? false;
    },
  };
  return { rules, calls };
};

const roles = recordingRules(
  { fixed: ["tool"], custom: ["tool"], empty: [] },
  { fixed: false, custom: true, empty: true },
);

// Toggles come from localStorage, so values other than booleans are possible.
const TOGGLES: [string, unknown][] = [
  ["true", true],
  ["false", false],
  ["0", 0],
  ["empty string", ""],
  ["null", null],
  ["missing", undefined],
  ["a string", "yes"],
];

// Parsed the way localStorage hands it back: typed as booleans, holding anything.
const togglesFor = (value: unknown): Record<string, boolean> =>
  value === undefined ? {} : JSON.parse(JSON.stringify({ tool: value }));

describe("isPluginSelected", () => {
  describe("without a role, and with an empty role id, the user's toggle decides", () => {
    for (const roleId of [undefined, ""]) {
      for (const [label, value] of TOGGLES) {
        it(`roleId=${JSON.stringify(roleId)}, toggle ${label}`, () => {
          const selected = isPluginSelected(
            "tool",
            togglesFor(value),
            roleId,
            roles.rules,
          );
          // A missing or null toggle means on; any other value counts by truthiness.
          assert.equal(Boolean(selected), Boolean(value ?? true));
        });
      }
    }
    it("no toggle map at all means on", () => {
      assert.equal(
        isPluginSelected("tool", undefined, undefined, roles.rules),
        true,
      );
    });
  });

  describe("a role that does not list the plugin rejects it whatever the toggle", () => {
    for (const [label, value] of TOGGLES) {
      it(`toggle ${label}`, () => {
        const { rules, calls } = recordingRules({ fixed: [] }, { fixed: true });
        assert.equal(
          isPluginSelected("tool", togglesFor(value), "fixed", rules),
          false,
        );
        assert.deepEqual(calls, ["available:tool:fixed"]);
      });
    }
  });

  describe("a fixed role that lists the plugin enables it, ignoring the toggle", () => {
    for (const [label, value] of TOGGLES) {
      it(`toggle ${label}`, () => {
        assert.equal(
          isPluginSelected("tool", togglesFor(value), "fixed", roles.rules),
          true,
        );
      });
    }
  });

  describe("a customizable role that lists the plugin defers to the toggle", () => {
    for (const [label, value] of TOGGLES) {
      it(`toggle ${label}`, () => {
        const selected = isPluginSelected(
          "tool",
          togglesFor(value),
          "custom",
          roles.rules,
        );
        assert.equal(Boolean(selected), Boolean(value ?? true));
      });
    }
  });

  it("asks the role about availability before customizability", () => {
    const { rules, calls } = recordingRules(
      { custom: ["tool"] },
      { custom: true },
    );
    isPluginSelected("tool", {}, "custom", rules);
    assert.deepEqual(calls, ["available:tool:custom", "customizable:custom"]);
  });
});
