export type ConversationRouteId =
  | 'direct-question'
  | 'venting'
  | 'banter'
  | 'conflict'
  | 'decision'
  | 'slow-burn-story'
  | 'social-nudge'
  | 'frank-mirror'
  | 'neutral';

export type ConversationRoute = {
  id: ConversationRouteId;
  label: string;
  summary: string;
  firstPriority: string;
  secondPriority: string;
  avoid: string;
};

const STORY_PATTERN = /(?:احكي|أحكي|احكيلي|أحكيلي|ألف|الف|ألفلي|الفلي|اكتبلي|أكتبلي|قصة|حكاية|slow\s*burn|سلو\s*بيرن|رواية|حدوتة|كمل الحكاية|كمل القصة)/i;
const SOCIAL_NUDGE_PATTERN = /^(?:[؟?.]+|\s*(?:فينك|انت فين|إنت فين|انتي فين|إنتي فين|مبتردش(?:\s*ليه)?|مش بترد(?:\s*ليه)?|مش بتردي(?:\s*ليه)?|مبترديش(?:\s*ليه)?|يا بني|يا بنتي|روحت فين|روحتي فين|ازيك(?:\s+ازيك)+|جيجي|يا عم|يا سيدي)\s*[؟?.]*)$/i;
const FRANK_MIRROR_PATTERN = /(?:شايفني ازاي|شايفاني ازاي|ايه رأيك فيا|ايه رايك فيا|اي رأيك فيا|اي رايك فيا|بدون مجاملة|من غير مجاملة|عيب فيا|اكتر حاجة كويسة فيا|ايه الحلو وايه الوحش|شايفني عبيط)/i;
const DIRECT_QUESTION_PATTERN = /(؟|\?|ايه|إيه|ازاي|ازاى|ليه|متى|امتى|فين|هل|what|why|how|when|where|which|مين|من هو)/i;
const VENTING_PATTERN = /(مخنوق|زعلان|متضايق|تعبان|مكسور|زهقان|مقهور|مضايق|نفسيتي|تعبت|مش قادر|مش قادرة|زهقت|مقروف|يارب|حاسس|حاسه|الشغل قرف|فصلان|فصلانة|upset|sad|angry|tired)/i;
const BANTER_PATTERN = /(😂|🤣|🌚|😏|ههه+|بهزر|بترول|هزار|قلش|ضحك|lol|lmao|jk|roast|ياعم|ياجدع|ياعم انت)/i;
const CONFLICT_PATTERN = /(خناقة|اتخانقت|زعلتني|خانني|خانتني|كارف|سابني|سيبها|سيبه|blocked|ghost|ignored|ignored me|مش طايق|غلطان|غلطانة|استفزني|استفزتني)/i;
const DECISION_PATTERN = /(اعمل اي|أعمل اي|اعمل إيه|أعمل إيه|اخد قرار|آخد قرار|اسيب|أسيب|اكمل|أكمل|اروح|أروح|محتار|محتارة|should i|do i|decide|قرار)/i;

const normalize = (text: string): string => text.toLowerCase().replace(/\s+/g, ' ').trim();

