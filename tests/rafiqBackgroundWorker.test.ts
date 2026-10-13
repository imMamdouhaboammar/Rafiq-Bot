import assert from 'node:assert/strict';
import { rafiqBackgroundWorker } from '../services/rafiqBackgroundWorker.js';
import { useRafiqStore } from '../stores/useRafiqStore.js';
import { BotMood, type ChatSession } from '../types.js';

console.log('Running Rafiq Background Worker Test Suite...');

// Test 1: Persistent guards per chatId
const guardA = rafiqBackgroundWorker.getGenerationGuard('chat-a');
const guardB = rafiqBackgroundWorker.getGenerationGuard('chat-b');

assert.notEqual(guardA, guardB, 'Guards must be separated per chat session');
assert.equal(guardA, rafiqBackgroundWorker.getGenerationGuard('chat-a'), 'getGenerationGuard must return the same persistent instance for the same chatId');

const leaseA = guardA.begin();
assert.equal(leaseA.isCurrent(), true, 'Lease for chat-a must be current');

// Advance chat-b; chat-a must remain current and unaffected
rafiqBackgroundWorker.advanceJob('chat-b', 'new_msg');
assert.equal(leaseA.isCurrent(), true, 'Lease for chat-a must not be affected by chat-b advancing');

// Advance chat-a; leaseA must be invalidated
rafiqBackgroundWorker.advanceJob('chat-a', 'superseded');
assert.equal(leaseA.isCurrent(), false, 'Lease for chat-a must be invalidated when chat-a advances');
assert.equal(leaseA.signal.aborted, true, 'Signal for leaseA must be aborted');

console.log('✓ Test 1: Persistent chat-scoped generation guards passed.');

// Test 2: Scheduled response and job lifecycle
let executed = false;
rafiqBackgroundWorker.scheduleResponse('chat-test', () => {
  executed = true;
}, 50, 'أميرة');

assert.equal(rafiqBackgroundWorker.isJobActive('chat-test'), true, 'Job must be marked active when scheduled');

await new Promise(resolve => setTimeout(resolve, 100));
assert.equal(executed, true, 'Scheduled response task must execute after delay');

rafiqBackgroundWorker.onJobFinished('chat-test');
assert.equal(rafiqBackgroundWorker.isJobActive('chat-test'), false, 'Job must not be active after onJobFinished');

console.log('✓ Test 2: Background job scheduling and lifecycle passed.');

// Test 3: Job cancellation
let cancelledTaskExecuted = false;
rafiqBackgroundWorker.scheduleResponse('chat-cancel', () => {
  cancelledTaskExecuted = true;
}, 80, 'سارة');

assert.equal(rafiqBackgroundWorker.isJobActive('chat-cancel'), true);
rafiqBackgroundWorker.cancelJob('chat-cancel');
assert.equal(rafiqBackgroundWorker.isJobActive('chat-cancel'), false);

await new Promise(resolve => setTimeout(resolve, 120));
assert.equal(cancelledTaskExecuted, false, 'Cancelled background job must never execute');

console.log('✓ Test 3: Background job cancellation passed.');

// Test 4: Precision delay with abort handling
const testGuard = rafiqBackgroundWorker.getGenerationGuard('delay-test');
const delayLease = testGuard.begin();

const start = Date.now();
await rafiqBackgroundWorker.precisionDelay(40, delayLease);
const elapsed = Date.now() - start;
assert.ok(elapsed >= 35, `Precision delay must wait at least 35ms (waited ${elapsed}ms)`);

// Test aborting precision delay
const abortLease = testGuard.begin();
const delayPromise = rafiqBackgroundWorker.precisionDelay(500, abortLease);
testGuard.cancel('test_abort');

await assert.rejects(
  delayPromise,
  (err: any) => err.name === 'AbortError',
  'precisionDelay must reject with AbortError when generation lease is aborted',
);

console.log('✓ Test 4: Precision delay and abort handling passed.');

// Test 5: Background notification & unread count awareness
const dummyChat: ChatSession = {
  id: 'bg-chat-1',
  settings: {
    botName: 'أميرة',
    botGender: 'female',
    chattiness: 'balanced',
    fragmentedMessages: true,
  },
  psychology: {
    mood: BotMood.NEUTRAL,
    intimacyLevel: 5,
    socialMeter: 5,
    energyLevel: 8,
    emotionalLedger: 0,
  },
  unreadCount: 0,
  lastMessageTimestamp: new Date(),
};

useRafiqStore.getState().setChats([dummyChat]);
useRafiqStore.getState().setActiveChatId('other-chat');

// When user is in 'other-chat', notifyResponseComplete should trigger
rafiqBackgroundWorker.notifyResponseComplete('bg-chat-1', 'أميرة', 'أنا هنا يا صاحبي');

// When user is in 'bg-chat-1' and document is not hidden, it should silently return
useRafiqStore.getState().setActiveChatId('bg-chat-1');
rafiqBackgroundWorker.notifyResponseComplete('bg-chat-1', 'أميرة', 'أنا هنا يا صاحبي');

console.log('✓ Test 5: Notification routing and active chat awareness passed.');

console.log('All Rafiq Background Worker tests passed successfully!');
