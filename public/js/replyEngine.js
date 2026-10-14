/**
 * Reply engine interface. The UI only talks to `replyEngine`.
 * Today it is the local rule engine (no AI, no network). To add an AI later, build an object with the same
 * methods and call setReplyEngine(myAiEngine), with no UI changes needed.
 *
 *   generate(message, options) -> Promise<{ analysis, replies[], advice, ... }>
 *   rephrase(text, mode, options) -> Promise<{ text }>
 */
import * as rules from './engine.js';

export const localRuleEngine = {
  name: 'local-rules',
  async generate(message, options = {}) { return { ...rules.generate(message, options), source: 'local' }; },
  async rephrase(text, mode, options = {}) { return { text: rules.transform(text, mode, options), source: 'local' }; },
  detect(message, options = {}) { return rules.detectIntent(message, options); },
};

export let replyEngine = localRuleEngine;
export function setReplyEngine(engine) { replyEngine = engine; }
