// Unicode-friendly, case-insensitive search helpers.

export const normCi = (v) => {
  return String(v ?? '').normalize('NFKC').toLocaleLowerCase();
};

export const ciIncludes = (haystack, needle) => {
  const n = normCi(needle).trim();
  if (!n) return true;
  return normCi(haystack).includes(n);
};

