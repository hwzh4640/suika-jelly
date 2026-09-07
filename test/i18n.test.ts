import { describe, it, expect } from 'vitest';
import { en } from '../src/i18n/en';
import { zhCN } from '../src/i18n/zh-CN';
import { zhTW } from '../src/i18n/zh-TW';
import { matchLang, detectLang, setLang, t } from '../src/i18n/index';
import { FRUITS } from '../src/game/fruits';

describe('i18n', () => {
  it('all languages have identical key sets and matching placeholders', () => {
    const keys = Object.keys(en).sort();
    for (const table of [zhCN, zhTW]) {
      expect(Object.keys(table).sort()).toEqual(keys);
      for (const k of keys) {
        const ph = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort();
        expect(ph((table as Record<string, string>)[k]!)).toEqual(ph((en as Record<string, string>)[k]!));
      }
    }
  });
  it('has a name for every fruit', () => {
    for (const f of FRUITS) expect(en[`fruit.${f.key}`]).toBeTruthy();
  });
  it('matches BCP-47 tags', () => {
    expect(matchLang('zh-TW')).toBe('zh-TW');
    expect(matchLang('zh-Hant-HK')).toBe('zh-TW');
    expect(matchLang('zh-CN')).toBe('zh-CN');
    expect(matchLang('zh')).toBe('zh-CN');
    expect(matchLang('en-GB')).toBe('en');
    expect(matchLang('fr')).toBeNull();
  });
  it('detects from query, then navigator, then defaults to en', () => {
    expect(detectLang('?lang=zh-TW', ['en'])).toBe('zh-TW');
    expect(detectLang('', ['fr', 'zh-CN'])).toBe('zh-CN');
    expect(detectLang('', ['de'])).toBe('en');
  });
  it('translates', () => {
    setLang('zh-TW', false);
    expect(t('fruit.pineapple')).toBe('鳳梨');
    setLang('en', false);
    expect(t('fruit.pineapple')).toBe('Pineapple');
  });
});
