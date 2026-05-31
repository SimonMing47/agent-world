"use client";

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useEffect,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import {
  defaultLanguagePack,
  translateWithPack,
  type LanguagePack,
} from "@/lib/language-pack";

const LanguagePackContext = createContext<LanguagePack>(defaultLanguagePack);
const localizableAttributes = ["aria-label", "title", "placeholder", "alt"] as const;
const skippedTextParents = new Set(["SCRIPT", "STYLE", "TEXTAREA"]);
const inlineLanguageKeyPattern =
  /\b(?:actions|agent|agentDefinition|agentTeam|agentTeams|agents|businessTeams|common|console|developmentAccess|identityAccess|knowledge|labels|nav|overview|providerProfile|runtimeBinding|settings|teamWallboard|terminology|ui)\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+\b/g;

function preserveOuterWhitespace(value: string, nextValue: string) {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  return `${leading}${nextValue}${trailing}`;
}

function localizeTextValue(value: string, languagePack: LanguagePack) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const translated = translateWithPack(languagePack, trimmed);
  if (translated !== trimmed) return preserveOuterWhitespace(value, translated);

  let changed = false;
  const replaced = value.replace(inlineLanguageKeyPattern, (key) => {
    const nextValue = translateWithPack(languagePack, key);
    if (nextValue === key) return key;
    changed = true;
    return nextValue;
  });

  return changed ? replaced : value;
}

function localizeElementAttributes(element: Element, languagePack: LanguagePack) {
  for (const attribute of localizableAttributes) {
    const value = element.getAttribute(attribute);
    if (!value) continue;
    const translated = localizeTextValue(value, languagePack);
    if (translated !== value) element.setAttribute(attribute, translated);
  }
}

function localizeDomTree(root: ParentNode, languagePack: LanguagePack) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      const parent = current.parentElement;
      if (parent && skippedTextParents.has(parent.tagName)) {
        current = walker.nextNode();
        continue;
      }
      const value = current.nodeValue ?? "";
      const translated = localizeTextValue(value, languagePack);
      if (translated !== value) current.nodeValue = translated;
    } else if (current instanceof Element) {
      localizeElementAttributes(current, languagePack);
    }
    current = walker.nextNode();
  }
}

function LanguagePackDomLocalizer({ languagePack }: { languagePack: LanguagePack }) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        localizeDomTree(document.body, languagePack);
      });
    };

    schedule();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "characterData" ||
          mutation.type === "childList" ||
          (mutation.type === "attributes" &&
            localizableAttributes.includes(mutation.attributeName as typeof localizableAttributes[number]))
        ) {
          schedule();
          break;
        }
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [...localizableAttributes],
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [languagePack]);

  return null;
}

export function LanguagePackProvider({
  languagePack,
  children,
}: {
  languagePack: LanguagePack;
  children: ReactNode;
}) {
  return (
    <LanguagePackContext.Provider value={languagePack}>
      {children}
      <LanguagePackDomLocalizer languagePack={languagePack} />
    </LanguagePackContext.Provider>
  );
}

export function useLanguagePack() {
  return useContext(LanguagePackContext);
}

export function useLanguageText() {
  const languagePack = useLanguagePack();
  return useCallback(
    (keyOrPhrase: string, fallback?: string, params?: Record<string, string | number>) =>
      translateWithPack(languagePack, keyOrPhrase, fallback, params),
    [languagePack],
  );
}

export function localizeNode(
  node: ReactNode,
  text: (keyOrPhrase: string, fallback?: string) => string,
): ReactNode {
  if (typeof node === "string") {
    const trimmed = node.trim();
    if (!trimmed) return node;
    const leading = node.match(/^\s*/)?.[0] ?? "";
    const trailing = node.match(/\s*$/)?.[0] ?? "";
    return `${leading}${text(trimmed)}${trailing}`;
  }
  if (Array.isArray(node)) return Children.map(node, (child) => localizeNode(child, text));
  if (isValidElement<Record<string, unknown> & { children?: ReactNode }>(node)) {
    const nextProps: Record<string, unknown> = {};
    for (const propName of [...localizableAttributes, "label", "hint", "eyebrow", "description"]) {
      const value = node.props[propName];
      if (typeof value === "string") nextProps[propName] = text(value);
    }
    if (node.props.children) {
      nextProps.children = localizeNode(node.props.children, text);
    }
    return Object.keys(nextProps).length > 0 ? cloneElement(node, nextProps) : node;
  }
  return node;
}
