(function exposeGlossaryUtils(root, factory) {
  const api = factory();
  root.PANSUB_GLOSSARY_UTILS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createGlossaryUtils() {
  function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function termPattern(term) {
    return new RegExp(`(^|[^A-Za-z0-9])(${escapeRegExp(term)})(?=$|[^A-Za-z0-9])`, 'gi');
  }

  function targetFor(entry, targetLanguage) {
    if (targetLanguage === 'zh-TW') return entry.zhTW || entry.zhCN || entry.zh || '';
    return entry.zhCN || entry.zh || entry.zhTW || '';
  }

  function glossaryCandidates(glossary, targetLanguage) {
    const candidates = [];
    for (const entry of glossary?.terms || []) {
      const target = targetFor(entry, targetLanguage);
      if (!target) continue;
      const terms = Array.isArray(entry.terms) ? entry.terms : [entry.term];
      for (const value of terms) {
        const term = typeof value === 'string' ? value.trim() : '';
        if (term.length > 1) candidates.push({ term, target });
      }
    }
    return candidates.sort((left, right) => right.term.length - left.term.length);
  }

  function protectGlossaryTerms(text, options = {}) {
    const glossary = options.glossary || { terms: [] };
    const targetLanguage = options.targetLanguage || 'zh-CN';
    const maxMatches = Number.isInteger(options.maxMatches) ? options.maxMatches : 8;
    const supported = options.enabled !== false
      && targetLanguage.startsWith('zh')
      && Array.isArray(glossary.terms)
      && glossary.terms.length > 0;
    if (!supported) return { text, replacements: [] };

    let protectedText = String(text);
    const replacements = [];
    const matchedTerms = new Set();

    for (const candidate of glossaryCandidates(glossary, targetLanguage)) {
      if (replacements.length >= maxMatches) break;
      const normalized = candidate.term.toLowerCase();
      if (matchedTerms.has(normalized)) continue;
      let found = false;
      protectedText = protectedText.replace(termPattern(candidate.term), (match, prefix) => {
        if (found) return match;
        found = true;
        matchedTerms.add(normalized);
        const placeholder = `PANSUBTERM${replacements.length}`;
        replacements.push({ placeholder, target: candidate.target, term: candidate.term });
        return `${prefix}${placeholder}`;
      });
    }

    return { text: protectedText, replacements };
  }

  function restoreGlossaryTerms(text, replacements = []) {
    let restored = String(text || '');
    for (const replacement of replacements) {
      restored = restored.replace(
        new RegExp(escapeRegExp(replacement.placeholder), 'gi'),
        replacement.target
      );
    }
    return restored;
  }

  return Object.freeze({ protectGlossaryTerms, restoreGlossaryTerms });
});
