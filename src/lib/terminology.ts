import { publicLanguagePack, term as languageTerm } from "@/lib/language-pack";

export type TerminologyKey = keyof typeof publicLanguagePack.terminology;

export const terminology = publicLanguagePack.terminology;

export function term(key: TerminologyKey) {
  return languageTerm(String(key));
}
