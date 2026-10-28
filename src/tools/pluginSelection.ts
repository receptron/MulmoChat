export interface RoleRules {
  isPluginAvailableInRole: (toolName: string, roleId: string) => boolean;
  isRoleCustomizable: (roleId: string) => boolean;
}

// Whether the role and the user's toggles let a plugin in. Server credentials
// (plugin.isEnabled) are the caller's to check: getEnabledBackends skips them.
export const isPluginSelected = (
  toolName: string,
  enabledPlugins: Record<string, boolean> | undefined,
  roleId: string | undefined,
  roleRules: RoleRules,
): boolean => {
  if (!roleId) {
    return enabledPlugins?.[toolName] ?? true;
  }
  if (!roleRules.isPluginAvailableInRole(toolName, roleId)) {
    return false;
  }
  if (roleRules.isRoleCustomizable(roleId)) {
    return enabledPlugins?.[toolName] ?? true;
  }
  return true;
};
