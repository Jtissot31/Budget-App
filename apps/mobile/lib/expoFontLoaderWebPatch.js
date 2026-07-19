/**
 * Patched expo-font web loader — default FontFaceObserver timeout (6000ms) is too
 * aggressive when loading 8+ Google fonts plus vector icon fonts in dev/web preview.
 */
import { CodedError, registerWebModule } from 'expo-modules-core';
import FontObserver from 'fontfaceobserver';
import { FontDisplay } from 'expo-font/build/Font.types';

const WEB_FONT_LOAD_TIMEOUT_MS = 30_000;

function getFontFaceStyleSheet() {
  if (typeof window === 'undefined') {
    return null;
  }
  const styleSheet = getStyleElement();
  return styleSheet.sheet ? styleSheet.sheet : null;
}

function getFontFaceRules() {
  const sheet = getFontFaceStyleSheet();
  if (sheet) {
    const rules = [...sheet.cssRules];
    const items = [];
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (rule instanceof CSSFontFaceRule) {
        items.push({ rule, index: i });
      }
    }
    return items;
  }
  return [];
}

function getFontFaceRulesMatchingResource(fontFamilyName, options) {
  const rules = getFontFaceRules();
  return rules.filter(({ rule }) => {
    return (
      rule.style.fontFamily === fontFamilyName &&
      (options && options.display ? options.display === rule.style.fontDisplay : true)
    );
  });
}

const serverContext = new Set();

function getHeadElements() {
  const entries = [...serverContext.entries()];
  if (!entries.length) {
    return [];
  }
  const css = entries.map(([{ css }]) => css).join('\n');
  const links = entries.map(([{ resourceId }]) => resourceId);
  return [
    {
      $$type: 'style',
      children: css,
      id: ID,
      type: 'text/css',
    },
    ...links.map((resourceId) => ({
      $$type: 'link',
      rel: 'preload',
      href: resourceId,
      as: 'font',
      crossorigin: '',
    })),
  ];
}

async function waitForFontFace(fontFamilyName) {
  if (typeof document === 'undefined' || !document.fonts) return false;
  await document.fonts.ready;
  let found = false;
  document.fonts.forEach((face) => {
    if (face.family === fontFamilyName) found = true;
  });
  return found;
}

const ExpoFontLoader = {
  async unloadAllAsync() {
    if (typeof window === 'undefined') return;
    const element = document.getElementById(ID);
    if (element && element instanceof HTMLStyleElement) {
      document.removeChild(element);
    }
  },
  async unloadAsync(fontFamilyName, options) {
    const sheet = getFontFaceStyleSheet();
    if (!sheet) return;
    const items = getFontFaceRulesMatchingResource(fontFamilyName, options);
    for (const item of items) {
      sheet.deleteRule(item.index);
    }
  },
  getServerResources() {
    const elements = getHeadElements();
    return elements
      .map((element) => {
        switch (element.$$type) {
          case 'style':
            return `<style id="${element.id}">${element.children}</style>`;
          case 'link':
            return `<link rel="${element.rel}" href="${element.href}" as="${element.as}" crossorigin="${element.crossorigin}" />`;
          default:
            return '';
        }
      })
      .filter(Boolean);
  },
  resetServerContext() {
    serverContext.clear();
  },
  getLoadedFonts() {
    if (typeof window === 'undefined') {
      return [...serverContext.values()].map(({ name }) => name);
    }
    const rules = getFontFaceRules();
    return rules.map(({ rule }) => rule.style.fontFamily);
  },
  isLoaded(fontFamilyName, resource = {}) {
    if (typeof window === 'undefined') {
      return !![...serverContext.values()].find((asset) => asset.name === fontFamilyName);
    }
    return getFontFaceRulesMatchingResource(fontFamilyName, resource)?.length > 0;
  },
  loadAsync(fontFamilyName, resource) {
    if (__DEV__ && typeof resource !== 'object') {
      throw new CodedError(
        'ERR_FONT_SOURCE',
        `Expected font resource of type \`object\` instead got: ${typeof resource}`,
      );
    }
    if (typeof window === 'undefined') {
      serverContext.add({
        name: fontFamilyName,
        css: _createWebFontTemplate(fontFamilyName, resource),
        resourceId: resource.uri,
      });
      return Promise.resolve();
    }

    const canInjectStyle = document.head && typeof document.head.appendChild === 'function';
    if (!canInjectStyle) {
      throw new CodedError(
        'ERR_WEB_ENVIRONMENT',
        `The browser's \`document.head\` element doesn't support injecting fonts.`,
      );
    }

    const style = getStyleElement();
    document.head.appendChild(style);

    const res = getFontFaceRulesMatchingResource(fontFamilyName, resource);
    if (!res.length) {
      _createWebStyle(fontFamilyName, resource);
    }

    if (!isFontLoadingListenerSupported()) {
      return Promise.resolve();
    }

    return new FontObserver(fontFamilyName, {
      display: resource.display,
    })
      .load(null, WEB_FONT_LOAD_TIMEOUT_MS)
      .catch(async () => {
        if (await waitForFontFace(fontFamilyName)) return;
        throw new Error(`${WEB_FONT_LOAD_TIMEOUT_MS}ms timeout exceeded`);
      });
  },
};

const isServer = process.env.EXPO_OS === 'web' && typeof window === 'undefined';

function createExpoFontLoader() {
  return ExpoFontLoader;
}

const toExport = isServer ? ExpoFontLoader : registerWebModule(createExpoFontLoader, 'ExpoFontLoader');

export default toExport;

const ID = 'expo-generated-fonts';

function getStyleElement() {
  const element = document.getElementById(ID);
  if (element && element instanceof HTMLStyleElement) {
    return element;
  }
  const styleElement = document.createElement('style');
  styleElement.id = ID;
  return styleElement;
}

const CSS_IDENT_RE = /^[a-zA-Z_-][\w-]*$/;

export function _createWebFontTemplate(fontFamily, resource) {
  const display =
    typeof resource.display === 'string' && CSS_IDENT_RE.test(resource.display)
      ? resource.display
      : FontDisplay.AUTO;
  return `@font-face{font-family:${JSON.stringify(fontFamily)};src:url(${JSON.stringify(
    resource.uri,
  )});font-display:${display}}`;
}

function _createWebStyle(fontFamily, resource) {
  const fontStyle = _createWebFontTemplate(fontFamily, resource);
  const styleElement = getStyleElement();
  if (styleElement.styleSheet) {
    const styleElementIE = styleElement;
    styleElementIE.styleSheet.cssText = styleElementIE.styleSheet.cssText
      ? styleElementIE.styleSheet.cssText + fontStyle
      : fontStyle;
  } else {
    const textNode = document.createTextNode(fontStyle);
    styleElement.appendChild(textNode);
  }
  return styleElement;
}

function isFontLoadingListenerSupported() {
  const { userAgent } = window.navigator;
  const isIOS = !!userAgent.match(/iPad|iPhone/i);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isEdge = userAgent.includes('Edge');
  const isIE = userAgent.includes('Trident');
  const isFirefox = userAgent.includes('Firefox');
  return !isSafari && !isIOS && !isEdge && !isIE && !isFirefox;
}
