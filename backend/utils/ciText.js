// Unicode-friendly, case-insensitive string helpers.
//
// Why: SQLite default NOCASE/LOWER/UPPER are ASCII-only unless built with ICU.
// For consistent case-insensitive search (Cyrillic/Latin/etc.), we filter in JS.

const normCi = (v) => {
  // NFKC reduces differences like compatibility forms.
  return String(v ?? '').normalize('NFKC').toLocaleLowerCase();
};

const ciIncludes = (haystack, needle) => {
  const n = normCi(needle).trim();
  if (!n) return true;
  return normCi(haystack).includes(n);
};

const ciEquals = (a, b) => normCi(a) === normCi(b);

module.exports = {
  normCi,
  ciIncludes,
  ciEquals,
};

