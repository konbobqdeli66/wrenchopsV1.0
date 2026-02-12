// Backend-only helpers for per-group access control of worktimes.
//
// We store group permissions in the existing `permissions` table using module keys:
//   worktimes_group:<vehicleType>:<categoryKey>
// Example:
//   worktimes_group:truck:engine
//   worktimes_group:trailer:axles_brakes

const GROUP_MODULE_PREFIX = 'worktimes_group:';

const isNumericSubcategoryKey = (value) => /^\d{2}$/.test(String(value || '').trim());

// Map numeric subcategory keys (11..99) to the parent category (truck only)
const mapSubcategoryKeyToCategoryKey = (vehicleType, subcategoryKey) => {
  if (vehicleType === 'trailer') return null;
  const s = String(subcategoryKey || '').trim();
  if (!isNumericSubcategoryKey(s)) return null;
  const n = Number(s);
  if (n >= 11 && n <= 19) return 'regular';
  if (n >= 20 && n <= 29) return 'engine';
  if (n >= 30 && n <= 39) return 'electric';
  if (n >= 40 && n <= 49) return 'transmission';
  if (n >= 50 && n <= 59) return 'brakes';
  if (n >= 60 && n <= 69) return 'steering';
  if (n >= 70 && n <= 79) return 'suspension';
  if (n >= 80 && n <= 89) return 'cabin';
  if (n >= 90 && n <= 99) return 'attachments';
  return null;
};

// Map stored component_type to category key (truck + trailer), including legacy values.
const mapComponentTypeToCategoryKey = (vehicleType, componentType) => {
  const ct = String(componentType || '').trim();
  if (!ct) return 'regular';

  // Numeric subgroup -> parent category.
  const mapped = mapSubcategoryKeyToCategoryKey(vehicleType, ct);
  if (mapped) return mapped;

  // New keys (stored directly)
  // Note: for trailers we store category keys directly.
  // For trucks we may store category keys (e.g. free_ops) as well.
  if (ct === 'regular') return 'regular';
  if (ct === 'engine') return 'engine';
  if (ct === 'electric') return 'electric';
  if (ct === 'transmission') return 'transmission';
  if (ct === 'brakes') return 'brakes';
  if (ct === 'steering') return 'steering';
  if (ct === 'suspension') return 'suspension';
  if (ct === 'cabin') return 'cabin';
  if (ct === 'attachments') return 'attachments';
  if (ct === 'free_ops') return 'free_ops';
  if (ct === 'external_services') return 'external_services';

  // Trailer-specific keys
  if (vehicleType === 'trailer') {
    if (ct === 'axles_brakes') return 'axles_brakes';
    if (ct === 'pneumatic') return 'pneumatic';
    if (ct === 'body') return 'body';
  }

  // Legacy values coming from the DB.
  // Old schema used: cabin | chassis | front_axle | rear_axle | engine | transmission
  if (vehicleType === 'trailer') {
    switch (ct) {
      case 'engine':
      case 'transmission':
      case 'cabin':
        return 'electric';
      case 'front_axle':
      case 'rear_axle':
        return 'axles_brakes';
      case 'chassis':
        return 'pneumatic';
      default:
        return 'regular';
    }
  }

  // Truck legacy
  switch (ct) {
    case 'engine':
      return 'engine';
    case 'transmission':
      return 'transmission';
    case 'cabin':
      return 'cabin';
    case 'front_axle':
      return 'steering';
    case 'rear_axle':
      return 'attachments';
    case 'chassis':
      return 'suspension';
    default:
      return 'regular';
  }
};

const makeWorktimesGroupModuleKey = (vehicleType, categoryKey) => {
  const vt = String(vehicleType || '').trim().toLowerCase() === 'trailer' ? 'trailer' : 'truck';
  const ck = String(categoryKey || '').trim();
  return `${GROUP_MODULE_PREFIX}${vt}:${ck}`;
};

const loadWorktimesGroupPermissionsMap = (db, userId) =>
  new Promise((resolve) => {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return resolve({});

    db.all(
      `SELECT module, can_access_module
       FROM permissions
       WHERE user_id = ? AND module LIKE ?`,
      [id, `${GROUP_MODULE_PREFIX}%`],
      (err, rows) => {
        if (err) return resolve({});
        const map = {};
        (rows || []).forEach((r) => {
          if (!r?.module) return;
          map[String(r.module)] = Number(r.can_access_module) === 1 ? 1 : 0;
        });
        resolve(map);
      }
    );
  });

// Default policy (backward compatible):
// - Admin: always allow.
// - If there is NO explicit group permission row -> allow.
// - If there IS an explicit row -> respect can_access_module.
const canAccessWorktimesGroup = ({ user, groupPermsMap, vehicleType, categoryKey }) => {
  if (String(user?.role || '').trim() === 'admin') return true;
  // Per requirements: "Свободни Операции" must be editable by all users.
  if (String(categoryKey || '').trim() === 'free_ops') return true;
  const key = makeWorktimesGroupModuleKey(vehicleType, categoryKey);
  if (!groupPermsMap || typeof groupPermsMap !== 'object') return true;
  if (!(key in groupPermsMap)) return true;
  return Number(groupPermsMap[key]) === 1;
};

const filterRowsByGroupAccess = ({ user, groupPermsMap, rows, getVehicleType, getComponentType }) => {
  const list = Array.isArray(rows) ? rows : [];
  return list.filter((r) => {
    const vt = String(getVehicleType(r) || '').trim().toLowerCase() === 'trailer' ? 'trailer' : 'truck';
    const ct = getComponentType(r);
    const catKey = mapComponentTypeToCategoryKey(vt, ct);
    return canAccessWorktimesGroup({ user, groupPermsMap, vehicleType: vt, categoryKey: catKey });
  });
};

module.exports = {
  mapComponentTypeToCategoryKey,
  makeWorktimesGroupModuleKey,
  loadWorktimesGroupPermissionsMap,
  canAccessWorktimesGroup,
  filterRowsByGroupAccess,
};

