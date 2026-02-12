// Frontend helpers for per-worktime-group access control.
//
// Permission module keys (same as backend):
//   worktimes_group:<vehicleType>:<categoryKey>

export const GROUP_MODULE_PREFIX = 'worktimes_group:';

export const makeWorktimesGroupModuleKey = (vehicleType, categoryKey) => {
  const vt = String(vehicleType || '').trim().toLowerCase() === 'trailer' ? 'trailer' : 'truck';
  const ck = String(categoryKey || '').trim();
  return `${GROUP_MODULE_PREFIX}${vt}:${ck}`;
};

// Default policy (backward compatible):
// - Admin: always allow.
// - "free_ops": always allow.
// - Missing explicit permission row => allow.
export const canAccessWorktimesGroup = ({ userRole, userPermissions, vehicleType, categoryKey }) => {
  if (String(userRole || '').trim() === 'admin') return true;
  if (String(categoryKey || '').trim() === 'free_ops') return true;

  const perms = Array.isArray(userPermissions) ? userPermissions : [];
  const key = makeWorktimesGroupModuleKey(vehicleType, categoryKey);
  const p = perms.find((x) => String(x?.module || '') === key);
  if (!p) return true;
  return Number(p.can_access_module) === 1;
};

export const filterCategoriesByGroupAccess = ({ categories, userRole, userPermissions, vehicleType }) => {
  const list = Array.isArray(categories) ? categories : [];
  return list.filter((c) =>
    canAccessWorktimesGroup({
      userRole,
      userPermissions,
      vehicleType,
      categoryKey: c?.key,
    })
  );
};