export const classifyConversationRoute = (text: string, replyContextText?: string): ConversationRoute => {
  const merged = normalize(`${replyContextText || ''} ${text}`.trim());

  if (STORY_PATTERN.test(merged)) {
    return {
      id: 'slow-burn-story',
      label: 'Slow Burn Story',
      summary: 'The user wants a deep, atmospheric story or is engaging with an active narrative.',
      firstPriority: 'Build the scene with rich sensory detail, realistic pacing, and gradual suspense.',
      secondPriority: 'Stay in authentic character voice and deliver through engaging WhatsApp bursts (|||).',
      avoid: 'Do not rush the plot, give superficial summaries, or end prematurely.',
    };
  }

  if (SOCIAL_NUDGE_PATTERN.test(merged)) {
    return {
      id: 'social-nudge',
      label: 'Social Nudge',
      summary: 'The user is pinging or checking in after a pause or silence (nudge, ping, dots, question marks, where are you).',
      firstPriority: 'Acknowledge the ping immediately and directly like a real Egyptian friend on WhatsApp (e.g. معاك اهو, نعم, كنت فاصل شوية, فينك انت).',
      secondPriority: 'Keep the response ultra-short (1-2 micro bubbles under 25 chars) and casually prompt them (خير؟, قول, فيه حاجة؟).',
      avoid: 'Do not sound like customer support apologizing for a delay, and do not use long formal greetings.',
    };
  }

  if (FRANK_MIRROR_PATTERN.test(merged)) {
    return {
      id: 'frank-mirror',
      label: 'Frank Mirror',
      summary: 'The user is asking for an honest, unvarnished opinion, personal evaluation, or reality check without courtesy.',
      firstPriority: 'Give a candid, authentic, direct assessment grounded in real familiarity and Egyptian honesty.',
      secondPriority: 'Deliver thoughts in short punchy bursts (like single-word trait lists or playful sharp banter), balanced with warmth.',
      avoid: 'Do not produce corporate HR appraisals, diplomatic hedges, or sterile textbook analysis.',
    };
  }

  if (DECISION_PATTERN.test(merged)) {
    return {
      id: 'decision',
      label: 'Decision',
      summary: 'The user wants help choosing, judging, or deciding.',
      firstPriority: 'Clarify the practical fork or give the clearest recommendation first.',
      secondPriority: 'Then add the emotional or relational nuance behind the recommendation.',
      avoid: 'Do not drift into vague support without taking a stance.',
    };
  }

  if (CONFLICT_PATTERN.test(merged)) {
    return {
      id: 'conflict',
      label: 'Conflict',
      summary: 'The message carries tension, hurt, blame, or relational friction.',
      firstPriority: 'Address the tension directly and read the interpersonal stakes.',
      secondPriority: 'Then respond with the character stance: calm, sharp, supportive, or sarcastic.',
      avoid: 'Do not act chirpy, random, or detached from the conflict.',
    };
  }

  if (VENTING_PATTERN.test(merged)) {
    return {
      id: 'venting',
      label: 'Venting',
      summary: 'The user is unloading emotion or complaining about life, work, or stress.',
      firstPriority: 'Provide immediate, grounded Egyptian comfort (معلش, فداك, هو كدا اي شغل عامة, انت شاطر وهتعديها).',
      secondPriority: 'Keep reassurance concise, human, and heartfelt instead of offering clinical solutions.',
      avoid: 'Do not jump straight to textbook therapy worksheets, motivational essays, or clinical interrogation.',
    };
  }

  if (BANTER_PATTERN.test(merged)) {
    return {
      id: 'banter',
      label: 'Banter',
      summary: 'The message is playful, teasing, or socially loose.',
      firstPriority: 'Match the playful energy in a believable human way.',
      secondPriority: 'Then make the actual point so the reply is not empty.',
      avoid: 'Do not overperform jokes or ignore the literal content entirely.',
    };
  }

  if (DIRECT_QUESTION_PATTERN.test(merged)) {
    return {
      id: 'direct-question',
      label: 'Direct Question',
      summary: 'The user is asking for a clear answer or information.',
      firstPriority: 'Answer the direct question early and clearly.',
      secondPriority: 'Then add tone, nuance, or personality if it helps.',
      avoid: 'Do not bury the answer under roleplay, backstory, or filler.',
    };
  }

  return {
    id: 'neutral',
    label: 'Neutral',
    summary: 'The message is ordinary conversation without a dominant special route.',
    firstPriority: 'Respond in the most natural human way for the moment.',
    secondPriority: 'Let personality shape the rhythm after the core response is clear.',
    avoid: 'Do not force intensity, therapy, or jokes if the message is plain.',
  };
};

export const compileConversationRouteInstruction = (route: ConversationRoute): string => `
**CONTEXT ROUTE: ${route.label}**
- **Summary:** ${route.summary}
- **First Priority:** ${route.firstPriority}
- **Second Priority:** ${route.secondPriority}
- **Avoid:** ${route.avoid}
`;
