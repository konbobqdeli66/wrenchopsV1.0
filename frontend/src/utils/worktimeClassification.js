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

// Truck subcategories (as in the provided classification screenshots).
// Keys are numeric strings (e.g. "20") so they can be stored directly in DB as `component_type`.
// NOTE: Some numbers are intentionally missing (they are not present in the reference list).
export const TRUCK_SUBCATEGORIES_BY_CATEGORY_KEY = {
  regular: [
    { key: '11', no: 11, label: 'Детайли за закрепване, дистанциране, заключване и опора' },
    { key: '12', no: 12, label: 'Детайли за трансмисия, раздатка, управление, пружиниране и амортизация' },
    { key: '13', no: 13, label: 'Детайли за въртеливи движения' },
    { key: '14', no: 14, label: 'Детайли за транспорт и съхранение на течности и газове' },
    { key: '15', no: 15, label: 'Детайли за уплътняване, защита и маркиране' },
    { key: '16', no: 16, label: 'Електрически стандартни детайли' },
    { key: '17', no: 17, label: 'Сервиз и поддръжка' },
    { key: '18', no: 18, label: 'Грижа за каросерията, покрития и защита' },
    { key: '19', no: 19, label: 'Разни' },
  ],
  engine: [
    { key: '20', no: 20, label: 'Общо' },
    { key: '21', no: 21, label: 'Двигател' },
    { key: '22', no: 22, label: 'Смазочна и маслена система' },
    { key: '23', no: 23, label: 'Горивна система' },
    { key: '24', no: 24, label: 'Горивни системи, газова уредба' },
    { key: '25', no: 25, label: 'Всмукателна и изпускателна система. Турбо' },
    { key: '26', no: 26, label: 'Охладителна система' },
    { key: '27', no: 27, label: 'Управление на двигателя' },
    { key: '28', no: 28, label: 'Запалителна и управляващи системи' },
    { key: '29', no: 29, label: 'Разни' },
  ],
  electric: [
    { key: '30', no: 30, label: 'Общо' },
    { key: '31', no: 31, label: 'Акумулатор; система за съхранение на енергия; крепежни елементи' },
    { key: '32', no: 32, label: 'Алтернатор; зареждане; електромотор; електрически задвижвания' },
    { key: '33', no: 33, label: 'Стартерна система' },
    { key: '35', no: 35, label: 'Осветление' },
    { key: '36', no: 36, label: 'Друго електрическо оборудване' },
    { key: '37', no: 37, label: 'Кабели и предпазители' },
    { key: '38', no: 38, label: 'Уреди и прибори' },
    { key: '39', no: 39, label: 'Разни' },
  ],
  transmission: [
    { key: '40', no: 40, label: 'Общо' },
    { key: '41', no: 41, label: 'Съединител' },
    { key: '42', no: 42, label: 'Специална скоростна кутия' },
    { key: '43', no: 43, label: 'Скоростна кутия' },
    { key: '45', no: 45, label: 'Карданен вал' },
    { key: '46', no: 46, label: 'Преден мост, заден мост, полуоска' },
    { key: '47', no: 47, label: 'Трансмисия и крайно предаване (или централна предавка на преден мост) комбинирана система' },
    { key: '48', no: 48, label: 'Отбор на мощност (PTO)' },
    { key: '49', no: 49, label: 'Разни' },
  ],
  brakes: [
    { key: '50', no: 50, label: 'Общо' },
    { key: '51', no: 51, label: 'Колесни спирачки' },
    { key: '52', no: 52, label: 'Хидравлична/вакуумно-хидравлична спирачна система' },
    { key: '55', no: 55, label: 'Ръчна спирачка' },
    { key: '56', no: 56, label: 'Пневматични спирачки' },
    { key: '57', no: 57, label: 'Управление и връзки на спирачките на ремарке' },
    { key: '59', no: 59, label: 'Разни' },
  ],
  steering: [
    { key: '60', no: 60, label: 'Общо' },
    { key: '61', no: 61, label: 'Предно окачване' },
    { key: '64', no: 64, label: 'Управление' },
    { key: '65', no: 65, label: 'Задно окачване и окачване на допълнителен (водещ) мост' },
    { key: '69', no: 69, label: 'Разни' },
  ],
  suspension: [
    { key: '70', no: 70, label: 'Общо' },
    { key: '71', no: 71, label: 'Рама' },
    { key: '72', no: 72, label: 'Окачване' },
    { key: '76', no: 76, label: 'Амортисьори, стабилизиращи щанги, нивелиране и страничен контрол' },
    { key: '77', no: 77, label: 'Колела, гуми и главини' },
    { key: '79', no: 79, label: 'Разни' },
  ],
  cabin: [
    { key: '80', no: 80, label: 'Общо' },
    { key: '81', no: 81, label: 'Каросерия и конструкция на кабината' },
    { key: '82', no: 82, label: 'Капак (преден), предна част, калници, степенки' },
    { key: '83', no: 83, label: 'Врати и люкове' },
    { key: '84', no: 84, label: 'Външни облицовки, стъкла и уплътнения' },
    { key: '85', no: 85, label: 'Интериор' },
    { key: '86', no: 86, label: 'Защитно оборудване' },
    { key: '87', no: 87, label: 'Отопление, вентилация и климатизация (HVAC)' },
    { key: '88', no: 88, label: 'Вътрешно оборудване' },
    { key: '89', no: 89, label: 'Разни' },
  ],
  attachments: [
    { key: '90', no: 90, label: 'Общо' },
    { key: '91', no: 91, label: 'Хидравлични и серво системи за различни функции' },
    { key: '92', no: 92, label: 'Механично оборудване' },
    { key: '93', no: 93, label: 'Електрическо оборудване' },
    { key: '94', no: 94, label: 'Оборудване за товаро-разтоварни дейности, подемник за пътници' },
    { key: '95', no: 95, label: 'Товароносещи платформи. Инструкции за надстройки' },
    { key: '99', no: 99, label: 'Разни' },
  ],
};

