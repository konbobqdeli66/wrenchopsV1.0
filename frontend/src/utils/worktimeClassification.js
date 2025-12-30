// Worktime classification (category) definitions.
//
// Requirements:
// - Trucks (automobiles): 9 groups
// - Trailers: 5 groups
// - Backward-compatible mapping for legacy `component_type` values

export const TRUCK_CATEGORIES = [
  { key: 'regular', no: 1, label: 'Регулярно обслужване' },
  { key: 'engine', no: 2, label: 'Двигател' },
  { key: 'electric', no: 3, label: 'Електрика' },
  { key: 'transmission', no: 4, label: 'Предавателна система' },
  { key: 'brakes', no: 5, label: 'Спирачна система' },
  { key: 'steering', no: 6, label: 'Завиване и управление' },
  { key: 'suspension', no: 7, label: 'Окачване' },
  { key: 'cabin', no: 8, label: 'Кабина' },
  { key: 'attachments', no: 9, label: 'Прикачни елементи' },
];

export const TRAILER_CATEGORIES = [
  { key: 'regular', no: 1, label: 'Регулярно обслужване' },
  { key: 'electric', no: 2, label: 'Електрика' },
  { key: 'axles_brakes', no: 3, label: 'Оси/Спирачки' },
  { key: 'pneumatic', no: 4, label: 'Пневматична система' },
  { key: 'body', no: 5, label: 'Каросерия' },
];

export const getCategoriesForVehicleType = (vehicleType) =>
  vehicleType === 'trailer' ? TRAILER_CATEGORIES : TRUCK_CATEGORIES;

export const getCategoryByKey = (vehicleType, key) => {
  const list = getCategoriesForVehicleType(vehicleType);
  return list.find((c) => c.key === key) || null;
};

// Map legacy `component_type` (old schema values) to the new category keys.
// This keeps old data visible in the new UI.
export const mapLegacyComponentTypeToCategoryKey = (vehicleType, componentType) => {
  const ct = String(componentType || '').trim();
  if (!ct) return 'regular';

  // If the value is already a new category key, keep it.
  const allowedKeys = new Set(getCategoriesForVehicleType(vehicleType).map((c) => c.key));
  if (allowedKeys.has(ct)) return ct;

  // Legacy values coming from the DB
  // worktimes.component_type used to be one of:
  // cabin | chassis | front_axle | rear_axle | engine | transmission
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

  // Truck
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

export const getWorktimeCategoryKey = (worktime, vehicleType) =>
  mapLegacyComponentTypeToCategoryKey(vehicleType, worktime?.component_type);

export const formatCategoryLabel = (vehicleType, keyOrLegacyComponentType) => {
  const key = mapLegacyComponentTypeToCategoryKey(vehicleType, keyOrLegacyComponentType);
  const cat = getCategoryByKey(vehicleType, key);
  return cat ? `${cat.no}. ${cat.label}` : String(keyOrLegacyComponentType || '');
};

