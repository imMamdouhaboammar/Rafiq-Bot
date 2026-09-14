import assert from 'node:assert/strict';
import {
  classifyConversationRoute,
  compileConversationRouteInstruction,
} from '../services/conversationRouter.js';

// 1. Route Classification for Stories
const storyRoutes = [
  'احكيلي قصة عن راجل عجوز في السيدة زينب',
  'ألف قصة رعب بالراحة خالص',
  'اكتبلي حكاية slow burn عن الغربة',
  'عايز حدوتة قبل النوم',
  'كمل الحكاية يا رفيق',
];

for (const phrase of storyRoutes) {
  const route = classifyConversationRoute(phrase);
  assert.equal(route.id, 'slow-burn-story', `Failed for phrase: "${phrase}"`);
  assert.equal(route.label, 'Slow Burn Story');
  assert.match(route.firstPriority, /sensory detail/i);
}

// 2. Route Instruction Compilation
const route = classifyConversationRoute('احكيلي قصة');
const instruction = compileConversationRouteInstruction(route);
assert.match(instruction, /CONTEXT ROUTE: Slow Burn Story/);
assert.match(instruction, /First Priority:/);
assert.match(instruction, /Second Priority:/);

// 3. Regular routes are unaffected
assert.equal(classifyConversationRoute('الساعة كام؟').id, 'direct-question');
assert.equal(classifyConversationRoute('أنا متضايق ومخنوق اوي').id, 'venting');
assert.equal(classifyConversationRoute('هههههه جامدة يا صاحبي').id, 'banter');

console.log('Conversation Router Story tests passed successfully!');