export const TRAILER_CATEGORIES = [
  { key: 'regular', no: 1, label: 'Регулярно обслужване' },
  { key: 'electric', no: 2, label: 'Електрика' },
  { key: 'axles_brakes', no: 3, label: 'Оси/Спирачки' },
  { key: 'pneumatic', no: 4, label: 'Пневматична система' },
  { key: 'body', no: 5, label: 'Каросерия' },
];

export const getCategoriesForVehicleType = (vehicleType) =>
  vehicleType === 'trailer' ? TRAILER_CATEGORIES : TRUCK_CATEGORIES;

export const getSubcategoriesForCategoryKey = (vehicleType, categoryKey) => {
  if (vehicleType === 'trailer') return [];
  const list = TRUCK_SUBCATEGORIES_BY_CATEGORY_KEY[String(categoryKey || '').trim()] || [];
  return Array.isArray(list) ? list : [];
};

export const getCategoryByKey = (vehicleType, key) => {
  const list = getCategoriesForVehicleType(vehicleType);
  return list.find((c) => c.key === key) || null;
};

export const getSubcategoryByKey = (vehicleType, categoryKey, subKey) => {
  const list = getSubcategoriesForCategoryKey(vehicleType, categoryKey);
  return list.find((s) => s.key === subKey) || null;
};

const isNumericSubcategoryKey = (value) => /^\d{2}$/.test(String(value || '').trim());

// Map numeric subcategory keys (11..99) to the parent category.
export const mapSubcategoryKeyToCategoryKey = (vehicleType, subcategoryKey) => {
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

// Map legacy `component_type` (old schema values) to the new category keys.
// This keeps old data visible in the new UI.
export const mapLegacyComponentTypeToCategoryKey = (vehicleType, componentType) => {
  const ct = String(componentType || '').trim();
  if (!ct) return 'regular';

  // Numeric subcategory (new classification) -> map to parent category.
  const mapped = mapSubcategoryKeyToCategoryKey(vehicleType, ct);
  if (mapped) return mapped;

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

// Extract numeric subcategory key (if any) from a stored component_type.
export const mapComponentTypeToSubcategoryKey = (vehicleType, componentType) => {
  const ct = String(componentType || '').trim();
  if (!ct) return null;
  if (vehicleType === 'trailer') return null;
  if (isNumericSubcategoryKey(ct)) return ct;
  return null;
};

export const getWorktimeCategoryKey = (worktime, vehicleType) =>
  mapLegacyComponentTypeToCategoryKey(vehicleType, worktime?.component_type);

export const getWorktimeSubcategoryKey = (worktime, vehicleType) =>
  mapComponentTypeToSubcategoryKey(vehicleType, worktime?.component_type);

export const formatCategoryLabel = (vehicleType, keyOrLegacyComponentType) => {
  const raw = String(keyOrLegacyComponentType || '').trim();
  const key = mapLegacyComponentTypeToCategoryKey(vehicleType, raw);
  const cat = getCategoryByKey(vehicleType, key);

  // If it is a numeric subcategory, show "<category> / <subcategory>".
  const subKey = mapComponentTypeToSubcategoryKey(vehicleType, raw);
  if (cat && subKey) {
    const sub = getSubcategoryByKey(vehicleType, key, subKey);
    const subLabel = sub ? `${sub.no}. ${sub.label}` : subKey;
    return `${cat.no}. ${cat.label} / ${subLabel}`;
  }

  return cat ? `${cat.no}. ${cat.label}` : String(keyOrLegacyComponentType || '');
};

